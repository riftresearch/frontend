import { Navbar } from "@/components/nav/Navbar";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { Flex } from "@chakra-ui/react";
import dynamic from "next/dynamic";

const SwapWidget = dynamic(() => import("@/components/swap/SwapWidget").then(mod => ({ default: mod.SwapWidget })), {
  ssr: false,
});

export default function Home() {
  useSyncChainIdToStore();
  return (
    <>
      <Navbar />
      <Flex justify="center" align="center" minH="calc(100vh - 80px)" p="4">
        <SwapWidget />
      </Flex>
    </>
  );
}
