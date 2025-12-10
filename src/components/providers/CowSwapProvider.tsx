"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base } from "viem/chains";
import { CowSwapClient } from "@/utils/cowswapClient";

export interface CowSwapContextValue {
  client: CowSwapClient;
  /** True when using placeholder wallet (no real wallet connected) - quotes are indicative only */
  isIndicative: boolean;
}

const CowSwapContext = createContext<CowSwapContextValue | null>(null);

// Placeholder private key for creating a dummy wallet client before user connects
// This is NOT used for signing real transactions - only as a placeholder
const PLACEHOLDER_PRIVATE_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as const;

const placeholderAccount = privateKeyToAccount(PLACEHOLDER_PRIVATE_KEY);
const placeholderWalletClient = createWalletClient({
  account: placeholderAccount,
  chain: mainnet,
  transport: http(),
});

export function CowSwapProvider({ children }: { children: ReactNode }) {
  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const basePublicClient = usePublicClient({ chainId: base.id });
  const { data: walletClient } = useWalletClient();

  const contextValue = useMemo(() => {
    if (!mainnetPublicClient || !basePublicClient) return null;

    const client = new CowSwapClient({
      mainnetPublicClient,
      basePublicClient,
      walletClient: walletClient ?? placeholderWalletClient,
    });

    return {
      client,
      isIndicative: !walletClient,
    };
  }, [mainnetPublicClient, basePublicClient, walletClient]);

  return <CowSwapContext.Provider value={contextValue}>{children}</CowSwapContext.Provider>;
}

export function useCowSwapClient(): CowSwapClient | null {
  const ctx = useContext(CowSwapContext);
  return ctx?.client ?? null;
}

/** Returns the full context including indicative status */
export function useCowSwapContext(): CowSwapContextValue | null {
  return useContext(CowSwapContext);
}
