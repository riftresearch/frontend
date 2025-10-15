import ETHEREUM_ADDRESS_METADATA from "@/utils/tokenData/1/address_to_metadata.json";
import BASE_ADDRESS_METADATA from "@/utils/tokenData/8453/address_to_metadata.json";
import type { TokenData } from "@/utils/types";
import { FALLBACK_TOKEN_ICON } from "./constants";

type ChainKey = "ethereum" | "base";

type RawMeta = {
  name: string;
  ticker: string;
  icon: string | null;
  // other fields are ignored for search
};

type TokenIndexItem = {
  address: string; // original case
  addressLc: string;
  name: string;
  ticker: string;
  icon: string;
  nameNorm: string;
  tickerNorm: string;
  nameWords: string[];
};

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    // remove diacritics
    .replace(/\p{Diacritic}/gu, "")
    // collapse to alphanumerics + spaces
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function buildIndex(metadata: Record<string, RawMeta>): TokenIndexItem[] {
  return Object.entries(metadata).map(([address, meta]) => {
    const nameNorm = normalize(meta.name || "");
    const tickerNorm = normalize(meta.ticker || "");
    return {
      address,
      addressLc: address.toLowerCase(),
      name: meta.name,
      ticker: meta.ticker,
      icon: meta.icon || FALLBACK_TOKEN_ICON,
      nameNorm,
      tickerNorm,
      nameWords: nameNorm.split(" ").filter(Boolean),
    };
  });
}

const INDEX: Record<ChainKey, TokenIndexItem[]> = {
  ethereum: buildIndex(ETHEREUM_ADDRESS_METADATA as Record<string, RawMeta>),
  base: buildIndex(BASE_ADDRESS_METADATA as Record<string, RawMeta>),
};

function isHexAddressQuery(q: string): boolean {
  const lc = q.toLowerCase();
  if (!lc.startsWith("0x")) return false;
  return /^0x[a-f0-9]{1,40}$/.test(lc);
}

type Ranked = {
  item: TokenIndexItem;
  score: number;
  exactTicker: boolean;
  exactName: boolean;
  addrPrefixLen: number;
  isPopular: boolean;
};

function rankItem(
  item: TokenIndexItem,
  qRaw: string,
  qNorm: string,
  addrMode: boolean
): Ranked | null {
  const addrLc = item.addressLc;
  const qLc = qRaw.toLowerCase();

  let score = 0;
  let exactTicker = false;
  let exactName = false;
  let addrPrefixLen = 0;

  // Address scoring
  if (addrLc === qLc) {
    score = Math.max(score, 100);
    addrPrefixLen = qLc.length;
  } else if (addrLc.startsWith(qLc)) {
    score = Math.max(score, 90);
    addrPrefixLen = qLc.length;
  } else if (addrLc.includes(qLc)) {
    score = Math.max(score, 70);
  }

  // Ticker scoring
  if (item.tickerNorm.length > 0) {
    if (item.tickerNorm === qNorm) {
      score = Math.max(score, 95);
      exactTicker = true;
    } else if (item.tickerNorm.startsWith(qNorm)) {
      score = Math.max(score, 85);
    } else if (item.tickerNorm.includes(qNorm)) {
      score = Math.max(score, 65);
    }
  }

  // Name scoring
  if (item.nameNorm.length > 0) {
    if (item.nameNorm === qNorm) {
      score = Math.max(score, 90);
      exactName = true;
    } else if (item.nameNorm.startsWith(qNorm)) {
      score = Math.max(score, 80);
    } else if (item.nameWords.some((w) => w.startsWith(qNorm))) {
      score = Math.max(score, 75);
    } else if (item.nameNorm.includes(qNorm)) {
      score = Math.max(score, 60);
    }
  }

  // If in address mode and we got no meaningful score, drop item
  if (addrMode && score < 70) return null;

  return { item, score, exactTicker, exactName, addrPrefixLen, isPopular: false };
}

export function searchTokens(chain: ChainKey, query: string, limit = 10): TokenData[] {
  const qRaw = query.trim();
  if (qRaw.length === 0) return [];
  const qNorm = normalize(qRaw);
  const addrMode = isHexAddressQuery(qRaw);
  const index = INDEX[chain] || [];

  // Popular token addresses (lowercased). Extendable by editing this list.
  const POPULAR_ADDRESSES = new Set<string>([
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
  ]);
  const POPULAR_BOOST = 7; // small boost to float popular tokens on ties/near ties

  const ranked: Ranked[] = [];
  for (const item of index) {
    const r = rankItem(item, qRaw, qNorm, addrMode);
    if (r && r.score > 0) ranked.push(r);
  }

  // Apply popularity bonus
  for (const r of ranked) {
    const isPopular = POPULAR_ADDRESSES.has(r.item.addressLc);
    r.isPopular = isPopular;
    if (isPopular) r.score += POPULAR_BOOST;
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isPopular !== b.isPopular) return Number(b.isPopular) - Number(a.isPopular);
    if (a.exactTicker !== b.exactTicker) return Number(b.exactTicker) - Number(a.exactTicker);
    if (a.exactName !== b.exactName) return Number(b.exactName) - Number(a.exactName);
    if (b.addrPrefixLen !== a.addrPrefixLen) return b.addrPrefixLen - a.addrPrefixLen;
    return a.item.name.localeCompare(b.item.name);
  });

  return ranked.slice(0, limit).map(({ item }) => ({
    name: item.name,
    ticker: item.ticker,
    address: item.address,
    balance: "0",
    usdValue: "$0.00",
    icon: item.icon,
  }));
}
