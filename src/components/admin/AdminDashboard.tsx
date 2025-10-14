import React from "react";
import { Box, Text, Flex, Button } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { RiftLogo } from "@/components/other/RiftLogo";
import { GridFlex } from "../other/GridFlex";
import { VolumeTxnChart } from "@/components/charts/VolumeTxnChart";
import { SwapHistory } from "@/components/charts/SwapHistory";
import TopUsers from "@/components/charts/TopUsers";
import { MarketMakers } from "../other/MarketMakers";
import { ErrorLogs } from "../other/ErrorLogs";
import { useBtcPrice } from "@/hooks/useBtcPrice";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { useSwapStream } from "@/hooks/useSwapStream";
import { satsToBtc } from "@/utils/dappHelper";
import NumberFlow from "@number-flow/react";
import { FiChevronRight } from "react-icons/fi";

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
    totalRiftFeesSats,
    totalNetworkFeesSats,
    totalLiquidityFeesSats,
  } = useSwapStream();

  // Cycle state for fees display: 'rift' -> 'network' -> 'liquidity' -> 'rift'
  const [feesDisplayMode, setFeesDisplayMode] = React.useState<"rift" | "network" | "liquidity">(
    "rift"
  );

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

  // Get BTC price for USD conversion
  const btcPriceUsd = useAnalyticsStore((s) => s.btcPriceUsd);

  // Fetch and update BTC price
  useBtcPrice();

  // Convert sats to USD
  const totalVolumeUsd = React.useMemo(() => {
    const btc = parseFloat(satsToBtc(parseInt(totalVolumeSats) || 0));
    const usd = btc * btcPriceUsd;
    return usd;
  }, [totalVolumeSats, btcPriceUsd]);

  const totalRiftFeesUsd = React.useMemo(() => {
    const btc = parseFloat(satsToBtc(parseInt(totalRiftFeesSats) || 0));
    const usd = btc * btcPriceUsd;
    return usd;
  }, [totalRiftFeesSats, btcPriceUsd]);

  const totalNetworkFeesUsd = React.useMemo(() => {
    const btc = parseFloat(satsToBtc(parseInt(totalNetworkFeesSats) || 0));
    const usd = btc * btcPriceUsd;
    return usd;
  }, [totalNetworkFeesSats, btcPriceUsd]);

  const totalLiquidityFeesUsd = React.useMemo(() => {
    const btc = parseFloat(satsToBtc(parseInt(totalLiquidityFeesSats) || 0));
    const usd = btc * btcPriceUsd;
    return usd;
  }, [totalLiquidityFeesSats, btcPriceUsd]);

  // Debug: Log ALL values whenever they change
  React.useEffect(() => {
    console.log("═══════════════════════════════════════════════");
    console.log("[ADMIN_DASHBOARD_RENDER] WebSocket Raw Values:");
    console.log("  totalSwaps:", totalSwaps, "(type:", typeof totalSwaps, ")");
    console.log("  inProgressSwaps:", inProgressSwaps, "(type:", typeof inProgressSwaps, ")");
    console.log("  uniqueUsers:", uniqueUsers, "(type:", typeof uniqueUsers, ")");
    console.log("  totalVolumeSats:", totalVolumeSats, "(type:", typeof totalVolumeSats, ")");
    console.log("  totalRiftFeesSats:", totalRiftFeesSats, "(type:", typeof totalRiftFeesSats, ")");
    console.log(
      "  totalNetworkFeesSats:",
      totalNetworkFeesSats,
      "(type:",
      typeof totalNetworkFeesSats,
      ")"
    );
    console.log(
      "  totalLiquidityFeesSats:",
      totalLiquidityFeesSats,
      "(type:",
      typeof totalLiquidityFeesSats,
      ")"
    );
    console.log("");
    console.log("[ADMIN_DASHBOARD_RENDER] Converted USD Values (what will render):");
    console.log(
      "  totalVolumeUsd:",
      totalVolumeUsd,
      "(formatted: $" + totalVolumeUsd.toFixed(2) + ")"
    );
    console.log(
      "  totalRiftFeesUsd:",
      totalRiftFeesUsd,
      "(formatted: $" + totalRiftFeesUsd.toFixed(2) + ")"
    );
    console.log(
      "  totalNetworkFeesUsd:",
      totalNetworkFeesUsd,
      "(formatted: $" + totalNetworkFeesUsd.toFixed(2) + ")"
    );
    console.log(
      "  totalLiquidityFeesUsd:",
      totalLiquidityFeesUsd,
      "(formatted: $" + totalLiquidityFeesUsd.toFixed(2) + ")"
    );
    console.log("  btcPriceUsd:", btcPriceUsd);
    console.log("═══════════════════════════════════════════════");
  }, [
    totalSwaps,
    inProgressSwaps,
    uniqueUsers,
    totalVolumeSats,
    totalRiftFeesSats,
    totalNetworkFeesSats,
    totalLiquidityFeesSats,
    totalVolumeUsd,
    totalRiftFeesUsd,
    totalNetworkFeesUsd,
    totalLiquidityFeesUsd,
    btcPriceUsd,
  ]);

  return (
    <Flex minHeight="100vh" bg={"#000000"} justifyContent="center">
      <Flex width="1400px" py="30px" mt="15px" direction="column">
        {/* HEADER */}
        <Flex justify="space-between" align="center">
          <RiftLogo width="110" height="28" fill={colorsAnalytics.offWhite} />
          <Text fontSize="sm" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            Admin Dashboard
          </Text>
        </Flex>
        {/* OVERVIEW */}
        <Flex justify="space-between" align="center" mt="40px" gap="20px">
          {/* TOTAL VOLUME */}
          <GridFlex widthBlocks={10} heightBlocks={3}>
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
                <NumberFlow
                  value={totalVolumeUsd}
                  format={{
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  }}
                  style={{
                    fontFamily: FONT_FAMILIES.SF_PRO,
                    fontSize: "49px",
                    fontWeight: "bold",
                    color: colorsAnalytics.offWhite,
                  }}
                />
              </Box>
            </Flex>
          </GridFlex>

          {/* TOTAL FEES COLLECTED */}
          <GridFlex widthBlocks={9} heightBlocks={3}>
            <Box position="relative" w="100%" h="100%">
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
                position="absolute"
                top="18px"
                right="20px"
                zIndex={1}
              >
                <FiChevronRight />
              </Button>
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
                  <NumberFlow
                    value={
                      feesDisplayMode === "rift"
                        ? totalRiftFeesUsd
                        : feesDisplayMode === "network"
                          ? totalNetworkFeesUsd
                          : totalLiquidityFeesUsd
                    }
                    format={{
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 2,
                    }}
                    style={{
                      fontFamily: FONT_FAMILIES.SF_PRO,
                      fontSize: "49px",
                      fontWeight: "bold",
                      color: colorsAnalytics.offWhite,
                    }}
                  />
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
              >
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
              >
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
            Ranked by volume, swaps, or recent activity
          </Text>
          <TopUsers />
        </Flex>

        {/* RIFT LOGO */}
        <Flex justify="center" mt="60px" mb="80px">
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
