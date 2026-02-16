import "@/styles/globals.css";
import "@/styles/custom-fonts.css";
import { useEffect } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import theme from "@/components/other/Theme";
import { CustomToastProvider } from "@/components/other/CustomToastProvider";
import { DynamicProvider } from "@/components/providers/DynamicProvider";
import { RiftSdk } from "@riftresearch/sdk";
import { useStore } from "@/utils/store";

export default function App({ Component, pageProps }: AppProps) {
  const rift = useStore((state) => state.rift);
  const setRift = useStore((state) => state.setRift);

  // Initialize Rift SDK globally so it's available on all pages
  useEffect(() => {
    if (!rift) {
      const sdk = new RiftSdk({
        integratorName: "app.rift.trade",
        debug: true,
      });
      setRift(sdk);
    }
  }, [rift, setRift]);

  return (
    <DynamicProvider>
      <ChakraProvider value={theme}>
        <CustomToastProvider />
        <Component {...pageProps} />
      </ChakraProvider>
    </DynamicProvider>
  );
}
