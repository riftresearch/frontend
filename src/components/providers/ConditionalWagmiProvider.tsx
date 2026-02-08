import React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { DynamicContextProvider, SortWallets } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { queryClient, wagmiConfig, dynamicEnvironmentId, getWalletClientConfig } from "@/utils/wallet";
import { useStore } from "@/utils/store";
import { getPaymentAddress } from "@/hooks/useBitcoinTransaction";

// Helper to get the correct address for a wallet (payment address for BTC, default for EVM)
const getWalletDisplayAddress = (wallet: any): string => {
  const chain = wallet.chain?.toUpperCase();
  if ((chain === "BTC" || chain === "BITCOIN") && isBitcoinWallet(wallet)) {
    return getPaymentAddress(wallet);
  }
  return wallet.address;
};

interface ConditionalWagmiProviderProps {
  children: React.ReactNode;
}

export const ConditionalWagmiProvider: React.FC<ConditionalWagmiProviderProps> = ({ children }) => {
  const router = useRouter();
  const setEvmAddress = useStore((state) => state.setEvmAddress);
  const setBtcAddress = useStore((state) => state.setBtcAddress);
  const setEvmWalletClient = useStore((state) => state.setEvmWalletClient);

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
        walletsFilter: SortWallets([
          "phantombtc",
          "metamask",
          "xverse",
          "okxwallet",
          "trust",
          "coinbase",
          "unisat",
          "leather",
          "magiceden",
        ]),
        cssOverrides: `
          .powered-by-dynamic { display: none !important; }
          .dynamic-modal { z-index: 999999 !important; }
          .dynamic-modal-card { 
            z-index: 999999 !important; 
            min-height: 600px !important;
            max-height: 80vh !important;
          }
          .modal-card { 
            z-index: 999999 !important;
            min-height: 600px !important;
          }
          [data-testid="dynamic-modal"] { z-index: 999999 !important; }
          [data-testid="dynamic-modal-card"] { 
            z-index: 999999 !important;
            min-height: 600px !important;
          }
          .wallet-list__scroll-container {
            max-height: 500px !important;
          }
        `,
        events: {
          onWalletAdded: async (args) => {
            const wallet = args.wallet;
            console.log("onWalletAdded", wallet);
            if (wallet) {
              const chain = wallet.chain?.toUpperCase();
              if (chain === "EVM") {
                setEvmAddress(wallet.address);
                // Fetch and set the wallet client with explicit chain config
                try {
                  const config = getWalletClientConfig(wallet.address, 1); // Default to mainnet
                  const client = await (wallet as any).getWalletClient(config);
                  console.log("onWalletAdded: Setting wallet client for", wallet.address);
                  setEvmWalletClient(client);
                } catch (error) {
                  console.error("onWalletAdded: Failed to get wallet client:", error);
                  setEvmWalletClient(null);
                }
              } else if (chain === "BTC" || chain === "BITCOIN") {
                const addr = getWalletDisplayAddress(wallet);
                setBtcAddress(addr);
              }
            }
          },
          onWalletRemoved: (args) => {
            const wallet = args.wallet;
            console.log("onWalletRemoved", wallet);
            if (wallet) {
              const chain = wallet.chain?.toUpperCase();
              if (chain === "EVM") {
                // Only clear if this was the selected EVM wallet
                const currentEvmAddress = useStore.getState().evmAddress;
                if (currentEvmAddress?.toLowerCase() === wallet.address.toLowerCase()) {
                  setEvmAddress(null);
                  setEvmWalletClient(null);
                }
              } else if (chain === "BTC" || chain === "BITCOIN") {
                // Only clear if this was the selected BTC wallet
                const currentBtcAddress = useStore.getState().btcAddress;
                const removedAddr = getWalletDisplayAddress(wallet);
                if (currentBtcAddress?.toLowerCase() === removedAddr.toLowerCase()) {
                  setBtcAddress(null);
                }
              }
            }
          },
        },
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
