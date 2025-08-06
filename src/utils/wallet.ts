import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit";
import {
  mainnet,
  arbitrum,
  base,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { createStorage, cookieStorage, http } from "wagmi";
import { QueryClient } from "@tanstack/react-query";
import { GLOBAL_CONFIG } from "./constants";

// Define a custom Anvil network for local development
export const anvilNetwork: AppKitNetwork = {
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
    public: {
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
  contracts: {},
};

// Change this to your actual project ID from Reown Cloud
export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
  "03057a73ca14c5d45baef6dfe54a15ee";

// Define the networks your app will support - add anvilNetwork as the first network
// TODO: Disable anvilNetwork in production
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  //anvilNetwork,
  //base,
  mainnet,
];

// Create the Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  networks,
  projectId,
  chains: [mainnet /*base, anvilNetwork*/],
  transports: {
    //[base.id]: http(CHAIN_SCOPED_CONFIGS[base.id].rpcUrl),
    [mainnet.id]: http(GLOBAL_CONFIG.mainnetRpcUrl),
    //[anvilNetwork.id]: http(CHAIN_SCOPED_CONFIGS[anvilNetwork.id].rpcUrl),
  },
});

// Create a query client
export const queryClient = new QueryClient();

// Set up metadata for your app
const metadata = {
  name: "Rift Exchange",
  description: "Rift Hyperbridge - Exchange",
  url: "https://exchange.rift.exchange",
  icons: ["https://exchange.rift.exchange/icon.png"],
};

// Create the modal
export const reownModal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  features: {
    analytics: true,
  },
});
