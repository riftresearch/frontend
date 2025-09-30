import React from "react";
import Image from "next/image";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { GridFlex } from "@/components/other/GridFlex";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { AdminSwapItem, AdminSwapFlowStep } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FiClock, FiCheck } from "react-icons/fi";

function displayShortAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  const prefix = addr.startsWith("0x") ? "0x" : "";
  const hex = addr.replace(/^0x/, "");
  return `${prefix}${hex.slice(0, 3)}...${hex.slice(-3)}`;
}

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatBTC(n: number) {
  // Show up to 8 decimals, trimming trailing zeros
  return `${Number(n)
    .toFixed(8)
    .replace(/\.0+$/, "")
    .replace(/(\.[0-9]*?)0+$/, "$1")} BTC`;
}

function parseDurationToSeconds(duration?: string): number {
  if (!duration) return 0;
  const parts = duration.split(":");
  if (parts.length !== 2) return 0;
  const m = Number(parts[0]);
  const s = Number(parts[1]);
  if (Number.isNaN(m) || Number.isNaN(s)) return 0;
  return m * 60 + s;
}

function formatSecondsToMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.floor(seconds % 60));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const AssetIcon: React.FC<{ badge?: "BTC" | "cbBTC" }> = ({ badge }) => {
  if (!badge) return null;
  const src =
    badge === "BTC" ? "/images/BTC_icon.svg" : "/images/cbBTC_icon.svg";
  return (
    <Image
      src={src}
      alt={badge}
      width={18}
      height={18}
      style={{ opacity: 0.9 }}
    />
  );
};

const Pill: React.FC<{ step: AdminSwapFlowStep }> = ({ step }) => {
  const displayedLabel = step.kind === "swap_created" ? "Created" : step.label;
  const styleByState = () => {
    if (step.state === "completed")
      return {
        bg: colorsAnalytics.greenBackground,
        border: colorsAnalytics.greenOutline,
        text: colorsAnalytics.offWhite,
      };
    if (step.state === "inProgress")
      return {
        bg: colorsAnalytics.offBlackLighter,
        border: colorsAnalytics.borderGrayLight,
        text: colorsAnalytics.offWhite,
      };
    return {
      bg: "transparent",
      border: colorsAnalytics.borderGrayLight,
      text: colorsAnalytics.textGray,
    };
  };
  const s = styleByState();
  return (
    <Flex
      align="center"
      bg={s.bg}
      borderRadius="14px"
      border={`2px solid ${s.border}`}
      color={s.text}
      px="15px"
      py="5px"
      gap="8px"
    >
      <Text fontSize="13px" fontFamily={FONT_FAMILIES.SF_PRO} fontWeight="bold">
        {displayedLabel}
      </Text>
      {(step.kind === "user_sent" || step.kind === "mm_sent") && (
        <AssetIcon badge={step.badge} />
      )}
    </Flex>
  );
};

const StepWithTime: React.FC<{ step: AdminSwapFlowStep }> = ({ step }) => {
  const timeRowHeight = 22; // reserve consistent space above every pill
  return (
    <Flex direction="column" align="center" justify="flex-start" minW="auto">
      <Flex
        align="center"
        justify="center"
        gap="6px"
        mb="6px"
        h={`${timeRowHeight}px`}
        visibility={step.duration ? "visible" : "hidden"}
      >
        <FiClock color={colorsAnalytics.textGray} size={14} />
        <Text
          fontSize="13px"
          color={colorsAnalytics.textGray}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {step.duration || "0:00"}
        </Text>
      </Flex>
      <Pill step={step} />
    </Flex>
  );
};

const FinalTime: React.FC<{ totalSeconds: number; completed: boolean }> = ({
  totalSeconds,
  completed,
}) => {
  const color = completed
    ? colorsAnalytics.greenOutline
    : colorsAnalytics.textGray;
  return (
    <Flex direction="column" align="center" justify="center" minW="60px">
      {completed ? (
        <FiCheck color={colorsAnalytics.greenOutline} size={16} />
      ) : (
        <FiClock color={colorsAnalytics.textGray} size={12} />
      )}
      <Text
        mt="6px"
        fontSize="14px"
        color={color}
        fontFamily={FONT_FAMILIES.SF_PRO}
      >
        {formatSecondsToMinSec(totalSeconds)}
      </Text>
    </Flex>
  );
};

const Row: React.FC<{ swap: AdminSwapItem }> = ({ swap }) => {
  const filteredFlow = React.useMemo(
    () => swap.flow.filter((s) => s.kind !== "settled"),
    [swap.flow]
  );
  const totalSeconds = React.useMemo(
    () =>
      swap.flow.reduce((acc, s) => acc + parseDurationToSeconds(s.duration), 0),
    [swap.flow]
  );
  const isCompleted = React.useMemo(() => {
    return filteredFlow.every((s) => s.state === "completed");
  }, [filteredFlow]);

  const impliedUsdPerBtc =
    swap.swapInitialAmountBtc > 0
      ? swap.swapInitialAmountUsd / swap.swapInitialAmountBtc
      : 0;
  const riftFeeUsd = swap.riftFeeBtc * impliedUsdPerBtc;

  return (
    <Flex w="100%" py="14px" px="16px" align="center" letterSpacing={"-0.8px"}>
      <Box w="128px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.textGray}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {timeAgoFrom(swapsNowRef.current, swap.swapCreationTimestamp)}
        </Text>
      </Box>
      <Box w="105px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.offerWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {displayShortAddress(swap.evmAccountAddress)}
        </Text>
      </Box>
      <Box w="60px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {swap.chain}
        </Text>
      </Box>
      <Box w="150px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {formatUSD(swap.swapInitialAmountUsd)}
        </Text>
        <Text
          fontSize="14px"
          color={colorsAnalytics.textGray}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {formatBTC(swap.swapInitialAmountBtc)}
        </Text>
      </Box>
      <Box w="130px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {formatUSD(riftFeeUsd)}
        </Text>
        <Text
          fontSize="14px"
          color={colorsAnalytics.textGray}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {formatBTC(swap.riftFeeBtc)}
        </Text>
      </Box>
      <Box w="110px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.textGray}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          MM - {formatUSD(swap.mmFeeUsd)}
        </Text>
        <Text
          fontSize="14px"
          color={colorsAnalytics.textGray}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          GAS - {formatUSD(swap.networkFeeUsd)}
        </Text>
      </Box>
      <Flex flex="1" gap="10px" wrap="wrap" align="center">
        {filteredFlow.map((step, idx) => (
          <StepWithTime key={`${step.kind}-${idx}`} step={step} />
        ))}
        <FinalTime totalSeconds={totalSeconds} completed={isCompleted} />
      </Flex>
    </Flex>
  );
};

const swapsNowRef = { current: Date.now() };
function timeAgoFrom(nowMs: number, tsMs: number): string {
  const diff = Math.max(0, nowMs - tsMs);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hours = Math.floor(min / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export const SwapHistory: React.FC<{ heightBlocks?: number }> = ({
  heightBlocks = 13,
}) => {
  const swaps = useAnalyticsStore((s) => s.adminSwaps);
  const [visible, setVisible] = React.useState(10);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const sorted = React.useMemo(
    () =>
      [...swaps].sort(
        (a, b) => b.swapCreationTimestamp - a.swapCreationTimestamp
      ),
    [swaps]
  );
  const visibleSwaps = sorted.slice(0, visible);
  const canLoadMore = visible < sorted.length;

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoadingMore || !canLoadMore) return;
      const el = e.currentTarget;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 24) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisible((v) => Math.min(sorted.length, v + 10));
          setIsLoadingMore(false);
        }, 450);
      }
    },
    [isLoadingMore, canLoadMore, sorted.length]
  );

  return (
    <Box position="relative" w="100%">
      <GridFlex width="100%" heightBlocks={heightBlocks} contentPadding={0}>
        <Flex direction="column" w="100%" h="100%">
          {/* Header Row */}
          <Flex
            px="16px"
            pt="16px"
            pb="8px"
            fontSize="15px"
            align="center"
            fontWeight="bold"
            color={colorsAnalytics.textGray}
          >
            <Box w="128px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Swap Created</Text>
            </Box>
            <Box w="105px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Account</Text>
            </Box>
            <Box w="60px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Chain</Text>
            </Box>
            <Box w="150px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Swap Amount</Text>
            </Box>
            <Box w="130px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Rift Fee</Text>
            </Box>
            <Box w="110px">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Other Fees</Text>
            </Box>
            <Flex flex="1">
              <Text fontFamily={FONT_FAMILIES.SF_PRO}>Swap Flow Tracker</Text>
            </Flex>
          </Flex>

          {/* Rows */}
          <Flex
            direction="column"
            flex="1"
            overflowY="auto"
            onScroll={handleScroll}
          >
            {visibleSwaps.map((s) => (
              <Row key={s.id} swap={s} />
            ))}
            {isLoadingMore && (
              <Flex justify="center" py="12px">
                <Spinner size="sm" color={colorsAnalytics.offWhite} />
              </Flex>
            )}
          </Flex>
        </Flex>
      </GridFlex>
    </Box>
  );
};

export default SwapHistory;
