import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit";
import { mainnet, arbitrum, base, type AppKitNetwork } from "@reown/appkit/networks";
import { createStorage, cookieStorage, http, fallback } from "wagmi";
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
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

// Define the networks your app will support - add anvilNetwork as the first network
// TODO: Disable anvilNetwork in production
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  //anvilNetwork,
  // base,
  mainnet,
];

// Create the Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  networks,
  projectId: projectId || "",
  chains: [
    mainnet,
    // base,
    // anvilNetwork
  ],
  transports: {
    [mainnet.id]: fallback([
      http("https://eth.llamarpc.com"),
      http("https://rpc.mevblocker.io"),
      http("https://rpc.flashbots.net"),
      http("https://eth.drpc.org"),
    ]),
    // [base.id]: fallback([
    //   http("https://mainnet.base.org"),
    //   http("https://base.llamarpc.com"),
    //   http("https://base.drpc.org"),
    // ]),
    //[anvilNetwork.id]: http(CHAIN_SCOPED_CONFIGS[anvilNetwork.id].rpcUrl),
  },
});

// Create a query client
export const queryClient = new QueryClient();

// Set up metadata for your app
const metadata = {
  name: "Rift",
  description: "P2P Bitcoin Trading",
  url: "https://app.rift.trade",
  icons: ["https://app.rift.trade/icon.png"],
};

// Create the modal
export const reownModal = createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId || "",
  networks,
  metadata,
  enableWalletGuide: false,
  featuredWalletIds: [
    "a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393",
    "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  ],
  features: {
    analytics: true,
    email: true, // Enable email login
    swaps: false,
    socials: ["google", "apple", "x"], // Enable social logins
    emailShowWallets: true, // Show wallets directly without email prompt
    connectMethodsOrder: ["wallet", "social", "email"],
  },
  allWallets: "SHOW", // Display all available wallets
  enableEIP6963: true, // Enable modern wallet discovery to prevent conflicts
  enableInjected: true, // Ensure injected wallets are enabled
});

// Override the modal open method to prevent it from opening on admin page
const originalOpen = reownModal.open;
reownModal.open = (options?: any) => {
  // Check if we're on admin page
  if (typeof window !== "undefined" && window.location.pathname === "/admin") {
    console.warn("Reown modal blocked on admin page");
    return Promise.resolve();
  }
  return originalOpen.call(reownModal, options);
};
