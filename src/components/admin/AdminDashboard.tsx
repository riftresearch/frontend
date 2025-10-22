import React from "react";
import { Box, Text, Flex, Button, Tooltip } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { RiftLogo } from "@/components/other/RiftLogo";
import { GridFlex } from "../other/GridFlex";
import { VolumeTxnChart } from "@/components/charts/VolumeTxnChart";
import { SwapHistory } from "@/components/charts/SwapHistory";
import TopUsers from "@/components/charts/TopUsers";
import { MarketMakers } from "../other/MarketMakers";
import { ErrorLogs } from "../other/ErrorLogs";
import { useSwapStream } from "@/hooks/useSwapStream";
import NumberFlow from "@number-flow/react";
import { FiRefreshCw } from "react-icons/fi";
import { FaDollarSign, FaBitcoin } from "react-icons/fa";
import { toastSuccess } from "@/utils/toast";

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  // Get WebSocket data with new fields - use these directly for real-time updates
  const {
    totalSwaps,
    inProgressSwaps,
    uniqueUsers,
    totalVolumeSats,
    totalVolumeUsd,
    totalRiftFeesSats,
    totalRiftFeesUsd,
    totalNetworkFeesSats,
    totalNetworkFeesUsd,
    totalLiquidityFeesSats,
    totalLiquidityFeesUsd,
  } = useSwapStream();

  // Cycle state for fees display: 'rift' -> 'network' -> 'liquidity' -> 'rift'
  const [feesDisplayMode, setFeesDisplayMode] = React.useState<"rift" | "network" | "liquidity">(
    "rift"
  );
  const [timeUntilRefresh, setTimeUntilRefresh] = React.useState(600); // 600 seconds = 10 minutes

  // Currency toggle states
  const [feesCurrency, setFeesCurrency] = React.useState<"usd" | "btc">("usd");
  const [volumeCurrency, setVolumeCurrency] = React.useState<"usd" | "btc">("usd");

  const cycleFees = () => {
    setFeesDisplayMode((prev) => {
      if (prev === "rift") return "network";
      if (prev === "network") return "liquidity";
      return "rift";
    });
  };

  // Callback for SwapHistory component (not needed for display, but keeps the interface)
  const handleStatsUpdate = React.useCallback(
    (stats: { totalSwaps: number; inProgressSwaps: number; uniqueUsers: number }) => {
      // No-op: we're using WebSocket values directly now
    },
    []
  );

  // Auto-refresh the page every 10 minutes with countdown
  React.useEffect(() => {
    // Countdown timer - update every second
    const countdownInterval = setInterval(() => {
      setTimeUntilRefresh((prev) => {
        if (prev <= 1) {
          console.log("[ADMIN_DASHBOARD] Auto-refreshing page");
          window.location.reload();
          return 600; // Reset to 10 minutes
        }
        return prev - 1;
      });
    }, 1000); // Update every second

    return () => {
      clearInterval(countdownInterval);
    };
  }, []);

  // Convert websocket string values to numbers for display
  const totalVolumeUsdNum = parseFloat(totalVolumeUsd) || 0;
  const totalRiftFeesUsdNum = parseFloat(totalRiftFeesUsd) || 0;
  const totalNetworkFeesUsdNum = parseFloat(totalNetworkFeesUsd) || 0;
  const totalLiquidityFeesUsdNum = parseFloat(totalLiquidityFeesUsd) || 0;

  // Check if data has loaded (any non-zero value indicates loaded state)
  const hasDataLoaded = totalSwaps > 0 || totalVolumeUsdNum > 0 || totalRiftFeesUsdNum > 0;

  // Debug: Log ALL values whenever they change
  React.useEffect(() => {
    console.log("═══════════════════════════════════════════════");
    console.log("[ADMIN_DASHBOARD_RENDER] WebSocket Raw Values:");
    console.log("  totalSwaps:", totalSwaps, "(type:", typeof totalSwaps, ")");
    console.log("  inProgressSwaps:", inProgressSwaps, "(type:", typeof inProgressSwaps, ")");
    console.log("  uniqueUsers:", uniqueUsers, "(type:", typeof uniqueUsers, ")");
    console.log("  totalVolumeSats:", totalVolumeSats, "(type:", typeof totalVolumeSats, ")");
    console.log("  totalVolumeUsd:", totalVolumeUsd, "(type:", typeof totalVolumeUsd, ")");
    console.log("  totalRiftFeesSats:", totalRiftFeesSats, "(type:", typeof totalRiftFeesSats, ")");
    console.log("  totalRiftFeesUsd:", totalRiftFeesUsd, "(type:", typeof totalRiftFeesUsd, ")");
    console.log(
      "  totalNetworkFeesSats:",
      totalNetworkFeesSats,
      "(type:",
      typeof totalNetworkFeesSats,
      ")"
    );
    console.log(
      "  totalNetworkFeesUsd:",
      totalNetworkFeesUsd,
      "(type:",
      typeof totalNetworkFeesUsd,
      ")"
    );
    console.log(
      "  totalLiquidityFeesSats:",
      totalLiquidityFeesSats,
      "(type:",
      typeof totalLiquidityFeesSats,
      ")"
    );
    console.log(
      "  totalLiquidityFeesUsd:",
      totalLiquidityFeesUsd,
      "(type:",
      typeof totalLiquidityFeesUsd,
      ")"
    );
    console.log("═══════════════════════════════════════════════");
  }, [
    totalSwaps,
    inProgressSwaps,
    uniqueUsers,
    totalVolumeSats,
    totalVolumeUsd,
    totalRiftFeesSats,
    totalRiftFeesUsd,
    totalNetworkFeesSats,
    totalNetworkFeesUsd,
    totalLiquidityFeesSats,
    totalLiquidityFeesUsd,
  ]);

  return (
    <Flex minHeight="100vh" bg={"#000000"} justifyContent="center">
      <Flex width="1400px" py="30px" mt="15px" direction="column">
        {/* HEADER */}
        <Flex justify="space-between" align="center">
          <Box cursor="pointer" onClick={() => window.location.reload()}>
            <RiftLogo width="110" height="28" fill={colorsAnalytics.offWhite} />
          </Box>
          <Flex align="center" gap="24px">
            <Text fontSize="sm" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
              Admin Dashboard &nbsp;|&nbsp;{" "}
              {new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </Text>
          </Flex>
        </Flex>
        {/* OVERVIEW */}
        <Flex justify="space-between" align="center" mt="40px" gap="20px">
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
                _hover={{
                  opacity: 0.8,
                }}
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
                  Total Volume
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

          {/* TOTAL FEES COLLECTED */}
          <GridFlex widthBlocks={9} heightBlocks={3}>
            <Box position="relative" w="100%" h="100%">
              <Flex position="absolute" top="18px" right="20px" zIndex={1} gap="8px">
                <Button
                  size="sm"
                  onClick={cycleFees}
                  bg="transparent"
                  borderWidth="2px"
                  borderRadius="12px"
                  borderColor={colorsAnalytics.borderGray}
                  color={colorsAnalytics.offWhite}
                  _hover={{
                    opacity: 0.8,
                  }}
                  minW="32px"
                  h="32px"
                  p={0}
                >
                  <FiRefreshCw />
                </Button>
                <Button
                  size="sm"
                  onClick={() => setFeesCurrency(feesCurrency === "usd" ? "btc" : "usd")}
                  bg="transparent"
                  borderWidth="2px"
                  borderRadius="12px"
                  borderColor={colorsAnalytics.borderGray}
                  color={colorsAnalytics.offWhite}
                  _hover={{
                    opacity: 0.8,
                  }}
                  minW="32px"
                  h="32px"
                  p={0}
                >
                  {feesCurrency === "usd" ? <FaDollarSign /> : <FaBitcoin />}
                </Button>
              </Flex>
              <Flex direction="column" pl="25px" pt="18px">
                <Text
                  color={colorsAnalytics.textGray}
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  fontSize="19px"
                  fontWeight="bold"
                  mb="8px"
                >
                  {feesDisplayMode === "rift" && "Total Rift Fees"}
                  {feesDisplayMode === "network" && "Total Network Fees"}
                  {feesDisplayMode === "liquidity" && "Total Market Maker Fees"}
                </Text>
                <Box mt="-12px">
                  <Tooltip.Root openDelay={200} closeDelay={0}>
                    <Tooltip.Trigger asChild>
                      <Box
                        display="inline-block"
                        cursor="pointer"
                        onClick={() => {
                          const isUsd = feesCurrency === "usd";
                          if (isUsd) {
                            const usdValue =
                              feesDisplayMode === "rift"
                                ? totalRiftFeesUsdNum
                                : feesDisplayMode === "network"
                                  ? totalNetworkFeesUsdNum
                                  : totalLiquidityFeesUsdNum;
                            navigator.clipboard.writeText(usdValue.toFixed(2));
                            toastSuccess({
                              title: "Copied to clipboard",
                              description: `$${usdValue.toFixed(2)}`,
                            });
                          } else {
                            const satsValue =
                              feesDisplayMode === "rift"
                                ? parseInt(totalRiftFeesSats) || 0
                                : feesDisplayMode === "network"
                                  ? parseInt(totalNetworkFeesSats) || 0
                                  : parseInt(totalLiquidityFeesSats) || 0;
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
                              feesCurrency === "usd"
                                ? feesDisplayMode === "rift"
                                  ? totalRiftFeesUsdNum
                                  : feesDisplayMode === "network"
                                    ? totalNetworkFeesUsdNum
                                    : totalLiquidityFeesUsdNum
                                : feesDisplayMode === "rift"
                                  ? parseInt(totalRiftFeesSats) || 0
                                  : feesDisplayMode === "network"
                                    ? parseInt(totalNetworkFeesSats) || 0
                                    : parseInt(totalLiquidityFeesSats) || 0
                            }
                            format={
                              feesCurrency === "usd"
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
                            suffix={feesCurrency === "usd" ? undefined : " sats"}
                            style={{
                              fontFamily: FONT_FAMILIES.SF_PRO,
                              fontSize: "49px",
                              fontWeight: "bold",
                              color: colorsAnalytics.offWhite,
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
                          {feesCurrency === "usd"
                            ? (() => {
                                const usdValue =
                                  feesDisplayMode === "rift"
                                    ? totalRiftFeesUsdNum
                                    : feesDisplayMode === "network"
                                      ? totalNetworkFeesUsdNum
                                      : totalLiquidityFeesUsdNum;
                                return `$${usdValue.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`;
                              })()
                            : (() => {
                                const satsValue =
                                  feesDisplayMode === "rift"
                                    ? parseInt(totalRiftFeesSats) || 0
                                    : feesDisplayMode === "network"
                                      ? parseInt(totalNetworkFeesSats) || 0
                                      : parseInt(totalLiquidityFeesSats) || 0;
                                return `${satsValue.toLocaleString()} sats`;
                              })()}
                        </Text>
                      </Tooltip.Content>
                    </Tooltip.Positioner>
                  </Tooltip.Root>
                </Box>
              </Flex>
            </Box>
          </GridFlex>

          {/* Completed SWAPS */}
          <GridFlex widthBlocks={5.6} heightBlocks={3}>
            <Flex direction="column" pl="25px" pt="18px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="19px"
                fontWeight="bold"
                mb="8px"
              >
                Completed Swaps
              </Text>
              <Box
                mt="-12px"
                fontWeight="bold"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
                cursor="pointer"
                onClick={() => {
                  navigator.clipboard.writeText(totalSwaps.toString());
                  toastSuccess({
                    title: "Copied to clipboard",
                    description: `${totalSwaps.toLocaleString()} swaps`,
                  });
                }}
              >
                {hasDataLoaded ? (
                  <NumberFlow
                    value={totalSwaps}
                    format={{ notation: "compact" }}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "49px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
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
          <GridFlex widthBlocks={5.6} heightBlocks={3}>
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
                fontWeight="bold"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="49px"
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
        {/* VOLUME CHART */}
        <GridFlex width="100%" heightBlocks={13} mt="30px">
          <VolumeTxnChart />
        </GridFlex>

        {/* SWAP HISTORY */}
        <Flex mt="30px" mb="20px" direction="column">
          <Text
            ml="5px"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontWeight="bold"
            mt="18px"
            fontSize="35px"
            style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}
          >
            Swap History
          </Text>
          <Text
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="14px"
            mt="4px"
            ml="5px"
            mb="28px"
          >
            {new Intl.NumberFormat("en-US").format(totalSwaps)} Total Swaps |{" "}
            {new Intl.NumberFormat("en-US").format(inProgressSwaps)} In-Progress Swaps
          </Text>
          <SwapHistory onStatsUpdate={handleStatsUpdate} />
        </Flex>

        {/* TOP USERS */}
        <Flex mt="-10px" mb="20px" direction="column">
          <Text
            ml="5px"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontWeight="bold"
            mt="18px"
            fontSize="35px"
            style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}
          >
            Top Users
          </Text>
          <Text
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="14px"
            mt="4px"
            ml="5px"
            mb="-30px"
          >
            {new Intl.NumberFormat("en-US").format(uniqueUsers)} Unique Users | Ranked by volume,
            swaps, or recent activity
          </Text>
          <TopUsers />
        </Flex>

        {/* RIFT LOGO */}
        <Flex justify="center" mt="60px" mb="60px">
          <RiftLogo width="80" height="20" fill={colorsAnalytics.textGray} />
        </Flex>

        {/* MARKET MAKERS */}
        {/* <Flex mt="20px" mb="20px" direction="column">
          <Text
            ml="5px"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontWeight="bold"
            mt="18px"
            fontSize="35px"
            style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}
          >
            Market Makers
          </Text>
          <MarketMakers />
        </Flex> */}

        {/* ERROR LOGS */}
        {/* <Flex mt="20px" mb="40px" direction="column">
          <Text
            ml="5px"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontWeight="bold"
            mt="18px"
            fontSize="35px"
            style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}
          >
            Error Logs
          </Text>
          <ErrorLogs />
        </Flex> */}
      </Flex>
    </Flex>
  );
};
