"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { mainnet } from "viem/chains";
import { CowSwapClient } from "@/utils/cowswapClient";

const CowSwapContext = createContext<CowSwapClient | null>(null);

export function CowSwapProvider({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { data: walletClient } = useWalletClient();

  const client = useMemo(() => {
    if (!publicClient) return null;

    return new CowSwapClient({
      publicClient,
      walletClient: walletClient ?? undefined,
    });
  }, [publicClient, walletClient]);

  return <CowSwapContext.Provider value={client}>{children}</CowSwapContext.Provider>;
}

export function useCowSwapClient() {
  const ctx = useContext(CowSwapContext);
  return ctx; // may be null if publicClient not ready yet
}

