import { createConfig, createStorage, cookieStorage, http, fallback } from "wagmi";
import { mainnet, base } from "viem/chains";
import { QueryClient } from "@tanstack/react-query";
import type { WalletClient } from "viem";
import type { Chain } from "viem/chains";

// Define a custom Anvil network for local development
export const anvilNetwork: Chain = {
  id: 1337,
  name: "Rift Devnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://localhost:50101"],
    },
  },
  blockExplorers: {
    default: {
      name: "Anvil Explorer",
      url: "http://localhost:50101",
    },
  },
  testnet: true,
};

// Dynamic environment ID (Live environment)
export const dynamicEnvironmentId =
  process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || "77346493-99a4-4378-8602-e14ee71821c7";

// Define the networks your app will support
export const networks = [mainnet, base] as const;

// Create the Wagmi config (standard Wagmi, not Reown adapter)
export const wagmiConfig = createConfig({
  chains: [mainnet, base],
  multiInjectedProviderDiscovery: false, // Dynamic handles wallet discovery
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [mainnet.id]: fallback([
      http("https://rpc.mevblocker.io"),
      http("https://rpc.flashbots.net"),
      http("https://eth.drpc.org"),
    ]),
    [base.id]: fallback([http("https://mainnet.base.org"), http("https://base.drpc.org")]),
  },
});

// Create a query client
export const queryClient = new QueryClient();

// RPC URLs for wallet client configuration
export const RPC_URLS: Record<number, string> = {
  1: "https://rpc.mevblocker.io", // Ethereum mainnet
  8453: "https://mainnet.base.org", // Base
};

/**
 * Get wallet client configuration for a given chainId
 * Used when calling Dynamic's getWalletClient with explicit chain config
 */
export function getWalletClientConfig(accountAddress: string, chainId: number = 1) {
  const rpcUrl = RPC_URLS[chainId] || RPC_URLS[1];
  return {
    accountAddress,
    chainId,
    rpcUrl,
  };
}

const MOBILE_PROVIDER_NOT_READY_ERROR = "SDK state invalid -- undefined mobile provider";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getMetaMaskSdkInitPromise = (wallet: any): Promise<unknown> | null => {
  const connector = wallet?.connector ?? wallet?._connector;
  const sdkInitPromise = connector?.metaMaskSDK?.sdkInitPromise;
  return typeof sdkInitPromise?.then === "function" ? sdkInitPromise : null;
};

/**
 * Dynamic's MetaMask connector can race on hydration, where getWalletClient is called
 * before the SDK provider is fully initialized. Wait for SDK init and retry transient failures.
 */
export async function getDynamicWalletClient(
  wallet: any,
  accountAddress: string,
  chainId: number = 1,
  maxRetries: number = 5
): Promise<WalletClient | null> {
  const sdkInitPromise = getMetaMaskSdkInitPromise(wallet);
  if (sdkInitPromise) {
    await sdkInitPromise;
  }

  const config = getWalletClientConfig(accountAddress, chainId);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const client = await wallet.getWalletClient(config);
      return client ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = message.includes(MOBILE_PROVIDER_NOT_READY_ERROR);
      const isLastAttempt = attempt === maxRetries;

      if (!shouldRetry || isLastAttempt) {
        throw error;
      }

      await wait(200 * (attempt + 1));
    }
  }

  return null;
}

// Set up metadata for your app (can be used by Dynamic if needed)
export const metadata = {
  name: "Rift",
  description: "P2P Bitcoin Trading",
  url: "https://app.rift.trade",
  icons: ["https://app.rift.trade/icon.png"],
};
