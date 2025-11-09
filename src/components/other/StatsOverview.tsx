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

  if (isMobile) {
    if (windowSize.width < 400) {
      return <></>;
    } else {
      return (
        <Flex justify="space-between" align="center" gap="8px" w="100%">
          {/* TOTAL VOLUME - 50% */}
          <GridFlex width="calc(50% - 3px)" heightBlocks={1.4}>
            <Box position="relative" w="100%" h="100%">
              <Flex direction="column" pl="15px" pt="10px">
                <Text
                  color={colorsAnalytics.textGray}
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  fontSize="9px"
                  fontWeight="bold"
                  mb="6px"
                >
                  All User Volume
                </Text>
                <Box mt="-8px">
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
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: colorsAnalytics.offWhite,
                      }}
                    />
                  ) : (
                    <Text
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontSize="24px"
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

          {/* COMPLETED SWAPS - 25% */}
          <GridFlex width="calc(25% - 3px)" heightBlocks={1.4}>
            <Flex direction="column" pl="15px" pt="10px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="9px"
                fontWeight="bold"
                mb="6px"
              >
                Total Swaps
              </Text>
              <Box mt="-8px">
                {hasDataLoaded ? (
                  <NumberFlow
                    value={completedSwaps}
                    format={{ notation: "compact" }}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
                    }}
                  />
                ) : (
                  <Text
                    fontFamily={FONT_FAMILIES.SF_PRO}
                    fontSize="18px"
                    fontWeight="bold"
                    color="#3a3a3a"
                  >
                    --
                  </Text>
                )}
              </Box>
            </Flex>
          </GridFlex>

          {/* UNIQUE USERS - 25% */}
          <GridFlex width="calc(25% - 3px)" heightBlocks={1.4}>
            <Flex direction="column" pl="15px" pt="10px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="9px"
                fontWeight="bold"
                mb="6px"
              >
                Users
              </Text>
              <Box mt="-8px">
                {hasDataLoaded ? (
                  <NumberFlow
                    value={uniqueUsers}
                    format={{ notation: "compact" }}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
                    }}
                  />
                ) : (
                  <Text
                    fontFamily={FONT_FAMILIES.SF_PRO}
                    fontSize="18px"
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
    }
  }

  // Desktop layout - 50%, 25%, 25%
  return (
    <Flex justify="space-between" align="center" gap="8px" w="100%" alignSelf="center">
      {/* TOTAL VOLUME - 50% */}
      <GridFlex widthBlocks={15} heightBlocks={2.3}>
        <Box position="relative" w="100%" h="100%">
          <Button
            size="sm"
            onClick={() => setVolumeCurrency(volumeCurrency === "usd" ? "btc" : "usd")}
            bg="transparent"
            borderWidth="2px"
            borderRadius="8px"
            borderColor={colorsAnalytics.borderGray}
            color={colorsAnalytics.offWhite}
            _hover={{ opacity: 0.8 }}
            minW="26px"
            h="26px"
            p={0}
            position="absolute"
            top="12px"
            right="15px"
            zIndex={1}
            fontSize="11px"
          >
            {volumeCurrency === "usd" ? <FaDollarSign /> : <FaBitcoin />}
          </Button>
          <Flex direction="column" pl="22px" pt="14px">
            <Text
              color={colorsAnalytics.textGray}
              fontFamily={FONT_FAMILIES.SF_PRO}
              fontSize="15px"
              fontWeight="bold"
              mb="6px"
            >
              All User Volume
            </Text>
            <Box mt="-8px">
              <Tooltip.Root openDelay={200} closeDelay={0}>
                <Tooltip.Trigger asChild>
                  <Box display="inline-block" cursor="pointer">
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
                          fontSize: "37px",
                          fontWeight: "bold",
                          color: colorsAnalytics.offWhite,
                        }}
                      />
                    ) : (
                      <Text
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontSize="37px"
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

      {/* COMPLETED SWAPS - 25% */}
      <GridFlex widthBlocks={7.5} heightBlocks={2.3}>
        <Flex direction="column" pl="22px" pt="14px">
          <Text
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="15px"
            fontWeight="bold"
            mb="6px"
          >
            Total Swaps
          </Text>
          <Box
            mt="-8px"
            fontWeight="bold"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="37px"
            cursor="pointer"
          >
            {hasDataLoaded ? (
              <NumberFlow
                value={completedSwaps}
                format={{ notation: "compact" }}
                style={{
                  fontFamily: FONT_FAMILIES.SF_PRO,
                  fontSize: "37px",
                  fontWeight: "bold",
                  color: colorsAnalytics.offWhite,
                }}
              />
            ) : (
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="37px"
                fontWeight="bold"
                color="#3a3a3a"
              >
                --
              </Text>
            )}
          </Box>
        </Flex>
      </GridFlex>

      {/* UNIQUE USERS - 25% */}
      <GridFlex widthBlocks={7.5} heightBlocks={2.3}>
        <Flex direction="column" pl="22px" pt="14px">
          <Text
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="15px"
            fontWeight="bold"
            mb="6px"
          >
            Unique Users
          </Text>
          <Box
            mt="-8px"
            fontWeight="bold"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="37px"
            cursor="pointer"
          >
            {hasDataLoaded ? (
              <NumberFlow
                value={uniqueUsers}
                format={{ notation: "compact" }}
                style={{
                  fontFamily: FONT_FAMILIES.SF_PRO,
                  fontSize: "37px",
                  fontWeight: "bold",
                  color: colorsAnalytics.offWhite,
                }}
              />
            ) : (
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="37px"
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
