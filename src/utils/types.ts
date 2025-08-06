import { Address } from "viem";
import { Currency } from "./backendTypes";

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

export type Asset = {
  currency: Currency;
  style: TokenStyle;
};

export type EVM = {
  name: "EVM";
  chainId: number;
};

export type Bitcoin = {
  name: "Bitcoin";
  network: "mainnet" | "testnet";
};

export type SVM = {
  name: "SVM";
};

export type VirtualMachine = EVM | Bitcoin | SVM;

export type SupportedChain = {
  name: string;
  explorerUrl: string;
  chainId?: number;
  vm: VirtualMachine;
  assets: Asset[];
};

export type Config = {
  etherscanUrl: string;
  mainnetRpcUrl: string;
  esploraUrl: string;
  rfqServerUrl: string;
  otcServerUrl: string;
  underlyingSwappingAssets: Asset[];
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
