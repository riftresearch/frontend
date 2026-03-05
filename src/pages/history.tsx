import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { Flex } from "@chakra-ui/react";
import { UserSwapHistory } from "@/components/activity/UserSwapHistory";
import { StatsOverview } from "@/components/other/StatsOverview";
import useWindowSize from "@/hooks/useWindowSize";
import { useState } from "react";

export default function History() {
  const { isMobile } = useWindowSize();
  const [showStats, setShowStats] = useState(false);

  useSyncChainIdToStore();
  useBtcEthPrices(); // Fetch BTC/ETH prices for liquidity display

  // Show stats once initial loading completes
  const handleInitialLoadComplete = () => {
    setShowStats(true);
  };

  return (
    <>
      <OpenGraph />
      <Flex
        minH="100vh"
        width="100%"
        direction="column"
        backgroundImage="url('/images/rift_background_low.webp')"
        backgroundSize="cover"
        backgroundPosition="center"
        zIndex={0}
      >
        <Navbar />
        <Flex
          direction="column"
          align="center"
          justify="center"
          alignSelf="center"
          w="100%"
          maxW="1400px"
          px="20px"
          py="20px"
          flex="1"
        >
          <UserSwapHistory onInitialLoadComplete={handleInitialLoadComplete} />

          {/* Stats Overview at bottom - only show after initial spinner completes */}
          {showStats && (
            <Flex w="100%" maxW="1400px" mt={isMobile ? "10px" : "15px"} mb="40px">
              <StatsOverview />
            </Flex>
          )}
        </Flex>
        {process.env.NEXT_PUBLIC_FAKE_OTC === "true" ||
        process.env.NEXT_PUBLIC_FAKE_RFQ === "true" ? null : (
          <TEEStatusFooter />
        )}
      </Flex>
    </>
  );
}
