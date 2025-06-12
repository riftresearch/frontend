import { Navbar } from "@/components/nav/Navbar";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { Flex } from "@chakra-ui/react";

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
