"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { mainnet, base } from "viem/chains";
import { CowSwapClient } from "@/utils/cowswapClient";

const CowSwapContext = createContext<CowSwapClient | null>(null);

export function CowSwapProvider({ children }: { children: ReactNode }) {
  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const basePublicClient = usePublicClient({ chainId: base.id });
  const { data: walletClient } = useWalletClient();

  const client = useMemo(() => {
    if (!mainnetPublicClient || !basePublicClient) return null;

    return new CowSwapClient({
      mainnetPublicClient,
      basePublicClient,
      walletClient: walletClient ?? undefined,
    });
  }, [mainnetPublicClient, basePublicClient, walletClient]);

  return <CowSwapContext.Provider value={client}>{children}</CowSwapContext.Provider>;
}

export function useCowSwapClient() {
  const ctx = useContext(CowSwapContext);
  return ctx; // may be null if publicClient not ready yet
}
