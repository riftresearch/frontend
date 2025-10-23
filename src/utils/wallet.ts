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
  description: "Rift",
  url: "https://app.rift.trade",
  icons: ["https://app.rift.trade/icon.png"],
};

// Create the modal
export const reownModal = createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId || "",
  networks,
  metadata,
  features: {
    analytics: true,
    email: true, // Enable email login
    socials: ["google", "apple", "x"], // Enable social logins
    emailShowWallets: true, // Show wallets directly without email prompt
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
