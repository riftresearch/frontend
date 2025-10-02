import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { GridFlex } from "./GridFlex";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";

// Simple dummy sparkline using divs; replace with chart lib later
const SparkLine: React.FC<{ color: string }> = ({ color }) => {
  return (
    <Box h="120px" w="100%" position="relative" overflow="hidden">
      <Box
        position="absolute"
        inset={0}
        borderRadius="10px"
        background={`linear-gradient(180deg, ${color}33 0%, transparent 80%)`}
        opacity={0.6}
      />
      <Box
        position="absolute"
        left={0}
        right={0}
        bottom={14}
        h="3px"
        background={`${color}`}
        borderRadius="2px"
        style={{ filter: "blur(0.3px)" }}
      />
    </Box>
  );
};

export const MarketMakers: React.FC = () => {
  const marketMakers = useAnalyticsStore((s) => s.marketMakers);

  return (
    <Flex direction="column" gap="16px" mt="10px">
      {marketMakers.map((mm) => (
        <GridFlex
          key={mm.mmName}
          width="100%"
          heightBlocks={8}
          contentPadding={0}
        >
          <Flex direction="column" w="100%" h="100%" p="16px">
            <Text
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
              fontWeight="bold"
              fontSize="26px"
              ml="5px"
              mb="10px"
            >
              {mm.mmName}
            </Text>

            <Flex gap="16px" align="stretch">
              {/* ETH Card */}
              <GridFlex widthBlocks={14} heightBlocks={6} contentPadding={5}>
                <Flex direction="column" w="100%">
                  <Text
                    color={colorsAnalytics.offWhite}
                    fontSize="25px"
                    fontWeight="bold"
                    mb="-2px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    {mm.currentEthBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    ETH
                  </Text>
                  <Text
                    color={colorsAnalytics.textGray}
                    fontSize="16px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    ${((mm.currentEthBalance || 0) * 3000).toLocaleString()}
                  </Text>
                  <Box mt="100px">
                    <SparkLine color="#5DAEF5" />
                  </Box>
                </Flex>
              </GridFlex>

              {/* BTC Card */}
              <GridFlex widthBlocks={14} heightBlocks={6} contentPadding={5}>
                <Flex direction="column" w="100%">
                  <Text
                    color={colorsAnalytics.offWhite}
                    fontSize="25px"
                    fontWeight="bold"
                    mb="-2px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    {mm.currentBtcBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    BTC
                  </Text>
                  <Text
                    color={colorsAnalytics.textGray}
                    fontSize="16px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    ${((mm.currentBtcBalance || 0) * 64000).toLocaleString()}
                  </Text>
                  <Box mt="100px">
                    <SparkLine color="#F28A40" />
                  </Box>
                </Flex>
              </GridFlex>

              {/* cbBTC Card */}
              <GridFlex widthBlocks={14} heightBlocks={6} contentPadding={5}>
                <Flex direction="column" w="100%">
                  <Text
                    color={colorsAnalytics.offWhite}
                    fontSize="25px"
                    fontWeight="bold"
                    mb="-2px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    {mm.currentCbbtcBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    cbBTC
                  </Text>
                  <Text
                    color={colorsAnalytics.textGray}
                    fontSize="16px"
                    fontFamily={FONT_FAMILIES.SF_PRO}
                  >
                    ${((mm.currentCbbtcBalance || 0) * 64000).toLocaleString()}
                  </Text>
                  <Box mt="100px">
                    <SparkLine color="#4C7DFF" />
                  </Box>
                </Flex>
              </GridFlex>
            </Flex>
          </Flex>
        </GridFlex>
      ))}
    </Flex>
  );
};

export default MarketMakers;
