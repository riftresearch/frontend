import React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { queryClient, wagmiAdapter } from "@/utils/wallet";

interface ConditionalWagmiProviderProps {
  children: React.ReactNode;
}

export const ConditionalWagmiProvider: React.FC<
  ConditionalWagmiProviderProps
> = ({ children }) => {
  const router = useRouter();

  // Disable Wagmi on admin page to prevent wallet connection prompts
  const isAdminPage = router.pathname === "/admin";

  if (isAdminPage) {
    // Return children without Wagmi provider for admin page
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  // Normal Wagmi setup for all other pages
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
};
