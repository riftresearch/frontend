import React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { queryClient, wagmiConfig, dynamicEnvironmentId } from "@/utils/wallet";

interface ConditionalWagmiProviderProps {
  children: React.ReactNode;
}

export const ConditionalWagmiProvider: React.FC<ConditionalWagmiProviderProps> = ({ children }) => {
  const router = useRouter();

  // Disable wallet providers on admin page to prevent wallet connection prompts
  const isAdminPage = router.pathname === "/admin";

  if (isAdminPage) {
    // Return children without wallet providers for admin page
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  // Full Dynamic + Wagmi setup for all other pages
  // Provider order is critical: DynamicContextProvider > WagmiProvider > QueryClientProvider > DynamicWagmiConnector
  return (
    <DynamicContextProvider
      theme="dark"
      settings={{
        environmentId: dynamicEnvironmentId,
        walletConnectors: [EthereumWalletConnectors, BitcoinWalletConnectors],
        cssOverrides: `.powered-by-dynamic { display: none !important; }`,
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
};
