import React from "react";
import { Box, Text, Flex, Button, Tooltip } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { GridFlex } from "./GridFlex";
import { useSwapStream } from "@/hooks/useSwapStream";
import NumberFlow from "@number-flow/react";
import { FaDollarSign, FaBitcoin } from "react-icons/fa";
import { toastSuccess } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";

export const StatsOverview: React.FC = () => {
  const { isMobile, windowSize } = useWindowSize();

  // Get WebSocket data
  const { completedSwaps, uniqueUsers, totalVolumeSats, totalVolumeUsd } = useSwapStream();

  // Currency toggle state
  const [volumeCurrency, setVolumeCurrency] = React.useState<"usd" | "btc">("usd");

  // Convert websocket string values to numbers for display
  const totalVolumeUsdNum = parseFloat(totalVolumeUsd) || 0;

  // Check if data has loaded
  const hasDataLoaded = completedSwaps > 0 || totalVolumeUsdNum > 0;

  // Mobile layout - stacked vertically like admin dashboard
  if (isMobile) {
    return (
      <Flex justify="space-between" align="center" gap="12px" w="100%" direction="column">
        {/* TOTAL VOLUME - Full width on mobile */}
        <GridFlex width="100%" heightBlocks={3}>
          <Box position="relative" w="100%" h="100%">
            <Button
              size="sm"
              onClick={() => setVolumeCurrency(volumeCurrency === "usd" ? "btc" : "usd")}
              bg="transparent"
              borderWidth="2px"
              borderRadius="12px"
              borderColor={colorsAnalytics.borderGray}
              color={colorsAnalytics.offWhite}
              _hover={{ opacity: 0.8 }}
              minW="32px"
              h="32px"
              p={0}
              position="absolute"
              top="18px"
              right="20px"
              zIndex={1}
            >
              {volumeCurrency === "usd" ? <FaDollarSign /> : <FaBitcoin />}
            </Button>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                All User Volume
              </Text>
              <Box mt="-11px">
                {hasDataLoaded ? (
                  <NumberFlow
                    value={
                      volumeCurrency === "usd" ? totalVolumeUsdNum : parseInt(totalVolumeSats) || 0
                    }
                    format={
                      volumeCurrency === "usd"
                        ? {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 2,
                          }
                        : {
                            notation: "compact",
                            maximumFractionDigits: 2,
                          }
                    }
                    suffix={volumeCurrency === "usd" ? undefined : " sats"}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "49px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
                      textShadow: "0 0 18px rgba(255,255,255,0.22)",
                    }}
                  />
                ) : (
                  <Text
                    fontFamily={FONT_FAMILIES.SF_PRO}
                    fontSize="49px"
                    fontWeight="bold"
                    color="#3a3a3a"
                  >
                    --
                  </Text>
                )}
              </Box>
            </Flex>
          </Box>
        </GridFlex>

        {/* Bottom row - SWAPS and USERS side by side */}
        <Flex w="100%" gap="12px">
          {/* COMPLETED SWAPS */}
          <GridFlex width="50%" heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Total Swaps
              </Text>
              <Box
                mt="-12px"
                cursor="pointer"
                onClick={() => {
                  navigator.clipboard.writeText(completedSwaps.toString());
                  toastSuccess({
                    title: "Copied to clipboard",
                    description: `${completedSwaps.toLocaleString()} swaps`,
                  });
                }}
              >
                {hasDataLoaded ? (
                  <NumberFlow
                    value={completedSwaps}
                    format={{ notation: "compact" }}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "49px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
                      textShadow: "0 0 18px rgba(255,255,255,0.22)",
                    }}
                  />
                ) : (
                  <Text
                    fontFamily={FONT_FAMILIES.SF_PRO}
                    fontSize="49px"
                    fontWeight="bold"
                    color="#3a3a3a"
                  >
                    --
                  </Text>
                )}
              </Box>
            </Flex>
          </GridFlex>

          {/* UNIQUE USERS */}
          <GridFlex width="50%" heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Unique Users
              </Text>
              <Box
                mt="-12px"
                cursor="pointer"
                onClick={() => {
                  navigator.clipboard.writeText(uniqueUsers.toString());
                  toastSuccess({
                    title: "Copied to clipboard",
                    description: `${uniqueUsers.toLocaleString()} users`,
                  });
                }}
              >
                {hasDataLoaded ? (
                  <NumberFlow
                    value={uniqueUsers}
                    format={{ notation: "compact" }}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "49px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
                      textShadow: "0 0 18px rgba(255,255,255,0.22)",
                    }}
                  />
                ) : (
                  <Text
                    fontFamily={FONT_FAMILIES.SF_PRO}
                    fontSize="49px"
                    fontWeight="bold"
                    color="#3a3a3a"
                  >
                    --
                  </Text>
                )}
              </Box>
            </Flex>
          </GridFlex>
        </Flex>
      </Flex>
    );
  }

  // Desktop layout
  return (
    <Flex justify="space-between" align="center" gap="20px" w="100%" alignSelf="center">
      {/* TOTAL VOLUME */}
      <GridFlex widthBlocks={10} heightBlocks={3}>
        <Box position="relative" w="100%" h="100%">
          <Button
            size="sm"
            onClick={() => setVolumeCurrency(volumeCurrency === "usd" ? "btc" : "usd")}
            bg="transparent"
            borderWidth="2px"
            borderRadius="12px"
            borderColor={colorsAnalytics.borderGray}
            color={colorsAnalytics.offWhite}
            _hover={{ opacity: 0.8 }}
            minW="32px"
            h="32px"
            p={0}
            position="absolute"
            top="18px"
            right="20px"
            zIndex={1}
          >
            {volumeCurrency === "usd" ? <FaDollarSign /> : <FaBitcoin />}
          </Button>
          <Flex direction="column" pl="25px" pt="18px">
            <Text
              color={colorsAnalytics.textGray}
              fontFamily={FONT_FAMILIES.SF_PRO}
              fontSize="19px"
              fontWeight="bold"
              mb="8px"
            >
              All User Volume
            </Text>
            <Box mt="-11px">
              <Tooltip.Root openDelay={200} closeDelay={0}>
                <Tooltip.Trigger asChild>
                  <Box
                    display="inline-block"
                    cursor="pointer"
                    onClick={() => {
                      const isUsd = volumeCurrency === "usd";
                      if (isUsd) {
                        navigator.clipboard.writeText(totalVolumeUsdNum.toFixed(2));
                        toastSuccess({
                          title: "Copied to clipboard",
                          description: `$${totalVolumeUsdNum.toFixed(2)}`,
                        });
                      } else {
                        const satsValue = parseInt(totalVolumeSats) || 0;
                        navigator.clipboard.writeText(satsValue.toString());
                        toastSuccess({
                          title: "Copied to clipboard",
                          description: `${satsValue.toLocaleString()} sats`,
                        });
                      }
                    }}
                  >
                    {hasDataLoaded ? (
                      <NumberFlow
                        value={
                          volumeCurrency === "usd"
                            ? totalVolumeUsdNum
                            : parseInt(totalVolumeSats) || 0
                        }
                        format={
                          volumeCurrency === "usd"
                            ? {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 2,
                              }
                            : {
                                notation: "compact",
                                maximumFractionDigits: 2,
                              }
                        }
                        suffix={volumeCurrency === "usd" ? undefined : " sats"}
                        style={{
                          fontFamily: FONT_FAMILIES.SF_PRO,
                          fontSize: "49px",
                          fontWeight: "bold",
                          color: colorsAnalytics.offWhite,
                          textShadow: "0 0 18px rgba(255,255,255,0.22)",
                        }}
                      />
                    ) : (
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="49px"
                        fontWeight="bold"
                        color="#3a3a3a"
                      >
                        --
                      </Text>
                    )}
                  </Box>
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content
                    bg={colorsAnalytics.offBlackLighter}
                    color={colorsAnalytics.offWhite}
                    borderRadius="8px"
                    px="12px"
                    py="6px"
                    fontSize="14px"
                  >
                    <Tooltip.Arrow />
                    <Text fontFamily={FONT_FAMILIES.SF_PRO}>
                      {volumeCurrency === "usd"
                        ? `$${totalVolumeUsdNum.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : `${(parseInt(totalVolumeSats) || 0).toLocaleString()} sats`}
                    </Text>
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>
            </Box>
          </Flex>
        </Box>
      </GridFlex>

      {/* COMPLETED SWAPS */}
      <GridFlex widthBlocks={10} heightBlocks={3}>
        <Flex direction="column" pl="25px" pt="18px">
          <Text
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="19px"
            fontWeight="bold"
            mb="8px"
          >
            Total Swaps
          </Text>
          <Box
            mt="-12px"
            cursor="pointer"
            onClick={() => {
              navigator.clipboard.writeText(completedSwaps.toString());
              toastSuccess({
                title: "Copied to clipboard",
                description: `${completedSwaps.toLocaleString()} swaps`,
              });
            }}
          >
            {hasDataLoaded ? (
              <NumberFlow
                value={completedSwaps}
                format={{ notation: "compact" }}
                style={{
                  fontFamily: FONT_FAMILIES.SF_PRO,
                  fontSize: "49px",
                  fontWeight: "bold",
                  color: colorsAnalytics.offWhite,
                  textShadow: "0 0 18px rgba(255,255,255,0.22)",
                }}
              />
            ) : (
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
                fontWeight="bold"
                color="#3a3a3a"
              >
                --
              </Text>
            )}
          </Box>
        </Flex>
      </GridFlex>

      {/* UNIQUE USERS */}
      <GridFlex widthBlocks={10} heightBlocks={3}>
        <Flex direction="column" pl="25px" pt="18px">
          <Text
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="19px"
            fontWeight="bold"
            mb="8px"
          >
            Unique Users
          </Text>
          <Box
            mt="-12px"
            cursor="pointer"
            onClick={() => {
              navigator.clipboard.writeText(uniqueUsers.toString());
              toastSuccess({
                title: "Copied to clipboard",
                description: `${uniqueUsers.toLocaleString()} users`,
              });
            }}
          >
            {hasDataLoaded ? (
              <NumberFlow
                value={uniqueUsers}
                format={{ notation: "compact" }}
                style={{
                  fontFamily: FONT_FAMILIES.SF_PRO,
                  fontSize: "49px",
                  fontWeight: "bold",
                  color: colorsAnalytics.offWhite,
                  textShadow: "0 0 18px rgba(255,255,255,0.22)",
                }}
              />
            ) : (
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
                fontWeight="bold"
                color="#3a3a3a"
              >
                --
              </Text>
            )}
          </Box>
        </Flex>
      </GridFlex>
    </Flex>
  );
};
