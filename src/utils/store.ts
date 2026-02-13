import { create } from "zustand";
import { Swap } from "./riftApiClient";
import { TokenData, ApprovalState, FeeOverview } from "./types";
import type { WalletClient } from "viem";
import type { RiftSdk } from "@riftresearch/sdk";

// Inline to avoid circular dependency with constants.ts
const DEFAULT_INPUT_TOKEN: TokenData = {
  name: "Ethereum",
  ticker: "ETH",
  address: "0x0000000000000000000000000000000000000000",
  balance: "0",
  usdValue: "$0.00",
  icon: "https://assets.smold.app/api/chains/1/logo-128.png",
  decimals: 18,
  chain: 1,
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
  chain: "bitcoin",
};

type DepositFlowState =
  | "not_started"
  | "waiting_for_deposit"
  | "deposit_confirming"
  | "initiating_transfer"
  | "confirming_transfer"
  | "swap_complete"
  | "refunding_user"
  | "failed";

type EvmChainId = 1 | 8453;
type EvmWalletClientByChain = Record<EvmChainId, WalletClient | null>;

export const useStore = create<{
  primaryEvmAddress: string | null;
  setPrimaryEvmAddress: (address: string | null) => void;
  outputEvmAddress: string | null;
  setOutputEvmAddress: (address: string | null) => void;
  btcAddress: string | null;
  setBtcAddress: (address: string | null) => void;
  evmWalletClients: Record<string, EvmWalletClientByChain>;
  setEvmWalletClientsForAddress: (address: string, clients: EvmWalletClientByChain) => void;
  setEvmWalletClientForAddress: (
    address: string,
    chainId: EvmChainId,
    client: WalletClient | null
  ) => void;
  removeEvmWalletClientsForAddress: (address: string) => void;
  clearEvmWalletClients: () => void;
  userTokensByChain: Record<number, TokenData[]>;
  setUserTokensForChain: (chainId: number, tokens: TokenData[]) => void;
  inputToken: TokenData;
  setInputToken: (token: TokenData) => void;
  outputToken: TokenData;
  setOutputToken: (token: TokenData) => void;
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
  inputTokenPrice: number | null;
  setInputTokenPrice: (price: number | null) => void;
  outputTokenPrice: number | null;
  setOutputTokenPrice: (price: number | null) => void;
  inputUsdValue: string;
  setInputUsdValue: (value: string) => void;
  outputUsdValue: string;
  setOutputUsdValue: (value: string) => void;
  quote: any | null;
  setQuote: (quote: any | null) => void;
  rift: RiftSdk | null;
  setRift: (rift: RiftSdk | null) => void;
  executeSwap: ((params: any) => Promise<any>) | null;
  setExecuteSwap: (fn: ((params: any) => Promise<any>) | null) => void;
  activeSwapId: string | null;
  setActiveSwapId: (id: string | null) => void;
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
  exceedsAvailableLiquidity: boolean;
  setExceedsAvailableLiquidity: (value: boolean) => void;
  maxAvailableLiquidity: string | null;
  setMaxAvailableLiquidity: (value: string | null) => void;
  refetchQuote: boolean;
  setRefetchQuote: (value: boolean) => void;
  isAwaitingOptimalQuote: boolean;
  setIsAwaitingOptimalQuote: (value: boolean) => void;
  switchingToInputTokenChain: boolean;
  setSwitchingToInputTokenChain: (value: boolean) => void;
  selectedInputAddress: string | null;
  setSelectedInputAddress: (address: string | null) => void;
  selectedOutputAddress: string | null;
  setSelectedOutputAddress: (address: string | null) => void;
  skipAddressClearOnDirectionChange: boolean;
  setSkipAddressClearOnDirectionChange: (value: boolean) => void;
  isSwapInProgress: boolean;
  setIsSwapInProgress: (value: boolean) => void;
}>((set) => ({
  primaryEvmAddress: null,
  setPrimaryEvmAddress: (address: string | null) => set({ primaryEvmAddress: address }),
  outputEvmAddress: null,
  setOutputEvmAddress: (address: string | null) => set({ outputEvmAddress: address }),
  btcAddress: null,
  setBtcAddress: (address: string | null) => set({ btcAddress: address }),
  evmWalletClients: {},
  setEvmWalletClientsForAddress: (address: string, clients: EvmWalletClientByChain) =>
    set((state) => ({
      evmWalletClients: { ...state.evmWalletClients, [address.toLowerCase()]: clients },
    })),
  setEvmWalletClientForAddress: (
    address: string,
    chainId: EvmChainId,
    client: WalletClient | null
  ) =>
    set((state) => {
      const key = address.toLowerCase();
      const existing = state.evmWalletClients[key] || { 1: null, 8453: null };
      return {
        evmWalletClients: {
          ...state.evmWalletClients,
          [key]: {
            ...existing,
            [chainId]: client,
          },
        },
      };
    }),
  removeEvmWalletClientsForAddress: (address: string) =>
    set((state) => {
      const key = address.toLowerCase();
      const { [key]: _removed, ...rest } = state.evmWalletClients;
      return { evmWalletClients: rest };
    }),
  clearEvmWalletClients: () => set({ evmWalletClients: {} }),
  userTokensByChain: {},
  setUserTokensForChain: (chainId: number, tokens) =>
    set((state) => ({
      userTokensByChain: { ...state.userTokensByChain, [chainId]: tokens },
    })),
  inputToken: DEFAULT_INPUT_TOKEN,
  setInputToken: (token: TokenData) => set({ inputToken: token }),
  outputToken: DEFAULT_OUTPUT_TOKEN,
  setOutputToken: (token: TokenData) => set({ outputToken: token }),
  displayedInputAmount: "",
  setDisplayedInputAmount: (value: string) => set({ displayedInputAmount: value }),
  fullPrecisionInputAmount: null,
  setFullPrecisionInputAmount: (value: string | null) => set({ fullPrecisionInputAmount: value }),
  outputAmount: "",
  setOutputAmount: (value: string) => set({ outputAmount: value }),
  searchResults: [],
  setSearchResults: (tokens: TokenData[]) => set({ searchResults: tokens }),
  depositFlowState: "not_started",
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
  inputTokenPrice: null,
  setInputTokenPrice: (price: number | null) => set({ inputTokenPrice: price }),
  outputTokenPrice: null,
  setOutputTokenPrice: (price: number | null) => set({ outputTokenPrice: price }),
  inputUsdValue: "$0.00",
  setInputUsdValue: (value: string) => set({ inputUsdValue: value }),
  outputUsdValue: "$0.00",
  setOutputUsdValue: (value: string) => set({ outputUsdValue: value }),
  quote: null,
  setQuote: (quote: any | null) => set({ quote }),
  rift: null,
  setRift: (rift: RiftSdk | null) => set({ rift }),
  executeSwap: null,
  setExecuteSwap: (fn: ((params: any) => Promise<any>) | null) => set({ executeSwap: fn }),
  activeSwapId: null,
  setActiveSwapId: (id: string | null) => set({ activeSwapId: id }),
  slippageBips: 100,
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
  exceedsAvailableLiquidity: false,
  setExceedsAvailableLiquidity: (value: boolean) => set({ exceedsAvailableLiquidity: value }),
  maxAvailableLiquidity: null,
  setMaxAvailableLiquidity: (value: string | null) => set({ maxAvailableLiquidity: value }),
  refetchQuote: false,
  setRefetchQuote: (value: boolean) => set({ refetchQuote: value }),
  isAwaitingOptimalQuote: false,
  setIsAwaitingOptimalQuote: (value: boolean) => set({ isAwaitingOptimalQuote: value }),
  switchingToInputTokenChain: false,
  setSwitchingToInputTokenChain: (value: boolean) => set({ switchingToInputTokenChain: value }),
  selectedInputAddress: null,
  setSelectedInputAddress: (address: string | null) => set({ selectedInputAddress: address }),
  selectedOutputAddress: null,
  setSelectedOutputAddress: (address: string | null) => set({ selectedOutputAddress: address }),
  skipAddressClearOnDirectionChange: false,
  setSkipAddressClearOnDirectionChange: (value: boolean) =>
    set({ skipAddressClearOnDirectionChange: value }),
  isSwapInProgress: false,
  setIsSwapInProgress: (value: boolean) => set({ isSwapInProgress: value }),
}));
