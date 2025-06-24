import { Address } from "viem";

export type TokenStyle = {
  name: string;
  symbol: string;
  display_name?: string;
  icon_svg?: any;
  bg_color?: string;
  border_color?: string;
  border_color_light?: string;
  dark_bg_color?: string;
  light_text_color?: string;
  logoURI?: string;
};

export type ValidAsset = {
  tokenAddress: Address;
  decimals: number;
  style: TokenStyle;
};

export type ChainScopedConfig = {
  name: string;
  type: "Mainnet" | "Testnet";
  chainId: number;
  etherscanUrl: string;
  rpcUrl: string;
  esploraUrl: string;
  bitcoinNetwork: "mainnet";
  dataEngineUrl: string;
  underlyingSwappingAsset: ValidAsset;
  riftExchangeAddress: string;
  bundler3: {
    bundler3Address: string;
    generalAdapter1Address: string;
    paraswapAdapterAddress: string;
    riftcbBTCAdapterAddress: string;
  };
  marketMakers: Array<{
    bitcoinAddress: string;
  }>;
};

export type RouteButton = "Swap" | "Manage" | "About";

export const ROUTES: { [k in RouteButton]: string } = {
  Swap: "/",
  Manage: "/manage",
  About: "/about",
};

/**
 * Represents a swap transaction in the user's history
 */
export interface SwapHistoryItem {
  /** Unique identifier for the swap */
  id: string;
  /** Input amount being swapped (as string to preserve precision) */
  amount: string;
  /** Input asset symbol (e.g., "cbBTC", "USDC") */
  asset: string;
  /** Output amount received (as string to preserve precision) */
  outputAmount: string;
  /** Output asset symbol (e.g., "BTC", "ETH") */
  outputAsset: string;
  /** Current status of the swap transaction */
  status: "Completed" | "Pending" | "Failed";
  /** Human-readable time since the swap occurred */
  timeAgo: string;
  /** Transaction hash on the blockchain */
  txHash: string;
}

/**
 * Type for an array of swap history items
 */
export type SwapHistory = SwapHistoryItem[];
