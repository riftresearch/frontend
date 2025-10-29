import { create } from "zustand";
import { CreateSwapResponse } from "./otcClient";
import { TokenData, PermitAllowance, PermitDataForSwap, ApprovalState } from "./types";
import { Quote } from "./rfqClient";
import { UniswapQuoteResponse } from "./uniswapRouter";
import { FeeOverview } from "./swapHelpers";

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

export const DEFAULT_CONNECT_WALLET_CHAIN_ID = 1;

export const useStore = create<{
  evmConnectWalletChainId: number;
  setEvmConnectWalletChainId: (chainId: number) => void;
  userTokensByChain: Record<number, TokenData[]>;
  setUserTokensForChain: (chainId: number, tokens: TokenData[]) => void;
  selectedInputToken: TokenData | null;
  setSelectedInputToken: (token: TokenData | null) => void;
  selectedOutputToken: TokenData | null;
  setSelectedOutputToken: (token: TokenData | null) => void;
  isSwappingForBTC: boolean;
  setIsSwappingForBTC: (value: boolean) => void;
  rawInputAmount: string;
  setRawInputAmount: (value: string) => void;
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
  uniswapQuote: UniswapQuoteResponse | null;
  setUniswapQuote: (quote: UniswapQuoteResponse | null) => void;
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
  permitAllowance: PermitAllowance | null;
  setPermitAllowance: (allowance: PermitAllowance | null) => void;
  permitDataForSwap: PermitDataForSwap | null;
  setPermitDataForSwap: (data: PermitDataForSwap | null) => void;
  approvalState: ApprovalState;
  setApprovalState: (state: ApprovalState) => void;
  feeOverview: FeeOverview | null;
  setFeeOverview: (overview: FeeOverview | null) => void;
  isOtcServerDead: boolean;
  setIsOtcServerDead: (value: boolean) => void;
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
}>((set) => ({
  evmConnectWalletChainId: DEFAULT_CONNECT_WALLET_CHAIN_ID,
  setEvmConnectWalletChainId: (chainId: number) => set({ evmConnectWalletChainId: chainId }),
  userTokensByChain: {},
  setUserTokensForChain: (chainId: number, tokens) =>
    set((state) => ({
      userTokensByChain: { ...state.userTokensByChain, [chainId]: tokens },
    })),
  selectedInputToken: null,
  setSelectedInputToken: (token: TokenData | null) => set({ selectedInputToken: token }),
  selectedOutputToken: null,
  setSelectedOutputToken: (token: TokenData | null) => set({ selectedOutputToken: token }),
  isSwappingForBTC: true,
  setIsSwappingForBTC: (value: boolean) => set({ isSwappingForBTC: value }),
  rawInputAmount: "",
  setRawInputAmount: (value: string) => set({ rawInputAmount: value }),
  fullPrecisionInputAmount: null,
  setFullPrecisionInputAmount: (value: string | null) => set({ fullPrecisionInputAmount: value }),
  outputAmount: "",
  setOutputAmount: (value: string) => set({ outputAmount: value }),
  searchResults: [],
  setSearchResults: (tokens: TokenData[]) => set({ searchResults: tokens }),
  depositFlowState: "0-not-started",
  setDepositFlowState: (s: DepositFlowState) => set({ depositFlowState: s }),
  countdownValue: 60,
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
  uniswapQuote: null,
  setUniswapQuote: (quote: UniswapQuoteResponse | null) => set({ uniswapQuote: quote }),
  rfqQuote: null,
  setRfqQuote: (quote: Quote | null) => set({ rfqQuote: quote }),
  slippageBips: 10,
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
  permitAllowance: null,
  setPermitAllowance: (allowance: PermitAllowance | null) => set({ permitAllowance: allowance }),
  permitDataForSwap: null,
  setPermitDataForSwap: (data: PermitDataForSwap | null) => set({ permitDataForSwap: data }),
  approvalState: ApprovalState.UNKNOWN,
  setApprovalState: (state: ApprovalState) => set({ approvalState: state }),
  feeOverview: null,
  setFeeOverview: (overview: FeeOverview | null) => set({ feeOverview: overview }),
  isOtcServerDead: false,
  setIsOtcServerDead: (value: boolean) => set({ isOtcServerDead: value }),
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
}));
