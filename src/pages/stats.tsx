import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { Flex, Text } from "@chakra-ui/react";
import { StatsOverview } from "@/components/other/StatsOverview";
import { VolumeTxnChart } from "@/components/charts/VolumeTxnChart";
import { GridFlex } from "@/components/other/GridFlex";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import useWindowSize from "@/hooks/useWindowSize";

export default function Stats() {
  const { isMobile } = useWindowSize();

  useSyncChainIdToStore();
  useBtcEthPrices();

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
                Protocol Analytics
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
                Live metrics from all Rift swaps
              </Text>
            </Flex>
          </GridFlex>

          {/* Stats Overview */}
          <Flex w="100%" maxW="1400px" mb={isMobile ? "20px" : "20px"}>
            <StatsOverview />
          </Flex>

          {/* Volume Chart */}
          <GridFlex width="100%" heightBlocks={13} mb="40px">
            <VolumeTxnChart defaultTimeframe="1m" />
          </GridFlex>
        </Flex>
        {process.env.NEXT_PUBLIC_FAKE_OTC === "true" ||
        process.env.NEXT_PUBLIC_FAKE_RFQ === "true" ? null : (
          <TEEStatusFooter />
        )}
      </Flex>
    </>
  );
}
