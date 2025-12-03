const DEFILLAMA_BASE_URL = "https://coins.llama.fi/prices/current";

type SupportedChain = "ethereum" | "base" | "coingecko";

export interface TokenPrice {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
  decimals?: number;
}

export interface TokenPricesResponse {
  coins: Record<string, TokenPrice>;
}

/**
 * Fetches token prices from DefiLlama
 *
 * @param chain - The chain to fetch prices for ('ethereum', 'base', or 'coingecko')
 * @param addresses - Array of token addresses (or coingecko ids for 'coingecko' chain)
 * @param searchWidth - Optional time window for price lookup (e.g. '4h')
 * @returns Token prices keyed by chain:address
 */
export async function fetchTokenPrices(
  chain: SupportedChain,
  addresses: string[],
  searchWidth?: string
): Promise<TokenPricesResponse> {
  if (addresses.length === 0) {
    return { coins: {} };
  }

  const coins = addresses.map((a) => `${chain}:${a}`).join(",");
  const url = searchWidth
    ? `${DEFILLAMA_BASE_URL}/${coins}?searchWidth=${encodeURIComponent(searchWidth)}`
    : `${DEFILLAMA_BASE_URL}/${coins}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DefiLlama request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches a single token price from DefiLlama
 *
 * @param chain - The chain to fetch the price for
 * @param address - Token address (or coingecko id for 'coingecko' chain)
 * @returns The token price or null if not found
 */
export async function fetchTokenPrice(
  chain: SupportedChain,
  address: string
): Promise<TokenPrice | null> {
  const key = `${chain}:${address}`;
  const response = await fetchTokenPrices(chain, [address]);
  return response.coins[key] ?? null;
}

/**
 * Fetches BTC and ETH prices from DefiLlama (via CoinGecko IDs)
 */
export async function fetchBtcEthPrices(): Promise<{
  btcPrice: number | null;
  ethPrice: number | null;
}> {
  try {
    const response = await fetchTokenPrices("coingecko", ["bitcoin", "ethereum"]);
    return {
      btcPrice: response.coins["coingecko:bitcoin"]?.price ?? null,
      ethPrice: response.coins["coingecko:ethereum"]?.price ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch BTC/ETH prices:", error);
    return { btcPrice: null, ethPrice: null };
  }
}
