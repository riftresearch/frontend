import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useAnalyticsSeries, Timeframe } from "@/hooks/useAnalyticsSeries";
import { colors } from "@/utils/colors";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FONT_FAMILIES } from "@/utils/font";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export const VolumeTxnChart: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState<Timeframe>("1d");
  const { points, totalVolume, totalTxns, maxVolume, maxTxns } =
    useAnalyticsSeries(timeframe);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Recharts-friendly data
  const data = React.useMemo(
    () =>
      points.map((p) => ({
        time: p.time,
        label: buildLabel(p.time, timeframe),
        volume: Math.max(0, Math.round(p.volumeUsd)),
        txns: Math.max(0, Math.round((p as any).txns ?? 0)),
        txnsNorm: Math.max(0, (p as any).txnsNormalized ?? 0),
      })),
    [points, timeframe]
  );

  if (!mounted) return null;

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
          <Text
            mt="-6px"
            color={colorsAnalytics.offWhite}
            fontSize="49px"
            fontWeight="bold"
            fontFamily={FONT_FAMILIES.SF_PRO}
            style={{ textShadow: "0 0 18px rgba(255,255,255,0.22)" }}
          >
            {formatUSD(totalVolume)}
          </Text>
        </Box>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          style={{
            background: "transparent",
            color: colors.offWhite,
            border: `1px solid ${colors.borderGray}`,
            borderRadius: 8,
            padding: "6px 10px",
            width: 170,
          }}
        >
          <option style={{ color: "black" }} value="1h">
            Last Hour
          </option>
          <option style={{ color: "black" }} value="1d">
            Last Day
          </option>
          <option style={{ color: "black" }} value="1m">
            Last Month
          </option>
          <option style={{ color: "black" }} value="3m">
            Last 3 Months
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
        }}
      >
        {/* Lighting overlay: above GridFlex, below chart; non-interactive */}
        <Box
          position="absolute"
          top={-32}
          left={0}
          right={0}
          bottom={20}
          zIndex={1}
          pointerEvents="none"
          style={{
            backgroundImage:
              "linear-gradient(-45deg, rgba(0, 0, 0, 0) 35%, rgb(255, 128, 0, 0.13) 47%, rgb(255, 128, 0, 0.13) 52%, rgb(0, 0, 0, 0) 60%)",
          }}
        />
        <Box position="relative" zIndex={2} w="100%" h="100%">
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
                dataKey="label"
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
                domain={[0, Math.max(1, Math.round(maxVolume * 1.05))]}
                tickFormatter={(value) => formatUSD(value)}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />

              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill="url(#volGrad)"
                radius={[8, 8, 8, 8]}
                isAnimationActive
                animationDuration={500}
              />
              <Bar
                yAxisId="volume"
                dataKey="txnsNorm"
                fill="url(#txnGrad)"
                radius={[8, 8, 8, 8]}
                isAnimationActive
                animationDuration={500}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Flex>
  );
};

export default VolumeTxnChart;

function buildLabel(ts: number, tf: Timeframe): string {
  const d = new Date(ts);
  const two = (n: number) => n.toString().padStart(2, "0");
  switch (tf) {
    case "1h":
    case "1d":
      return `${two(d.getHours())}:${two(d.getMinutes())}`;
    case "1m":
    case "3m":
      return `${d.getMonth() + 1}/${d.getDate()}`;
    case "1y":
    case "all":
      return `${d.getMonth() + 1}/${d.getDate()}`;
    default:
      return d.toLocaleDateString();
  }
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const vol = payload.find((p: any) => p.dataKey === "volume")?.value ?? 0;
  const txns = payload[0]?.payload?.txns ?? 0;
  return (
    <Box
      bg="#101010"
      border={`1px solid ${colors.borderGray}`}
      borderRadius="8px"
      p="8px"
    >
      <Text fontSize="12px" color={colors.textGray} mb="4px">
        {label}
      </Text>
      <Text fontSize="12px" color={colors.offWhite}>
        Volume: {formatUSD(vol)}
      </Text>
      <Text fontSize="12px" color={colors.offWhite}>
        Txns: {txns.toLocaleString()}
      </Text>
    </Box>
  );
};

function labelForTimeframe(tf: Timeframe) {
  switch (tf) {
    case "1h":
      return "Hourly Volume";
    case "1d":
      return "Daily Volume";
    case "1m":
      return "30-Day Volume";
    case "3m":
      return "90-Day Volume";
    case "1y":
      return "1-Year Volume";
    case "all":
      return "All-Time Volume";
    default:
      return "Volume";
  }
}
