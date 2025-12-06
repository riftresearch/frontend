import { Config, TokenStyle, TokenData } from "./types";
import { createRfqClient, Currency } from "./rfqClient";
import { createOTCClient } from "./otcClient";

import BASE_ADDRESS_METADATA from "@/utils/tokenData/8453/address_to_metadata.json";
import ETHEREUM_ADDRESS_METADATA from "@/utils/tokenData/1/address_to_metadata.json";
import BASE_TICKERS_TO_ADDRESS from "@/utils/tokenData/8453/tickers_to_address.json";
import ETHEREUM_TICKERS_TO_ADDRESS from "@/utils/tokenData/1/tickers_to_address.json";

export const IS_FRONTEND_PAUSED = process.env.NEXT_PUBLIC_IS_FRONTEND_PAUSED === "true";

export const ETH_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD = 100;
export const BTC_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD = 6;

export const FALLBACK_TOKEN_ICON = "/images/icons/Help.png";

export const ETH_ICON = "https://assets.smold.app/api/chains/1/logo-128.png";

export const BTC_ICON = "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400";

export const BITCOIN_DECIMALS = 8;

export const ZERO_USD_DISPLAY = "$0.00";

export const MIN_SWAP_SATS = 3000;

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
  rfqServerUrl: "https://rfq-server-production.up.railway.app",
  otcServerUrl:
    "https://97c189391e051abc6e372aecad1d54bb34c39fde-4422.dstack-pha-prod9.phala.network/",
  underlyingSwappingAssets: [
    {
      currency: {
        chain: "bitcoin",
        decimals: 8,
        token: {
          type: "Native",
        },
      },
      style: bitcoinStyle,
    },
    {
      currency: {
        chain: "ethereum",
        decimals: 8,
        token: {
          type: "Address",
          // NOTE: Addresses right now need to be checksummed
          data: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        },
      },
      style: cbBTCStyle,
    },
  ],
};

export const rfqClient = createRfqClient({
  baseUrl: GLOBAL_CONFIG.rfqServerUrl,
  timeout: 10000,
});

export const otcClient = createOTCClient({
  baseUrl: GLOBAL_CONFIG.otcServerUrl,
  timeout: 10000,
});

// Popular tokens list
const POPULAR_TOKENS = ["ETH", "USDC", "USDT", "WBTC", "WETH", "cbBTC"];

// Create network-specific popular tokens
export const BASE_POPULAR_TOKENS: TokenData[] = POPULAR_TOKENS.map((ticker) => {
  if (ticker === "ETH") {
    return {
      name: "Ethereum",
      ticker: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      balance: "0",
      usdValue: "$0.00",
      icon: ETH_ICON,
      decimals: 18,
    };
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
  };
});

export const ETHEREUM_POPULAR_TOKENS: TokenData[] = POPULAR_TOKENS.map((ticker) => {
  if (ticker === "ETH") {
    return {
      name: "Ethereum",
      ticker: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      balance: "0",
      usdValue: "$0.00",
      icon: ETH_ICON,
      decimals: 18,
    };
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
const ALL_POPULAR_TICKERS = ["ETH", "USDC", "cbBTC"];

export const ALL_POPULAR_TOKENS: TokenData[] = [
  // Ethereum tokens
  ...ALL_POPULAR_TICKERS.map((ticker) => {
    if (ticker === "ETH") {
      return {
        name: "Ethereum",
        ticker: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        balance: "0",
        usdValue: "$0.00",
        icon: ETH_ICON,
        decimals: 18,
        chainId: 1,
      };
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
      return {
        name: "Ethereum",
        ticker: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        balance: "0",
        usdValue: "$0.00",
        icon: ETH_ICON,
        decimals: 18,
        chainId: 8453,
      };
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

export const UNIVERSAL_ROUTER_ADDRESS = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
export const SWAP_ROUTER02_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// Permit2 ABI for allowance checking
export const PERMIT2_ABI = [
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { internalType: "uint160", name: "amount", type: "uint160" },
      { internalType: "uint48", name: "expiration", type: "uint48" },
      { internalType: "uint48", name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
