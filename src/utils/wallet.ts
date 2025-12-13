import { createConfig, createStorage, cookieStorage, http, fallback } from "wagmi";
import { mainnet, base } from "viem/chains";
import { QueryClient } from "@tanstack/react-query";
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

// Set up metadata for your app (can be used by Dynamic if needed)
export const metadata = {
  name: "Rift",
  description: "P2P Bitcoin Trading",
  url: "https://app.rift.trade",
  icons: ["https://app.rift.trade/icon.png"],
};
