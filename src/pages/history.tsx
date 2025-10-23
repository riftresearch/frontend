import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { Flex, Text } from "@chakra-ui/react";
import { UserSwapHistory } from "@/components/activity/UserSwapHistory";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { GridFlex } from "@/components/other/GridFlex";

export default function History() {
  useSyncChainIdToStore();
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
          alignSelf="center"
          w="100%"
          maxW="1200px"
          px="20px"
          py="20px"
          mt="80px"
        >
          {/* Title in GridFlex */}
          <GridFlex width="750px" contentPadding="32px" borderRadius="40px" mb="20px">
            <Flex direction="column" w="100%" align="center">
              <Text
                fontSize="36px"
                mt="-15px"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                color={colorsAnalytics.offWhite}
                textAlign="center"
              >
                Swap History
              </Text>
              <Text
                fontSize="15px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colorsAnalytics.textGray}
                mt="-2px"
                mb="-4px"
                letterSpacing="-0.5px"
                textAlign="center"
              >
                Manage the status of your current and previous Rift swaps.
              </Text>
            </Flex>
          </GridFlex>

          <UserSwapHistory />
        </Flex>
      </Flex>
    </>
  );
}
