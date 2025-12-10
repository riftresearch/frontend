import React from "react";
import { Flex, Text, Spinner } from "@chakra-ui/react";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore } from "@/utils/store";
import { MaintenanceBanner } from "@/components/other/MaintenanceBanner";
import { IS_FRONTEND_PAUSED } from "@/utils/constants";
import { RatesSwapWidget } from "@/components/swap/RatesSwapWidget";
import { GridFlex } from "@/components/other/GridFlex";
import { colorsAnalytics } from "@/utils/colorsAnalytics";

export default function Rates() {
  const { isMobile, isWindowValid } = useWindowSize();
  const { isOtcServerDead } = useStore();

  useSyncChainIdToStore();

  // Show loading spinner while determining window size to prevent flash
  if (!isWindowValid) {
    return (
      <>
        <OpenGraph />
        <Flex
          h="100vh"
          width="100%"
          justify="center"
          align="center"
          backgroundImage="url('/images/rift_background_low.webp')"
          backgroundSize="cover"
          backgroundPosition="center"
        >
          <Spinner size="lg" color="white" />
        </Flex>
      </>
    );
  }

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
          justify="flex-start"
          alignSelf="center"
          w="100%"
          maxW="1400px"
          px="20px"
          py="20px"
          flex="1"
          mt={isMobile ? "80px" : "100px"}
        >
          {/* Title Section */}
          <GridFlex
            w="100%"
            maxW="900px"
            contentPadding={isMobile ? "20px" : "32px"}
            borderRadius="40px"
            mb="15px"
          >
            <Flex direction="column" w="100%" align="center">
              <Text
                fontSize={isMobile ? "24px" : "30px"}
                mt={isMobile ? "-8px" : "-15px"}
                fontFamily={FONT_FAMILIES.NOSTROMO}
                color={colorsAnalytics.offWhite}
                textAlign="center"
              >
                Compare Rates
              </Text>
              <Text
                fontSize={isMobile ? "13px" : "13px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colorsAnalytics.textGray}
                mt="-2px"
                mb="-9px"
                letterSpacing="-0.5px"
                textAlign="center"
              >
                Compare rates across different platforms
              </Text>
            </Flex>
          </GridFlex>

          {/* Horizontal Swap Widget */}
          <RatesSwapWidget />
        </Flex>
        {process.env.NEXT_PUBLIC_FAKE_OTC === "true" ||
        process.env.NEXT_PUBLIC_FAKE_RFQ === "true" ? null : (
          <TEEStatusFooter />
        )}
        {(isOtcServerDead || IS_FRONTEND_PAUSED) && <MaintenanceBanner />}
      </Flex>
    </>
  );
}
