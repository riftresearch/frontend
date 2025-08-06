import { create } from "zustand";

type DepositFlowState =
  | "0-not-started"
  | "WaitingUserDepositInitiated"
  | "WaitingUserDepositConfirmed"
  | "WaitingMMDepositInitiated"
  | "WaitingMMDepositConfirmed"
  | "Settled"
  | "RefundingUser"
  | "RefundingMM"
  | "Failed";

export const DEFAULT_CONNECT_WALLET_CHAIN_ID = 1;

export const useStore = create<{
  evmConnectWalletChainId: number;
  setEvmConnectWalletChainId: (chainId: number) => void;
  depositFlowState: DepositFlowState;
  setDepositFlowState: (s: DepositFlowState) => void;
  countdownValue: number;
  setCountdownValue: (value: number) => void;
}>((set) => ({
  evmConnectWalletChainId: DEFAULT_CONNECT_WALLET_CHAIN_ID,
  setEvmConnectWalletChainId: (chainId: number) =>
    set({ evmConnectWalletChainId: chainId }),
  depositFlowState: "0-not-started",
  setDepositFlowState: (s: DepositFlowState) => set({ depositFlowState: s }),
  countdownValue: 10,
  setCountdownValue: (value: number) => set({ countdownValue: value }),
}));
