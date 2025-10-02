import "@/styles/globals.css";
import "@/styles/custom-fonts.css";
import { ChakraProvider } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import theme from "@/components/other/Theme";
import { CustomToastProvider } from "@/components/other/CustomToastProvider";
import { ConditionalWagmiProvider } from "@/components/providers/ConditionalWagmiProvider";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <ConditionalWagmiProvider>
        <ChakraProvider value={theme}>
          <CustomToastProvider />
          <Component {...pageProps} />
        </ChakraProvider>
      </ConditionalWagmiProvider>
    </>
  );
}
