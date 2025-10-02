import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { GridFlex } from "./GridFlex";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hours ago`;
}

export const ErrorLogs: React.FC = () => {
  const logs = useAnalyticsStore((s) => s.errorLogs);
  type TF = "1h" | "24h" | "1w" | "1m";
  const [tf, setTf] = React.useState<TF>("1m");

  const rangeMs = React.useMemo(() => {
    switch (tf) {
      case "1h":
        return 60 * 60 * 1000;
      case "24h":
        return 24 * 60 * 60 * 1000;
      case "1w":
        return 7 * 24 * 60 * 60 * 1000;
      case "1m":
      default:
        return 30 * 24 * 60 * 60 * 1000;
    }
  }, [tf]);

  const bucketCount = React.useMemo(() => {
    switch (tf) {
      case "1h":
        return 12; // 5-min bins
      case "24h":
        return 24; // hourly bins
      case "1w":
        return 14; // 12-hr bins
      case "1m":
      default:
        return 30; // daily bins
    }
  }, [tf]);

  const { chartData, total } = React.useMemo(() => {
    const now = Date.now();
    const start = now - rangeMs;
    const buckets: {
      start: number;
      end: number;
      label: string;
      count: number;
    }[] = [];
    const step = Math.floor(rangeMs / bucketCount);
    for (let i = 0; i < bucketCount; i++) {
      const s = start + i * step;
      const e = i === bucketCount - 1 ? now : s + step;
      let label = "";
      const d = new Date(s);
      if (tf === "1h")
        label = `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
      else if (tf === "24h") label = `${d.getHours()}:00`;
      else label = `${d.getMonth() + 1}/${d.getDate()}`;
      buckets.push({ start: s, end: e, label, count: 0 });
    }
    const relevant = logs.filter(
      (l) => l.timestamp >= start && l.timestamp <= now
    );
    for (const l of relevant) {
      const idx = Math.min(
        buckets.length - 1,
        Math.floor(((l.timestamp - start) / rangeMs) * bucketCount)
      );
      buckets[idx].count += 1;
    }
    return {
      chartData: buckets.map((b) => ({ label: b.label, count: b.count })),
      total: relevant.length,
    };
  }, [logs, rangeMs, bucketCount, tf]);

  return (
    <Flex direction="row" gap="16px" mt="10px">
      {/* Summary/Chart card */}
      <GridFlex widthBlocks={12} heightBlocks={6} contentPadding={4}>
        <Flex direction="column" w="100%" h="100%" justify="space-between">
          <Flex justify="space-between" align="center" px="4px" pt="2px">
            <Text
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
              fontSize="20px"
              fontWeight="bold"
            >
              Total Errors
            </Text>
            <select
              value={tf}
              onChange={(e) => setTf(e.target.value as TF)}
              style={{
                background: "transparent",
                color: colorsAnalytics.offWhite,
                border: `1px solid ${colorsAnalytics.borderGrayLight}`,
                borderRadius: 8,
                padding: "4px 8px",
              }}
            >
              <option style={{ color: "black" }} value="1h">
                Last Hour
              </option>
              <option style={{ color: "black" }} value="24h">
                Last 24 Hours
              </option>
              <option style={{ color: "black" }} value="1w">
                Last Week
              </option>
              <option style={{ color: "black" }} value="1m">
                Last Month
              </option>
            </select>
          </Flex>
          <Text
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
            fontSize="56px"
            fontWeight="bold"
            px="4px"
          >
            {total}
          </Text>
          <Box flex="1" mt="6px" px="4px" pb="4px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 0, right: 6, left: -20, bottom: 0 }}
              >
                <CartesianGrid stroke="transparent" />
                <XAxis
                  dataKey="label"
                  tick={{
                    fontFamily: FONT_FAMILIES.SF_PRO,
                    fontSize: 14,
                    fill: colorsAnalytics.textGray,
                  }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: colorsAnalytics.textGray }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{
                    background: "#101010",
                    border: `1px solid ${colorsAnalytics.borderGrayLight}`,
                  }}
                />
                <Bar dataKey="count" fill="#C32D2D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Flex>
      </GridFlex>

      {/* List card */}
      <GridFlex widthBlocks={28} heightBlocks={6} contentPadding={5}>
        <Flex direction="column" w="100%" h="100%" gap="10px">
          {logs.map((log, idx) => (
            <Flex key={idx} align="center" justify="space-between" px="8px">
              <Text
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="16px"
                minW="160px"
              >
                {timeAgo(log.timestamp)}
              </Text>

              <Flex
                bg="#47292B"
                border={`2px solid ${colorsAnalytics.red}`}
                borderRadius="14px"
                px="12px"
                py="6px"
                minW="220px"
                justify="center"
              >
                <Text
                  color={colorsAnalytics.offWhite}
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  fontWeight="bold"
                >
                  {log.title}
                </Text>
              </Flex>

              <Box
                ml="12px"
                flex="1"
                overflow="hidden"
                whiteSpace="nowrap"
                textOverflow="ellipsis"
              >
                <Text
                  color={colorsAnalytics.textGray}
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  fontSize="14px"
                >
                  {log.message}
                </Text>
              </Box>
            </Flex>
          ))}
        </Flex>
      </GridFlex>
    </Flex>
  );
};

export default ErrorLogs;
