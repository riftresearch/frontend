import React from "react";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { useTimeBuckets, BucketType } from "@/hooks/useTimeBuckets";
import { colors } from "@/utils/colors";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FONT_FAMILIES } from "@/utils/font";
import { useSwapStream } from "@/hooks/useSwapStream";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toastSuccess } from "@/utils/toast";

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

// Map old timeframe values to new bucket types
const TIMEFRAME_TO_BUCKET: Record<string, BucketType> = {
  "30m": "last_30_mins",
  "1h": "last_hour",
  "1d": "last_day",
  "1w": "last_week",
  "1m": "last_month",
  "1y": "last_year",
  all: "all_time",
};

export const VolumeTxnChart: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState<string>("1d");
  const bucketType = TIMEFRAME_TO_BUCKET[timeframe] || "last_day";

  const {
    points,
    totalVolume,
    totalVolumeUsd,
    totalTxns,
    maxVolume,
    maxVolumeUsd,
    maxTxns,
    isLoading,
    isError,
    refetch,
  } = useTimeBuckets(bucketType);

  const [mounted, setMounted] = React.useState(false);

  // Debug: Log the values

  // Get total swaps count from WebSocket to trigger refetches
  const { totalSwaps } = useSwapStream();
  const previousTotalSwaps = React.useRef<number>(0);

  React.useEffect(() => {
    setMounted(true);
    // Initialize the ref with current totalSwaps to prevent refetch on mount
    if (totalSwaps > 0) {
      previousTotalSwaps.current = totalSwaps;
    }
  }, []);

  // Refetch bucket data when total swaps changes (indicating a new swap completed)
  React.useEffect(() => {
    if (mounted && totalSwaps > 0 && totalSwaps !== previousTotalSwaps.current) {
      console.log(
        `[VolumeTxnChart] Total swaps changed from ${previousTotalSwaps.current} to ${totalSwaps}, refetching bucket data`
      );
      refetch();
      previousTotalSwaps.current = totalSwaps;
    }
  }, [totalSwaps, mounted, refetch]);

  // Normalize transaction counts based on max volume USD
  const data = React.useMemo(() => {
    if (!points || points.length === 0) return [];

    // Calculate transaction normalization scale (20% of max volume USD)
    const txnScale = maxTxns > 0 ? (0.2 * maxVolumeUsd) / maxTxns : 0;

    const result = points.map((p) => {
      const dataPoint = {
        time: p.time,
        label: p.label,
        displayLabel: p.label, // For display purposes
        volume: Math.max(0, p.volumeUsd),
        volumeSats: p.volume,
        txns: Math.max(0, Math.round(p.txns)),
        txnsNorm: Math.max(0, p.txns * txnScale),
      };

      return dataPoint;
    });

    return result;
  }, [points, maxVolumeUsd, maxTxns]);

  if (!mounted) return null;

  if (isLoading) {
    return (
      <Flex h="100%" w="100%" align="center" justify="center">
        <Spinner size="xl" color={colorsAnalytics.offWhite} />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex h="100%" w="100%" align="center" justify="center" direction="column">
        <Text color={colorsAnalytics.textGray} fontSize="16px" mb="8px">
          Failed to load volume data
        </Text>
        <Text color={colorsAnalytics.textGray} fontSize="14px">
          Please try refreshing the page
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" h="100%" w="100%">
      <Flex justify="space-between" align="center" px="20px" pt="16px" pb="8px">
        <Box>
          <Flex align="baseline" gap="8px">
            <Text
              color={colorsAnalytics.textGray}
              fontSize="19px"
              fontWeight="bold"
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {labelForTimeframe(timeframe)}
            </Text>
            <Text
              color={colorsAnalytics.textGray}
              fontSize="19px"
              fontWeight="bold"
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              |
            </Text>
            <Text
              color={colorsAnalytics.textGray}
              fontSize="19px"
              fontWeight="bold"
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {`${totalTxns.toLocaleString()} Swaps`}
            </Text>
          </Flex>
          <Flex direction="column">
            <Text
              mt="-6px"
              color={colorsAnalytics.offWhite}
              fontSize="49px"
              fontWeight="bold"
              fontFamily={FONT_FAMILIES.SF_PRO}
              style={{ textShadow: "0 0 18px rgba(255,255,255,0.22)" }}
              cursor="pointer"
              onClick={() => {
                navigator.clipboard.writeText(totalVolumeUsd.toFixed(2));
                toastSuccess({
                  title: "Copied to clipboard",
                  description: formatUSD(totalVolumeUsd),
                });
              }}
            >
              {formatUSD(totalVolumeUsd)}
            </Text>
            <Text
              mt="-8px"
              color={colorsAnalytics.textGray}
              fontSize="16px"
              fontWeight="normal"
              fontFamily={FONT_FAMILIES.SF_PRO}
              cursor="pointer"
              onClick={() => {
                navigator.clipboard.writeText(totalVolume.toString());
                toastSuccess({
                  title: "Copied to clipboard",
                  description: `${totalVolume.toLocaleString()} sats`,
                });
              }}
            >
              {totalVolume.toLocaleString()} sats
            </Text>
          </Flex>
        </Box>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          style={{
            background: "transparent",
            color: colors.offWhite,
            border: `1px solid ${colors.borderGray}`,
            borderRadius: 8,
            padding: "6px 10px",
            width: 170,
          }}
        >
          <option style={{ color: "black" }} value="30m">
            Last 30 Minutes
          </option>
          <option style={{ color: "black" }} value="1h">
            Last Hour
          </option>
          <option style={{ color: "black" }} value="1d">
            Last Day
          </option>
          <option style={{ color: "black" }} value="1w">
            Last Week
          </option>
          <option style={{ color: "black" }} value="1m">
            Last Month
          </option>
          <option style={{ color: "black" }} value="1y">
            Last Year
          </option>
          <option style={{ color: "black" }} value="all">
            All Time
          </option>
        </select>
      </Flex>

      <Box
        flex="1"
        position="relative"
        px="8px"
        mt="-20px"
        pb="10px"
        // @ts-ignore
        sx={{
          fontFamily: FONT_FAMILIES.SF_PRO,
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          "&:focus, &:active": {
            outline: "none",
          },
          "& *": {
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
            "&:focus, &:active": {
              outline: "none",
            },
          },
        }}
      >
        {/* Lighting overlay: above GridFlex, below chart; non-interactive */}
        <Box
          position="absolute"
          top={-32}
          left={0}
          right={0}
          bottom={0}
          zIndex={1}
          pointerEvents="none"
          style={{
            backgroundImage:
              "linear-gradient(-45deg, rgba(0, 0, 0, 0) 35%, rgb(255, 128, 0, 0.13) 47%, rgb(255, 128, 0, 0.13) 52%, rgb(0, 0, 0, 0) 60%)",
          }}
        />
        <Box
          position="relative"
          zIndex={2}
          w="100%"
          h="100%"
          css={{
            "& svg": {
              outline: "none !important",
              border: "none !important",
              "&:focus, &:active": {
                outline: "none !important",
                border: "none !important",
              },
            },
            "& *": {
              outline: "none !important",
              "&:focus, &:active": {
                outline: "none !important",
              },
            },
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 34, left: 8, bottom: 0 }}
              barCategoryGap="0%"
              barGap="-100%"
            >
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB276" />
                  <stop offset="68%" stopColor="#E55A1C" />
                  <stop offset="89%" stopColor="#913D08" />
                  <stop offset="100%" stopColor="#76371A" />
                </linearGradient>
                <linearGradient id="txnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFD0A8" />
                  <stop offset="100%" stopColor="#F28A40" />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="transparent" />
              <XAxis
                dataKey="time"
                tickFormatter={(timestamp) => {
                  // Find the data point with this timestamp to get its label
                  const point = data.find((d) => d.time === timestamp);
                  return point?.displayLabel || "";
                }}
                style={{ fontFamily: FONT_FAMILIES.SF_PRO, fontSize: "14px" }}
                fontFamily={FONT_FAMILIES.SF_PRO}
                tickLine={false}
                axisLine={false}
                interval="preserveEnd"
                minTickGap={24}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                style={{ fontFamily: FONT_FAMILIES.SF_PRO, fontSize: "14px" }}
                tickLine={false}
                axisLine={false}
                domain={[
                  0,
                  Math.max(1, Math.round(Math.max(...data.map((d) => d.volume), 1) * 1.05)),
                ]}
                tickFormatter={(value) => formatUSD(value)}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                isAnimationActive={false}
                animationDuration={0}
              />

              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill="url(#volGrad)"
                radius={[15, 15, 8, 8]}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="volume"
                dataKey="txnsNorm"
                fill="url(#txnGrad)"
                radius={[15, 15, 8, 8]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Flex>
  );
};

export default VolumeTxnChart;

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const vol = payload.find((p: any) => p.dataKey === "volume")?.value ?? 0;
  const volumeSats = payload[0]?.payload?.volumeSats ?? 0;
  const txns = payload[0]?.payload?.txns ?? 0;
  const displayLabel = payload[0]?.payload?.displayLabel ?? "";

  return (
    <Box bg="#101010" border={`1px solid ${colors.borderGray}`} borderRadius="8px" p="8px">
      <Text fontSize="12px" color={colors.textGray} mb="4px">
        {displayLabel}
      </Text>
      <Text fontSize="12px" color={colors.offWhite}>
        Volume: {formatUSD(vol)}
      </Text>
      <Text fontSize="12px" color={colors.textGray}>
        {volumeSats.toLocaleString()} sats
      </Text>
      <Text fontSize="12px" color={colors.offWhite}>
        Txns: {txns.toLocaleString()}
      </Text>
    </Box>
  );
};

function labelForTimeframe(timeframe: string) {
  switch (timeframe) {
    case "30m":
      return "30-Minute Volume";
    case "1h":
      return "Hourly Volume";
    case "1d":
      return "Daily Volume";
    case "1w":
      return "Weekly Volume";
    case "1m":
      return "Monthly Volume";
    case "1y":
      return "Yearly Volume";
    case "all":
      return "All-Time Volume";
    default:
      return "Volume";
  }
}
