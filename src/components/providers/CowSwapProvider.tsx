"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base } from "viem/chains";
import { CowSwapClient } from "@/utils/cowswapClient";

const CowSwapContext = createContext<CowSwapClient | null>(null);

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

  const client = useMemo(() => {
    if (!mainnetPublicClient || !basePublicClient) return null;

    return new CowSwapClient({
      mainnetPublicClient,
      basePublicClient,
      walletClient: walletClient ?? placeholderWalletClient,
    });
  }, [mainnetPublicClient, basePublicClient, walletClient]);

  return <CowSwapContext.Provider value={client}>{children}</CowSwapContext.Provider>;
}

export function useCowSwapClient() {
  const ctx = useContext(CowSwapContext);
  return ctx; // may be null if publicClient not ready yet
}
