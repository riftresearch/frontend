import { create } from "zustand";
import { Swap, QuoteResponse } from "./riftApiClient";
import { TokenData, ApprovalState } from "./types";
import { FeeOverview } from "./swapHelpers";
import type { QuoteResults } from "@cowprotocol/sdk-trading";

// Inline to avoid circular dependency with constants.ts
const DEFAULT_INPUT_TOKEN: TokenData = {
  name: "Ethereum",
  ticker: "ETH",
  address: "0x0000000000000000000000000000000000000000",
  balance: "0",
  usdValue: "$0.00",
  icon: "https://assets.smold.app/api/chains/1/logo-128.png",
  decimals: 18,
  chainId: 1,
};

// Default output token is BTC (mirrors BTC_TOKEN from constants.ts)
const DEFAULT_OUTPUT_TOKEN: TokenData = {
  name: "Bitcoin",
  ticker: "BTC",
  address: "native",
  balance: "0",
  usdValue: "$0.00",
  icon: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
  decimals: 8,
  chainId: 0,
};

type DepositFlowState =
  | "0-not-started"
  | "1-WaitingUserDepositInitiated"
  | "2-WaitingUserDepositConfirmed"
  | "3-WaitingMMDepositInitiated"
  | "4-WaitingMMDepositConfirmed"
  | "5-Settled"
  | "6-RefundingUser"
  | "7-RefundingMM"
  | "8-Failed";

export enum CowswapOrderStatus {
  NO_ORDER = "NO_ORDER",
  SIGNING = "SIGNING",
  SIGNED = "SIGNED",
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
}

export interface CowswapOrderData {
  id: string | null;
  order: any | null; // EnrichedOrder from SDK - using any to avoid direct dependency import
}

/** Quote confidence level - indicative quotes use placeholder address, executable quotes use real user address */
export type QuoteType = "indicative" | "executable";

export const DEFAULT_CONNECT_WALLET_CHAIN_ID = 1;

export const useStore = create<{
  evmConnectWalletChainId: number;
  setEvmConnectWalletChainId: (chainId: number) => void;
  userTokensByChain: Record<number, TokenData[]>;
  setUserTokensForChain: (chainId: number, tokens: TokenData[]) => void;
  selectedInputToken: TokenData;
  setSelectedInputToken: (token: TokenData) => void;
  selectedOutputToken: TokenData;
  setSelectedOutputToken: (token: TokenData) => void;
  isSwappingForBTC: boolean;
  setIsSwappingForBTC: (value: boolean) => void;
  displayedInputAmount: string;
  setDisplayedInputAmount: (value: string) => void;
  fullPrecisionInputAmount: string | null;
  setFullPrecisionInputAmount: (value: string | null) => void;
  outputAmount: string;
  setOutputAmount: (value: string) => void;
  searchResults: TokenData[];
  setSearchResults: (tokens: TokenData[]) => void;
  depositFlowState: DepositFlowState;
  setDepositFlowState: (s: DepositFlowState) => void;
  countdownValue: number;
  setCountdownValue: (value: number) => void;
  swapResponse: Swap | null;
  setSwapResponse: (response: Swap | null) => void;
  transactionConfirmed: boolean;
  setTransactionConfirmed: (confirmed: boolean) => void;
  btcPrice: number | null;
  setBtcPrice: (price: number | null) => void;
  ethPrice: number | null;
  setEthPrice: (price: number | null) => void;
  erc20Price: number | null;
  setErc20Price: (price: number | null) => void;
  inputUsdValue: string;
  setInputUsdValue: (value: string) => void;
  outputUsdValue: string;
  setOutputUsdValue: (value: string) => void;
  cowswapQuote: QuoteResults | null;
  rfqQuote: QuoteResponse | null;
  quoteType: QuoteType | null;
  /** Atomically update quotes and quote type together. Pass null to clear all. */
  setQuotes: (params: {
    cowswapQuote: QuoteResults | null;
    rfqQuote: QuoteResponse | null;
    quoteType: QuoteType | null;
  }) => void;
  /** Clear all quotes atomically (sets cowswapQuote, rfqQuote, and quoteType to null) */
  clearQuotes: () => void;
  slippageBips: number;
  setSlippageBips: (value: number) => void;
  payoutAddress: string;
  setPayoutAddress: (address: string) => void;
  addressValidation: { isValid: boolean; networkMismatch?: boolean; detectedNetwork?: string };
  setAddressValidation: (validation: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }) => void;
  btcRefundAddress: string;
  setBtcRefundAddress: (address: string) => void;
  btcRefundAddressValidation: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  };
  setBtcRefundAddressValidation: (validation: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }) => void;
  approvalState: ApprovalState;
  setApprovalState: (state: ApprovalState) => void;
  feeOverview: FeeOverview | null;
  setFeeOverview: (overview: FeeOverview | null) => void;
  isOtcServerDead: boolean;
  setIsOtcServerDead: (value: boolean) => void;
  isRetryingOtcServer: boolean;
  setIsRetryingOtcServer: (value: boolean) => void;
  otcRetryCount: number;
  setOtcRetryCount: (value: number) => void;
  hasNoRoutesError: boolean;
  setHasNoRoutesError: (value: boolean) => void;
  exceedsAvailableBTCLiquidity: boolean;
  setExceedsAvailableBTCLiquidity: (value: boolean) => void;
  exceedsAvailableCBBTCLiquidity: boolean;
  setExceedsAvailableCBBTCLiquidity: (value: boolean) => void;
  exceedsUserBalance: boolean;
  setExceedsUserBalance: (value: boolean) => void;
  inputBelowMinimum: boolean;
  setInputBelowMinimum: (value: boolean) => void;
  refetchQuote: boolean;
  setRefetchQuote: (value: boolean) => void;
  isAwaitingOptimalQuote: boolean;
  setIsAwaitingOptimalQuote: (value: boolean) => void;
  cowswapOrderStatus: CowswapOrderStatus;
  setCowswapOrderStatus: (status: CowswapOrderStatus) => void;
  cowswapOrderData: CowswapOrderData | null;
  setCowswapOrderData: (data: CowswapOrderData | null) => void;
  switchingToInputTokenChain: boolean;
  setSwitchingToInputTokenChain: (value: boolean) => void;
  selectedInputAddress: string | null;
  setSelectedInputAddress: (address: string | null) => void;
  selectedOutputAddress: string | null;
  setSelectedOutputAddress: (address: string | null) => void;
  skipAddressClearOnDirectionChange: boolean;
  setSkipAddressClearOnDirectionChange: (value: boolean) => void;
}>((set) => ({
  evmConnectWalletChainId: DEFAULT_CONNECT_WALLET_CHAIN_ID,
  setEvmConnectWalletChainId: (chainId: number) => set({ evmConnectWalletChainId: chainId }),
  userTokensByChain: {},
  setUserTokensForChain: (chainId: number, tokens) =>
    set((state) => ({
      userTokensByChain: { ...state.userTokensByChain, [chainId]: tokens },
    })),
  selectedInputToken: DEFAULT_INPUT_TOKEN,
  setSelectedInputToken: (token: TokenData) => set({ selectedInputToken: token }),
  selectedOutputToken: DEFAULT_OUTPUT_TOKEN,
  setSelectedOutputToken: (token: TokenData) => set({ selectedOutputToken: token }),
  isSwappingForBTC: true,
  setIsSwappingForBTC: (value: boolean) => set({ isSwappingForBTC: value }),
  displayedInputAmount: "",
  setDisplayedInputAmount: (value: string) => set({ displayedInputAmount: value }),
  fullPrecisionInputAmount: null,
  setFullPrecisionInputAmount: (value: string | null) => set({ fullPrecisionInputAmount: value }),
  outputAmount: "",
  setOutputAmount: (value: string) => set({ outputAmount: value }),
  searchResults: [],
  setSearchResults: (tokens: TokenData[]) => set({ searchResults: tokens }),
  depositFlowState: "0-not-started",
  setDepositFlowState: (s: DepositFlowState) => set({ depositFlowState: s }),
  countdownValue: 99,
  setCountdownValue: (value: number) => set({ countdownValue: value }),
  swapResponse: null,
  setSwapResponse: (response: Swap | null) => set({ swapResponse: response }),
  transactionConfirmed: false,
  setTransactionConfirmed: (confirmed: boolean) => set({ transactionConfirmed: confirmed }),
  btcPrice: null,
  setBtcPrice: (price: number | null) => set({ btcPrice: price }),
  ethPrice: null,
  setEthPrice: (price: number | null) => set({ ethPrice: price }),
  erc20Price: null,
  setErc20Price: (price: number | null) => set({ erc20Price: price }),
  inputUsdValue: "$0.00",
  setInputUsdValue: (value: string) => set({ inputUsdValue: value }),
  outputUsdValue: "$0.00",
  setOutputUsdValue: (value: string) => set({ outputUsdValue: value }),
  cowswapQuote: null,
  rfqQuote: null,
  quoteType: null,
  setQuotes: (params) =>
    set({
      cowswapQuote: params.cowswapQuote,
      rfqQuote: params.rfqQuote,
      quoteType: params.quoteType,
    }),
  clearQuotes: () => set({ cowswapQuote: null, rfqQuote: null, quoteType: null }),
  slippageBips: 5,
  setSlippageBips: (value: number) => set({ slippageBips: value }),
  payoutAddress: "",
  setPayoutAddress: (address: string) => set({ payoutAddress: address }),
  addressValidation: { isValid: false },
  setAddressValidation: (validation: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }) => set({ addressValidation: validation }),
  btcRefundAddress: "",
  setBtcRefundAddress: (address: string) => set({ btcRefundAddress: address }),
  btcRefundAddressValidation: { isValid: false },
  setBtcRefundAddressValidation: (validation: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }) => set({ btcRefundAddressValidation: validation }),
  approvalState: ApprovalState.UNKNOWN,
  setApprovalState: (state: ApprovalState) => set({ approvalState: state }),
  feeOverview: null,
  setFeeOverview: (overview: FeeOverview | null) => set({ feeOverview: overview }),
  isOtcServerDead: false,
  setIsOtcServerDead: (value: boolean) => set({ isOtcServerDead: value }),
  isRetryingOtcServer: false,
  setIsRetryingOtcServer: (value: boolean) => set({ isRetryingOtcServer: value }),
  otcRetryCount: 0,
  setOtcRetryCount: (value: number) => set({ otcRetryCount: value }),
  hasNoRoutesError: false,
  setHasNoRoutesError: (value: boolean) => set({ hasNoRoutesError: value }),
  exceedsAvailableBTCLiquidity: false,
  setExceedsAvailableBTCLiquidity: (value: boolean) => set({ exceedsAvailableBTCLiquidity: value }),
  exceedsAvailableCBBTCLiquidity: false,
  setExceedsAvailableCBBTCLiquidity: (value: boolean) =>
    set({ exceedsAvailableCBBTCLiquidity: value }),
  exceedsUserBalance: false,
  setExceedsUserBalance: (value: boolean) => set({ exceedsUserBalance: value }),
  inputBelowMinimum: false,
  setInputBelowMinimum: (value: boolean) => set({ inputBelowMinimum: value }),
  refetchQuote: false,
  setRefetchQuote: (value: boolean) => set({ refetchQuote: value }),
  isAwaitingOptimalQuote: false,
  setIsAwaitingOptimalQuote: (value: boolean) => set({ isAwaitingOptimalQuote: value }),
  cowswapOrderStatus: CowswapOrderStatus.NO_ORDER,
  setCowswapOrderStatus: (status: CowswapOrderStatus) => set({ cowswapOrderStatus: status }),
  cowswapOrderData: null,
  setCowswapOrderData: (data: CowswapOrderData | null) => set({ cowswapOrderData: data }),
  switchingToInputTokenChain: false,
  setSwitchingToInputTokenChain: (value: boolean) => set({ switchingToInputTokenChain: value }),
  selectedInputAddress: null,
  setSelectedInputAddress: (address: string | null) => set({ selectedInputAddress: address }),
  selectedOutputAddress: null,
  setSelectedOutputAddress: (address: string | null) => set({ selectedOutputAddress: address }),
  skipAddressClearOnDirectionChange: false,
  setSkipAddressClearOnDirectionChange: (value: boolean) =>
    set({ skipAddressClearOnDirectionChange: value }),
}));
