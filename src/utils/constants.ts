import { Config, TokenStyle, TokenData } from "./types";

import BASE_ADDRESS_METADATA from "@/utils/tokenData/8453/address_to_metadata.json";
import ETHEREUM_ADDRESS_METADATA from "@/utils/tokenData/1/address_to_metadata.json";
import BASE_TICKERS_TO_ADDRESS from "@/utils/tokenData/8453/tickers_to_address.json";
import ETHEREUM_TICKERS_TO_ADDRESS from "@/utils/tokenData/1/tickers_to_address.json";
import { createRiftApiClient } from "./riftApiClient";
import { createRfqClient } from "./rfqClient";

export const IS_FRONTEND_PAUSED = process.env.NEXT_PUBLIC_IS_FRONTEND_PAUSED === "true";

export const ETH_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD = 100;
export const BTC_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD = 6;

export const FALLBACK_TOKEN_ICON = "/images/icons/Help.png";

export const ETH_ICON = "https://assets.smold.app/api/chains/1/logo-128.png";

export const BTC_ICON = "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400";

export const BITCOIN_DECIMALS = 8;

export const ZERO_USD_DISPLAY = "$0.00";

export const MIN_SWAP_SATS = 3000;

// Chain ID to network name mapping
export const CHAIN_NAMES: Record<number, string> = {
  0: "Bitcoin",
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
  56: "BNB",
};

export const bitcoinStyle: TokenStyle = {
  name: "Bitcoin",
  display_name: "BTC",
  symbol: "BTC",
  icon_svg: null,
  bg_color: "#9B602F",
  border_color: "#FFA04C",
  border_color_light: "#FFA04F",
  dark_bg_color: "#291B0D",
  light_text_color: "#7d572e",
};

export const cbBTCStyle: TokenStyle = {
  name: "Coinbase Bitcoin",
  display_name: "cbBTC",
  symbol: "cbBTC",
  bg_color: "#2E59BB",
  border_color: "#1C61FD",
  border_color_light: "#3B70E8",
  dark_bg_color: "rgba(9, 36, 97, 0.3)",
  light_text_color: "#365B9F",
  logoURI: "https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp",
};
export const opaqueBackgroundColor = {
  bg: "rgba(15, 15, 15, 0.55)",
  backdropFilter: "blur(10px)",
};

export const GLOBAL_CONFIG: Config = {
  etherscanUrl: "https://etherscan.io",
  mainnetRpcUrl: "https://eth0.riftnodes.com",
  esploraUrl: "https://blockstream.info/api",
  riftApiUrl: "https://api.rift.trade",
  rfqUrl: "https://rfq-server-v2-production.up.railway.app",
  underlyingSwappingAssets: [
    {
      currency: {
        chain: { kind: "BITCOIN" },
        token: {
          kind: "NATIVE",
          decimals: 8,
        },
      },
      style: bitcoinStyle,
    },
    {
      currency: {
        chain: { kind: "EVM", chainId: 1 },
        token: {
          kind: "TOKEN",
          // NOTE: Addresses right now need to be checksummed
          address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
          decimals: 8,
        },
      },
      style: cbBTCStyle,
    },
  ],
};

export const riftApiClient = createRiftApiClient({
  baseUrl: GLOBAL_CONFIG.riftApiUrl,
});

export const rfqClient = createRfqClient({
  baseUrl: GLOBAL_CONFIG.rfqUrl,
});

// Popular tokens list
const POPULAR_TOKENS = ["ETH", "USDC", "USDT", "WBTC", "WETH", "cbBTC", "USDe", "DAI", "UNI"];

export const ETH_TOKEN = {
  name: "Ethereum",
  ticker: "ETH",
  address: "0x0000000000000000000000000000000000000000",
  balance: "0",
  usdValue: "$0.00",
  icon: ETH_ICON,
  decimals: 18,
  chainId: 1,
};

export const ETH_TOKEN_BASE = {
  ...ETH_TOKEN,
  chainId: 8453,
};

// Bitcoin token (native BTC, chainId 0 indicates Bitcoin network)
export const BTC_TOKEN: TokenData = {
  name: "Bitcoin",
  ticker: "BTC",
  address: "Native",
  balance: "0",
  usdValue: "$0.00",
  icon: BTC_ICON,
  decimals: 8,
  chainId: 0,
};

// cbBTC tokens for Ethereum and Base
export const CBBTC_TOKEN: TokenData = {
  name: "Coinbase Bitcoin",
  ticker: "cbBTC",
  address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  balance: "0",
  usdValue: "$0.00",
  icon: cbBTCStyle.logoURI || FALLBACK_TOKEN_ICON,
  decimals: 8,
  chainId: 1,
};

export const CBBTC_TOKEN_BASE: TokenData = {
  ...CBBTC_TOKEN,
  chainId: 8453,
};

// Popular output tokens (BTC and cbBTC from both chains)
export const POPULAR_OUTPUT_TOKENS: TokenData[] = [BTC_TOKEN, CBBTC_TOKEN, CBBTC_TOKEN_BASE];

// Create network-specific popular tokens
export const BASE_POPULAR_TOKENS: TokenData[] = POPULAR_TOKENS.map((ticker) => {
  if (ticker === "ETH") {
    return ETH_TOKEN_BASE;
  }
  const address = BASE_TICKERS_TO_ADDRESS[ticker as keyof typeof BASE_TICKERS_TO_ADDRESS];
  const token = BASE_ADDRESS_METADATA[address as keyof typeof BASE_ADDRESS_METADATA] as any;
  return {
    name: token.name,
    ticker: token.ticker,
    address: address,
    balance: "0",
    usdValue: "$0.00",
    icon: token.icon || FALLBACK_TOKEN_ICON,
    decimals: token.decimals || 18,
    chainId: 8453,
  };
});

export const ETHEREUM_POPULAR_TOKENS: TokenData[] = POPULAR_TOKENS.map((ticker) => {
  if (ticker === "ETH") {
    return ETH_TOKEN;
  }
  const address = ETHEREUM_TICKERS_TO_ADDRESS[ticker as keyof typeof ETHEREUM_TICKERS_TO_ADDRESS];
  const token = ETHEREUM_ADDRESS_METADATA[address as keyof typeof ETHEREUM_ADDRESS_METADATA] as any;
  return {
    name: token.name,
    ticker: token.ticker,
    address: address,
    balance: "0",
    usdValue: "$0.00",
    icon: token.icon || FALLBACK_TOKEN_ICON,
    decimals: token.decimals || 18,
    chainId: 1,
  };
});

// Popular addresses for search weighting (lowercased)
export const ETHEREUM_POPULAR_ADDRESSES = new Set<string>([
  "0x0000000000000000000000000000000000000000", // ETH
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", // cbBTC
]);

export const BASE_POPULAR_ADDRESSES = new Set<string>([
  "0x0000000000000000000000000000000000000000", // ETH
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", // cbBTC
  "0x4200000000000000000000000000000000000006", // WETH
]);

// Combined popular tokens for "All Networks" view (ETH, USDC, cbBTC from both chains)
const ALL_POPULAR_TICKERS = ["ETH", "USDC", "cbBTC", "USDT"];

export const ALL_POPULAR_TOKENS: TokenData[] = [
  // Ethereum tokens
  ...ALL_POPULAR_TICKERS.map((ticker) => {
    if (ticker === "ETH") {
      return ETH_TOKEN;
    }
    const address = ETHEREUM_TICKERS_TO_ADDRESS[ticker as keyof typeof ETHEREUM_TICKERS_TO_ADDRESS];
    const token = ETHEREUM_ADDRESS_METADATA[
      address as keyof typeof ETHEREUM_ADDRESS_METADATA
    ] as any;
    return {
      name: token.name,
      ticker: token.ticker,
      address: address,
      balance: "0",
      usdValue: "$0.00",
      icon: token.icon || FALLBACK_TOKEN_ICON,
      decimals: token.decimals || 18,
      chainId: 1,
    };
  }),
  // Base tokens
  ...ALL_POPULAR_TICKERS.map((ticker) => {
    if (ticker === "ETH") {
      return ETH_TOKEN_BASE;
    }
    const address = BASE_TICKERS_TO_ADDRESS[ticker as keyof typeof BASE_TICKERS_TO_ADDRESS];
    const token = BASE_ADDRESS_METADATA[address as keyof typeof BASE_ADDRESS_METADATA] as any;
    return {
      name: token.name,
      ticker: token.ticker,
      address: address,
      balance: "0",
      usdValue: "$0.00",
      icon: token.icon || FALLBACK_TOKEN_ICON,
      decimals: token.decimals || 18,
      chainId: 8453,
    };
  }),
];

// CowSwap Universal Router (used by cowswapClient for approvals)
export const COWSWAP_VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";
