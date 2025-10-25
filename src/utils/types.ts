import { Address } from "viem";
import { Currency } from "./rfqClient";

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

export type TokenData = {
  name: string;
  ticker: string;
  address: string | null;
  balance: string;
  usdValue: string;
  icon: string;
  decimals: number;
  chainId?: number; // Optional: 1 for Ethereum, 8453 for Base
};

export type TokenMetadata = {
  name: string;
  ticker: string;
  icon: string;
  decimals: number;
};

export type TokenBalance = {
  address: string;
  totalBalance: string;
  decimals: number;
  name: string;
  symbol: string;
};

export type TokenPrice = {
  price: number;
  confidence: number;
};

export type PermitAllowance = {
  amount: string; // uint160
  expiration: string; // uint48
  nonce: string; // uint48
};

export type PermitDataForSwap = {
  permit: any; // PermitSingle from permit2-sdk
  signature: string; // Hex signature from signTypedData
};

export enum ApprovalState {
  UNKNOWN = "UNKNOWN",
  NEEDS_APPROVAL = "NEEDS_APPROVAL",
  APPROVING = "APPROVING",
  APPROVED = "APPROVED",
}

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

/** Market Maker */
export interface MarketMaker {
  mmName: string;
  currentEthBalance: number;
  currentCbbtcBalance: number;
  currentBtcBalance: number;
}

/** Error Log item */
export interface ErrorLogItem {
  /** unix ms timestamp */
  timestamp: number;
  /** Short uppercase error title like QUOTE_ERROR */
  title: string;
  /** Full error message */
  message: string;
}

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

// Admin dashboard swap history types - aligned to OTC DB statuses
export type AdminSwapFlowStatus =
  | "pending" // swap created
  | "waiting_user_deposit_initiated"
  | "waiting_user_deposit_confirmed"
  | "waiting_mm_deposit_initiated"
  | "waiting_mm_deposit_confirmed"
  | "settled"
  | "refunding_user" // refund in progress to user
  | "refunding_mm"; // refund in progress to market maker

export interface AdminSwapFlowStep {
  status: AdminSwapFlowStatus;
  /** Display label for the step, e.g. "Swap Created", "3 Confs" */
  label: string;
  /** Optional short duration display like "0:54" */
  duration?: string;
  /** Optional badge to hint chain/asset shown in the UI */
  badge?: "BTC" | "cbBTC";
  /** Visual/logic state for the step */
  state: "notStarted" | "inProgress" | "completed";
  /** Transaction hash for this step */
  txHash?: string;
  /** Chain for the transaction (for proper explorer link) */
  txChain?: "ETH" | "BTC";
}

export type SwapDirection = "BTC_TO_EVM" | "EVM_TO_BTC" | "UNKNOWN";

export interface AdminSwapItem {
  statusTesting?: any;

  id: string;
  /** Unix ms timestamp when swap was created */
  swapCreationTimestamp: number;
  /** EVM account that initiated the swap */
  evmAccountAddress: string;
  /** Which EVM chain the swap is on */
  chain: "ETH" | "BASE";
  /** Direction of the swap */
  direction: SwapDirection;
  /** Initial amount in BTC */
  swapInitialAmountBtc: number;
  /** Initial amount in USD */
  swapInitialAmountUsd: number;
  /** Rift fee in sats */
  riftFeeSats: number;
  /** Observed user confirmations (for averages) */
  userConfs?: number;
  /** Observed mm confirmations (for averages) */
  mmConfs?: number;
  /** Network/gas fee in USD */
  networkFeeUsd: number;
  /** Market maker fee in USD */
  mmFeeUsd: number;
  /** Ordered list of flow steps for the visual tracker */
  flow: AdminSwapFlowStep[];
  /** Timestamps for each completed step (for live timer calculation) */
  stepTimestamps?: {
    created?: number;
    userDepositDetected?: number;
    userConfirmed?: number;
    mmDepositDetected?: number;
    mmPrivateKeySent?: number;
  };
  /** Raw swap data from backend */
  rawData?: any;
}
