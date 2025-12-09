import { create } from "zustand";
import { CreateSwapResponse } from "./otcClient";
import { TokenData, ApprovalState } from "./types";
import { Quote } from "./rfqClient";
import { FeeOverview } from "./swapHelpers";
import type { QuoteResults } from "@cowprotocol/sdk-trading";

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

export const DEFAULT_CONNECT_WALLET_CHAIN_ID = 1;

export const useStore = create<{
  evmConnectWalletChainId: number;
  setEvmConnectWalletChainId: (chainId: number) => void;
  userTokensByChain: Record<number, TokenData[]>;
  setUserTokensForChain: (chainId: number, tokens: TokenData[]) => void;
  selectedInputToken: TokenData;
  setSelectedInputToken: (token: TokenData) => void;
  selectedOutputToken: TokenData | null;
  setSelectedOutputToken: (token: TokenData | null) => void;
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
  swapResponse: CreateSwapResponse | null;
  setSwapResponse: (response: CreateSwapResponse | null) => void;
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
  setCowswapQuote: (quote: QuoteResults | null) => void;
  rfqQuote: Quote | null;
  setRfqQuote: (quote: Quote | null) => void;
  slippageBips: number;
  setSlippageBips: (value: number) => void;
  bitcoinDepositInfo: { address: string; amount: number; uri: string } | null;
  setBitcoinDepositInfo: (info: { address: string; amount: number; uri: string } | null) => void;
  payoutAddress: string;
  setPayoutAddress: (address: string) => void;
  addressValidation: { isValid: boolean; networkMismatch?: boolean; detectedNetwork?: string };
  setAddressValidation: (validation: {
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
}>((set) => ({
  evmConnectWalletChainId: DEFAULT_CONNECT_WALLET_CHAIN_ID,
  setEvmConnectWalletChainId: (chainId: number) => set({ evmConnectWalletChainId: chainId }),
  userTokensByChain: {},
  setUserTokensForChain: (chainId: number, tokens) =>
    set((state) => ({
      userTokensByChain: { ...state.userTokensByChain, [chainId]: tokens },
    })),
  selectedInputToken: {
    name: "Ethereum",
    ticker: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    balance: "0",
    usdValue: "$0.00",
    icon: "https://assets.smold.app/api/chains/1/logo-128.png",
    decimals: 18,
    chainId: 1,
  },
  setSelectedInputToken: (token: TokenData) => set({ selectedInputToken: token }),
  selectedOutputToken: null,
  setSelectedOutputToken: (token: TokenData | null) => set({ selectedOutputToken: token }),
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
  setSwapResponse: (response: CreateSwapResponse | null) => set({ swapResponse: response }),
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
  setCowswapQuote: (quote: QuoteResults | null) => set({ cowswapQuote: quote }),
  rfqQuote: null,
  setRfqQuote: (quote: Quote | null) => set({ rfqQuote: quote }),
  slippageBips: 5,
  setSlippageBips: (value: number) => set({ slippageBips: value }),
  bitcoinDepositInfo: null,
  setBitcoinDepositInfo: (info: { address: string; amount: number; uri: string } | null) =>
    set({ bitcoinDepositInfo: info }),
  payoutAddress: "",
  setPayoutAddress: (address: string) => set({ payoutAddress: address }),
  addressValidation: { isValid: false },
  setAddressValidation: (validation: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }) => set({ addressValidation: validation }),
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
}));
