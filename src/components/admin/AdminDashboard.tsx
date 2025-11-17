import React from "react";
import { Box, Text, Flex, Button, Tooltip, Input } from "@chakra-ui/react";
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
import { FiRefreshCw, FiSearch, FiX, FiExternalLink, FiUser } from "react-icons/fi";
import { FaDollarSign, FaBitcoin } from "react-icons/fa";
import { toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { AdminChats } from "./AdminChats";
import { useRouter } from "next/router";
import { getSwap, mapDbRowToAdminSwap } from "@/utils/analyticsClient";
import { AdminSwapItem } from "@/utils/types";
import { colors } from "@/utils/colors";

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const { isMobile } = useWindowSize();
  const router = useRouter();

  // Get WebSocket data with new fields - use these directly for real-time updates
  const {
    totalSwaps,
    completedSwaps,
    createdSwaps,
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

  // Swap ID search state
  const [swapIdInput, setSwapIdInput] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedSwap, setSelectedSwap] = React.useState<AdminSwapItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);

  const cycleFees = () => {
    setFeesDisplayMode((prev) => {
      if (prev === "rift") return "network";
      if (prev === "network") return "liquidity";
      return "rift";
    });
  };

  const handleSearchSwap = async () => {
    const trimmedId = swapIdInput.trim();
    if (!trimmedId) {
      toastError(null, {
        title: "Invalid Swap ID",
        description: "Please enter a swap ID",
      });
      return;
    }

    setIsSearching(true);
    try {
      // Fetch the swap data
      const swapData = await getSwap(trimmedId);

      // Map it to AdminSwapItem format (same as UserSwapHistory)
      const mappedSwap = mapDbRowToAdminSwap(swapData);

      // Show the modal with the swap details
      setSelectedSwap(mappedSwap);
      setIsDetailsModalOpen(true);

      toastSuccess({
        title: "Swap Found",
        description: `Viewing swap ${trimmedId.slice(0, 8)}...`,
      });
    } catch (error: any) {
      console.error("Failed to find swap:", error);
      toastError(null, {
        title: "Swap Not Found",
        description: error.message || "Could not find a swap with that ID",
      });
    } finally {
      setIsSearching(false);
    }
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
      <Flex
        width={isMobile ? "100%" : "1400px"}
        maxW="1400px"
        px={isMobile ? "20px" : "0"}
        py="30px"
        mt="15px"
        direction="column"
      >
        {/* HEADER */}
        <Flex justify="space-between" align="center" flexWrap="wrap" gap="16px">
          <Box cursor="pointer" onClick={() => window.location.reload()}>
            <RiftLogo width="110" height="28" fill={colorsAnalytics.offWhite} />
          </Box>
          <Flex align="center" gap="24px" flexWrap="wrap">
            {/* Swap ID Search - Collapsible */}
            <Flex align="center" gap="12px">
              {isSearchExpanded ? (
                <Flex align="center" gap="8px">
                  <Input
                    placeholder="Search by Swap ID..."
                    value={swapIdInput}
                    onChange={(e) => setSwapIdInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSearchSwap();
                      }
                    }}
                    onBlur={() => {
                      if (!swapIdInput) {
                        setIsSearchExpanded(false);
                      }
                    }}
                    autoFocus
                    bg="rgba(0, 0, 0, 0.5)"
                    border={`2px solid ${colorsAnalytics.borderGray}`}
                    borderRadius="8px"
                    color={colorsAnalytics.offWhite}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="13px"
                    px="12px"
                    h="36px"
                    w={isMobile ? "200px" : "280px"}
                    _placeholder={{ color: colorsAnalytics.textGray }}
                    _focus={{
                      borderColor: "rgba(86, 50, 168, 0.6)",
                      boxShadow: "none",
                    }}
                  />
                  <Button
                    onClick={handleSearchSwap}
                    loading={isSearching}
                    bg="rgba(86, 50, 168, 0.15)"
                    border={`2px solid rgba(86, 50, 168, 0.4)`}
                    color={colorsAnalytics.offWhite}
                    _hover={{ bg: "rgba(86, 50, 168, 0.25)" }}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="13px"
                    h="36px"
                    px="16px"
                    borderRadius="8px"
                    minW="auto"
                  >
                    <FiSearch />
                  </Button>
                </Flex>
              ) : (
                <Button
                  onClick={() => setIsSearchExpanded(true)}
                  bg="transparent"
                  border={`2px solid ${colorsAnalytics.borderGray}`}
                  borderRadius="8px"
                  color={colorsAnalytics.offWhite}
                  _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
                  h="36px"
                  px="12px"
                  minW="auto"
                >
                  <FiSearch size={18} />
                </Button>
              )}

              {/* Person Icon - Navigate to Simulate */}
              <Button
                onClick={() => router.push("/admin/simulate")}
                bg="transparent"
                border={`2px solid ${colorsAnalytics.borderGray}`}
                borderRadius="8px"
                color={colorsAnalytics.offWhite}
                _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
                h="36px"
                px="12px"
                minW="auto"
              >
                <FiUser size={18} />
              </Button>
            </Flex>
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
        <Flex
          justify="space-between"
          align="center"
          mt="40px"
          gap={isMobile ? "12px" : "20px"}
          direction={isMobile ? "column" : "row"}
        >
          {/* TOTAL VOLUME */}
          <GridFlex
            widthBlocks={isMobile ? undefined : 10}
            width={isMobile ? "100%" : undefined}
            heightBlocks={3}
          >
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
          <GridFlex
            widthBlocks={isMobile ? undefined : 9}
            width={isMobile ? "100%" : undefined}
            heightBlocks={3}
          >
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
          <GridFlex
            widthBlocks={isMobile ? undefined : 5.6}
            width={isMobile ? "100%" : undefined}
            heightBlocks={3}
          >
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
          <GridFlex
            widthBlocks={isMobile ? undefined : 5.6}
            width={isMobile ? "100%" : undefined}
            heightBlocks={3}
          >
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
            {new Intl.NumberFormat("en-US").format(completedSwaps)} Completed |{" "}
            {new Intl.NumberFormat("en-US").format(inProgressSwaps)} In-Progress |{" "}
            {new Intl.NumberFormat("en-US").format(createdSwaps)} Awaiting Deposit |{" "}
            {new Intl.NumberFormat("en-US").format(totalSwaps)} Total Swaps
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
          {!isMobile && (
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
          )}
          <TopUsers />
        </Flex>

        {/* FEEDBACK CHATS */}
        <Flex mt="20px" mb="20px" direction="column">
          <Text
            ml="5px"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontWeight="bold"
            mt="18px"
            fontSize="35px"
            style={{ textShadow: "0 0 18px rgba(255,255,255,0.18)" }}
            mb="28px"
          >
            Feedback Chats
          </Text>
          <AdminChats />
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

      {/* Swap Details Modal */}
      {isDetailsModalOpen && selectedSwap && (
        <Flex
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          width="100vw"
          height="100vh"
          zIndex={999998}
          bg="rgba(0, 0, 0, 0.85)"
          align="center"
          justify="center"
          style={{
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <Box
            bg="#1a1a1a"
            borderWidth={2}
            w="600px"
            maxWidth="90%"
            maxH="80vh"
            overflowY="auto"
            borderColor={colors.borderGray}
            borderRadius="20px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.offWhite}
            position="relative"
            p="32px"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <Flex justify="space-between" align="center" mb="24px">
              <Text fontSize="24px" fontFamily={FONT_FAMILIES.NOSTROMO} fontWeight="bold">
                Swap Details
              </Text>
              <Button
                bg="transparent"
                border="none"
                color={colors.textGray}
                _hover={{ color: colors.offWhite }}
                onClick={() => setIsDetailsModalOpen(false)}
                p="5px"
                minW="auto"
                h="auto"
              >
                <FiX size={24} />
              </Button>
            </Flex>

            {/* Content */}
            <Flex direction="column" gap="16px">
              {/* Swap ID */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Swap ID
                </Text>
                <Text fontSize="14px" color={colors.offWhite} fontFamily={FONT_FAMILIES.AUX_MONO}>
                  {selectedSwap.id}
                </Text>
              </Flex>

              {/* Direction */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Direction
                </Text>
                <Text fontSize="14px" color={colors.offWhite}>
                  {selectedSwap.direction === "BTC_TO_EVM" ? "BTC → cbBTC" : "cbBTC → BTC"}
                </Text>
              </Flex>

              {/* Amount */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Amount
                </Text>
                <Text fontSize="14px" color={colors.offWhite}>
                  {selectedSwap.swapInitialAmountBtc.toFixed(8)} BTC ($
                  {selectedSwap.swapInitialAmountUsd.toFixed(2)})
                </Text>
              </Flex>

              {/* EVM Address */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  EVM Address
                </Text>
                <Text
                  fontSize="14px"
                  color={colors.offWhite}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  wordBreak="break-all"
                >
                  {selectedSwap.evmAccountAddress}
                </Text>
              </Flex>

              {/* Chain */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Chain
                </Text>
                <Text fontSize="14px" color={colors.offWhite}>
                  {selectedSwap.chain}
                </Text>
              </Flex>

              {/* Fees */}
              <Flex direction="column" gap="8px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Fees
                </Text>
                <Flex direction="column" gap="4px" pl="12px">
                  <Flex justify="space-between">
                    <Text fontSize="13px" color={colors.textGray}>
                      Rift Fee:
                    </Text>
                    <Text fontSize="13px" color={colors.offWhite}>
                      {selectedSwap.riftFeeSats.toLocaleString()} sats
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="13px" color={colors.textGray}>
                      Network Fee:
                    </Text>
                    <Text fontSize="13px" color={colors.offWhite}>
                      ${selectedSwap.networkFeeUsd.toFixed(2)}
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="13px" color={colors.textGray}>
                      MM Fee:
                    </Text>
                    <Text fontSize="13px" color={colors.offWhite}>
                      ${selectedSwap.mmFeeUsd.toFixed(2)}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>

              {/* Created At */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Created At
                </Text>
                <Text fontSize="14px" color={colors.offWhite}>
                  {new Date(selectedSwap.swapCreationTimestamp).toLocaleString()}
                </Text>
              </Flex>

              {/* Flow Steps */}
              <Flex direction="column" gap="8px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Flow Steps
                </Text>
                <Flex direction="column" gap="4px" pl="12px">
                  {selectedSwap.flow
                    .filter((s) => s.status !== "settled")
                    .map((step, idx) => (
                      <Flex key={idx} justify="space-between" align="center">
                        <Text fontSize="13px" color={colors.textGray}>
                          {step.status}:
                        </Text>
                        <Text
                          fontSize="13px"
                          color={
                            step.state === "completed"
                              ? "#22c55e"
                              : step.state === "inProgress"
                                ? "#3b82f6"
                                : colors.textGray
                          }
                        >
                          {step.state} ({step.duration})
                        </Text>
                      </Flex>
                    ))}
                </Flex>
              </Flex>

              {/* Raw Data */}
              {selectedSwap.rawData && (
                <Flex direction="column" gap="8px">
                  <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                    Raw Data (Full Swap Response)
                  </Text>
                  <Box
                    bg="#0a0a0a"
                    border={`1px solid ${colors.borderGray}`}
                    borderRadius="8px"
                    p="12px"
                    maxH="300px"
                    overflowY="auto"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="11px"
                  >
                    <pre
                      style={{
                        margin: 0,
                        color: colors.offWhite,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {JSON.stringify(selectedSwap.rawData, null, 2)}
                    </pre>
                  </Box>
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedSwap.rawData, null, 2));
                      toastSuccess({
                        title: "Copied to clipboard",
                        description: "Complete swap data copied",
                      });
                    }}
                    bg="rgba(34, 197, 94, 0.15)"
                    border={`2px solid rgba(34, 197, 94, 0.4)`}
                    color={colors.offWhite}
                    _hover={{ bg: "rgba(34, 197, 94, 0.25)" }}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    fontSize="12px"
                  >
                    Copy Raw Data to Clipboard
                  </Button>
                </Flex>
              )}
            </Flex>
          </Box>
        </Flex>
      )}
    </Flex>
  );
};
