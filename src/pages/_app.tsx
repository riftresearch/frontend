import "@/styles/globals.css";
import "@/styles/custom-fonts.css";
import { queryClient, wagmiAdapter } from "@/utils/wallet";
import { ChakraProvider } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import theme from "@/components/other/Theme";
import { CustomToastProvider } from "@/components/other/CustomToastProvider";
import { registerBundlerAddresses } from "@/hooks/useRegisterBundlerAddresses";

// Initialize bundler address registration
registerBundlerAddresses();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ChakraProvider value={theme}>
            <CustomToastProvider />
            <Component {...pageProps} />
          </ChakraProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </>
  );
}
