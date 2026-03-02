import React, { useCallback, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/router";
import {
  DynamicContextProvider,
  SortWallets,
  useDynamicContext,
  useDynamicEvents,
  useSwitchWallet,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import type { Wallet } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { BitcoinWalletConnectors, isBitcoinWallet } from "@dynamic-labs/bitcoin";
import {
  queryClient,
  wagmiConfig,
  dynamicEnvironmentId,
  getDynamicWalletClient,
} from "@/utils/wallet";
import { useStore } from "@/utils/store";
import { getPaymentAddress, getAllBtcAddresses } from "@/hooks/useBitcoinTransaction";

const EVM_CHAIN_IDS = [1, 8453] as const;

const isEvmWallet = (wallet: Wallet | null | undefined) => wallet?.chain?.toUpperCase() === "EVM";

const isBtcWalletLike = (wallet: Wallet | null | undefined) => {
  const chain = wallet?.chain?.toUpperCase();
  return chain === "BTC" || chain === "BITCOIN";
};

const getWalletDisplayAddress = (wallet: Wallet): string => {
  const chain = wallet.chain?.toUpperCase();
  if ((chain === "BTC" || chain === "BITCOIN") && isBitcoinWallet(wallet)) {
    return getPaymentAddress(wallet);
  }
  return wallet.address;
};

const DynamicWalletSync = () => {
  const userWallets = useUserWallets();
  const switchWallet = useSwitchWallet();
  const { primaryWallet } = useDynamicContext();

  const setPrimaryEvmAddress = useStore((state) => state.setPrimaryEvmAddress);
  const setOutputEvmAddress = useStore((state) => state.setOutputEvmAddress);
  const setBtcAddress = useStore((state) => state.setBtcAddress);
  const setEvmWalletClientsForAddress = useStore((state) => state.setEvmWalletClientsForAddress);
  const removeEvmWalletClientsForAddress = useStore(
    (state) => state.removeEvmWalletClientsForAddress
  );
  const clearEvmWalletClients = useStore((state) => state.clearEvmWalletClients);

  const buildWalletClientForPrimary = useCallback(
    async (wallet: Wallet, force: boolean = false) => {
      if (!isEvmWallet(wallet)) {
        return;
      }

      const addressKey = wallet.address.toLowerCase();
      const existingClients = useStore.getState().evmWalletClients[addressKey];
      const hasValidMainnetClient = existingClients?.[1]?.chain?.id === 1;
      const hasValidBaseClient = existingClients?.[8453]?.chain?.id === 8453;
      if (!force && hasValidMainnetClient && hasValidBaseClient) {
        return;
      }

      const [mainnetClient, baseClient] = await Promise.all(
        EVM_CHAIN_IDS.map(async (chainId) => {
          try {
            return await getDynamicWalletClient(wallet, wallet.address, chainId);
          } catch (error) {
            console.error(
              `[DynamicWalletSync] Failed to get wallet client for ${wallet.address} on ${chainId}:`,
              error
            );
            return null;
          }
        })
      );

      console.log(
        "[DynamicWalletSync] Building wallet clients for",
        wallet.address,
        mainnetClient,
        baseClient
      );
      setEvmWalletClientsForAddress(addressKey, {
        1: mainnetClient,
        8453: baseClient,
      });
    },
    [setEvmWalletClientsForAddress]
  );

  const updateConnectedWallets = useCallback(async () => {
    const evmWallets = userWallets.filter((wallet) => isEvmWallet(wallet));
    const btcWallets = userWallets.filter((wallet) => isBtcWalletLike(wallet));

    if (evmWallets.length === 0) {
      setPrimaryEvmAddress(null);
      setOutputEvmAddress(null);
      clearEvmWalletClients();
    } else {
      await Promise.all(evmWallets.map((wallet) => buildWalletClientForPrimary(wallet)));

      const connectedEvmAddresses = new Set(
        evmWallets.map((wallet) => wallet.address.toLowerCase())
      );
      Object.keys(useStore.getState().evmWalletClients).forEach((cachedAddress) => {
        if (!connectedEvmAddresses.has(cachedAddress)) {
          removeEvmWalletClientsForAddress(cachedAddress);
        }
      });

      if (primaryWallet && isEvmWallet(primaryWallet)) {
        setPrimaryEvmAddress(primaryWallet.address);
      } else {
        const currentPrimaryEvmAddress = useStore.getState().primaryEvmAddress;
        const currentPrimaryWallet = currentPrimaryEvmAddress
          ? evmWallets.find(
              (wallet) => wallet.address.toLowerCase() === currentPrimaryEvmAddress.toLowerCase()
            )
          : undefined;

        if (currentPrimaryWallet) {
          setPrimaryEvmAddress(currentPrimaryWallet.address);
        } else {
          const fallbackWallet = evmWallets[0];
          setPrimaryEvmAddress(fallbackWallet.address);
          try {
            await switchWallet(fallbackWallet.id);
          } catch (error) {
            console.error("[DynamicWalletSync] Failed to restore primary EVM wallet:", error);
          }
        }
      }

      const currentOutputEvmAddress = useStore.getState().outputEvmAddress;
      if (
        currentOutputEvmAddress &&
        !evmWallets.some(
          (wallet) => wallet.address.toLowerCase() === currentOutputEvmAddress.toLowerCase()
        )
      ) {
        setOutputEvmAddress(null);
      }
    }

    if (btcWallets.length === 0) {
      setBtcAddress(null);
      return;
    }

    // Get ALL BTC addresses including Taproot, Segwit, etc. from all connected wallets
    const allConnectedBtcAddresses = btcWallets.flatMap((wallet) => {
      if (isBitcoinWallet(wallet)) {
        return getAllBtcAddresses(wallet);
      }
      return [wallet.address];
    });
    
    const currentBtcAddress = useStore.getState().btcAddress;
    if (
      !currentBtcAddress ||
      !allConnectedBtcAddresses.some(
        (address) => address.toLowerCase() === currentBtcAddress.toLowerCase()
      )
    ) {
      // Default to first address (usually the primary/payment address)
      setBtcAddress(allConnectedBtcAddresses[0]);
    }
  }, [
    userWallets,
    primaryWallet,
    clearEvmWalletClients,
    buildWalletClientForPrimary,
    removeEvmWalletClientsForAddress,
    setBtcAddress,
    setOutputEvmAddress,
    setPrimaryEvmAddress,
    switchWallet,
  ]);

  useEffect(() => {
    void updateConnectedWallets();
  }, [updateConnectedWallets]);

  useDynamicEvents("walletAdded", async (newWallet) => {
    if (isEvmWallet(newWallet)) {
      await buildWalletClientForPrimary(newWallet);

      const currentPrimaryEvmAddress = useStore.getState().primaryEvmAddress;
      if (!currentPrimaryEvmAddress) {
        setPrimaryEvmAddress(newWallet.address);
        try {
          await switchWallet(newWallet.id);
        } catch (error) {
          console.error("[DynamicWalletSync] Failed to set first EVM wallet as primary:", error);
        }
      }
    }

    if (isBtcWalletLike(newWallet)) {
      setBtcAddress(getWalletDisplayAddress(newWallet));
    }

    await updateConnectedWallets();
  });

  useDynamicEvents("walletRemoved", async (removedWallet) => {
    if (isEvmWallet(removedWallet)) {
      removeEvmWalletClientsForAddress(removedWallet.address);
    }

    if (isBtcWalletLike(removedWallet)) {
      const currentBtcAddress = useStore.getState().btcAddress;
      const removedBtcAddress = getWalletDisplayAddress(removedWallet);
      if (currentBtcAddress?.toLowerCase() === removedBtcAddress.toLowerCase()) {
        setBtcAddress(null);
      }
    }

    await updateConnectedWallets();
  });

  useDynamicEvents("primaryWalletChanged", async (newPrimaryWallet) => {
    if (isEvmWallet(newPrimaryWallet)) {
      setPrimaryEvmAddress(newPrimaryWallet.address);
      await buildWalletClientForPrimary(newPrimaryWallet, true);
    }
  });

  useDynamicEvents("primaryWalletNetworkChanged", async () => {
    const latestPrimaryWallet = useStore.getState().primaryEvmAddress?.toLowerCase();
    if (!latestPrimaryWallet) {
      return;
    }

    const wallet = userWallets.find(
      (candidate) =>
        isEvmWallet(candidate) && candidate.address.toLowerCase() === latestPrimaryWallet
    );

    if (wallet) {
      await buildWalletClientForPrimary(wallet, true);
    }
  });

  useDynamicEvents("userWalletsChanged", async () => {
    await updateConnectedWallets();
  });

  return null;
};

interface DynamicProviderProps {
  children: React.ReactNode;
}

export const DynamicProvider: React.FC<DynamicProviderProps> = ({ children }) => {
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
      }}
    >
      <DynamicWalletSync />
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
};
