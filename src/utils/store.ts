import { create } from "zustand";
import { CHAIN_SCOPED_CONFIGS } from "./constants";
import { ChainScopedConfig, TokenStyle, ValidAsset } from "./types";

type DepositFlowState =
  | "0-not-started"
  | "1-finding-liquidity"
  | "2-awaiting-payment"
  | "3-payment-recieved";

const DEFAULT_CHAIN_ID = 1;

export const useStore = create<{
  connectedChainId: number;
  setConnectedChainId: (connectedChainId: number) => void;
  selectedChainConfig: ChainScopedConfig;
  depositFlowState: DepositFlowState;
  setDepositFlowState: (s: DepositFlowState) => void;
}>((set) => ({
  connectedChainId: DEFAULT_CHAIN_ID,
  setConnectedChainId: (connectedChainId) =>
    set({
      connectedChainId,
      selectedChainConfig: CHAIN_SCOPED_CONFIGS[connectedChainId],
    }),
  selectedChainConfig: CHAIN_SCOPED_CONFIGS[DEFAULT_CHAIN_ID],
  depositFlowState: "0-not-started",
  setDepositFlowState: (s: DepositFlowState) => set({ depositFlowState: s }),
}));
