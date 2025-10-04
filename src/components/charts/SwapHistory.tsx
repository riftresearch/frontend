import React from "react";
import Image from "next/image";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { GridFlex } from "@/components/other/GridFlex";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { AdminSwapItem, AdminSwapFlowStep, SwapDirection } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FiClock, FiCheck } from "react-icons/fi";

function displayShortAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  const prefix = addr.startsWith("0x") ? "0x" : "";
  const hex = addr.replace(/^0x/, "");
  return `${prefix}${hex.slice(0, 3)}...${hex.slice(-3)}`;
}

function explorerUrl(chain: "ETH" | "BASE", address: string): string {
  const base =
    chain === "ETH" ? "https://etherscan.io" : "https://basescan.org";
  return `${base}/address/${address}`;
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
  const displayedLabel = step.label;
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
      <Text fontSize="13px" fontFamily={FONT_FAMILIES.SF_PRO}>
        {displayedLabel}
      </Text>
      {(step.status === "waiting_user_deposit_initiated" ||
        step.status === "waiting_mm_deposit_initiated") && (
        <AssetIcon badge={step.badge} />
      )}
    </Flex>
  );
};

const StepWithTime: React.FC<{ step: AdminSwapFlowStep }> = ({ step }) => {
  const timeRowHeight = 22; // reserve consistent space above every pill
  return (
    <Flex
      direction="column"
      align="center"
      justify="flex-start"
      minW="auto"
      letterSpacing={"0px"}
    >
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
  const filteredFlow = swap.flow.filter((s) => s.status !== "settled");
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
      <Box w="115px">
        <Flex
          as="button"
          onClick={() =>
            window.open(
              explorerUrl(swap.chain, swap.evmAccountAddress),
              "_blank"
            )
          }
          bg="#1D1D1D"
          px="8px"
          py="6px"
          borderRadius="10px"
          _hover={{ filter: "brightness(1.1)" }}
          cursor="pointer"
          justifyContent="center"
          alignItems="center"
        >
          <Text
            fontSize="14px"
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
          >
            {displayShortAddress(swap.evmAccountAddress)}
          </Text>
        </Flex>
      </Box>
      <Box w="60px">
        <Text
          fontSize="14px"
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
        >
          {/* {swap.chain} */}
          {swap.statusTesting}
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
          <StepWithTime key={`${step.status}-${idx}`} step={step} />
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
  const averages = React.useMemo(() => {
    const byDir: Record<SwapDirection, AdminSwapItem[]> = {
      BTC_TO_EVM: [],
      EVM_TO_BTC: [],
    };
    for (const s of swaps) byDir[s.direction].push(s);
    function avg(nums: number[]) {
      if (!nums.length) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    const build = (dir: SwapDirection) => {
      const list = byDir[dir];
      const avgUsd = avg(list.map((s) => s.swapInitialAmountUsd));
      const avgBtc = avg(list.map((s) => s.swapInitialAmountBtc));
      const avgRiftFeeBtc = avg(list.map((s) => s.riftFeeBtc));
      const avgUserConfs = Math.round(avg(list.map((s) => s.userConfs || 0)));
      const avgMmConfs = Math.round(avg(list.map((s) => s.mmConfs || 0)));
      const flow: AdminSwapFlowStep[] = [
        { status: "pending", label: "Swap Created", state: "completed" },
        {
          status: "waiting_user_deposit_initiated",
          label: `User Sent ${dir === "BTC_TO_EVM" ? "BTC" : "cbBTC"}`,
          state: "completed",
          badge: dir === "BTC_TO_EVM" ? "BTC" : "cbBTC",
        },
        {
          status: "waiting_user_deposit_confirmed",
          label: `${Math.max(avgUserConfs, 0)}+ Confs`,
          state: "completed",
        },
        {
          status: "waiting_mm_deposit_initiated",
          label: `MM Sent ${dir === "BTC_TO_EVM" ? "cbBTC" : "BTC"}`,
          state: "completed",
          badge: dir === "BTC_TO_EVM" ? "cbBTC" : "BTC",
        },
        {
          status: "waiting_mm_deposit_confirmed",
          label: `${Math.max(avgMmConfs, 0)}+ Confs`,
          state: "completed",
        },
      ];
      return {
        dir,
        count: list.length,
        avgUsd,
        avgBtc,
        avgRiftFeeBtc,
        flow,
      };
    };
    return [build("BTC_TO_EVM"), build("EVM_TO_BTC")];
  }, [swaps]);
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
            <Box w="115px">
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
            {/* Averages are now outside the scroll area */}

            {visibleSwaps.map((s, idx) => (
              <Flex
                key={s.id}
                w="100%"
                overflow="hidden"
                transition="all 300ms ease"
                animation={idx === 0 ? "slideDown 300ms ease" : undefined}
              >
                <Row swap={s} />
              </Flex>
            ))}
            {isLoadingMore && (
              <Flex justify="center" py="12px">
                <Spinner size="sm" color={colorsAnalytics.offWhite} />
              </Flex>
            )}
          </Flex>
        </Flex>
      </GridFlex>
      {/* Averages blocks below the container */}
      <Flex direction="column" px="16px" pt="12px" gap="12px">
        {averages.map((a) => (
          <GridFlex
            key={a.dir}
            width="100%"
            heightBlocks={3}
            contentPadding={12}
          >
            <Flex w="100%" align="center" gap="16px">
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                color={colorsAnalytics.offWhite}
                fontWeight="bold"
              >
                {a.dir === "BTC_TO_EVM" ? "BTC→ETH" : "ETH→BTC"} Averages (
                {new Intl.NumberFormat("en-US").format(a.count)} Swaps):
              </Text>
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                color={colorsAnalytics.offWhite}
              >
                {formatUSD(a.avgUsd)}
              </Text>
              <Text
                fontFamily={FONT_FAMILIES.SF_PRO}
                color={colorsAnalytics.offWhite}
              >
                {formatUSD(
                  a.avgRiftFeeBtc * (a.avgUsd / Math.max(a.avgBtc, 1e-9))
                )}
              </Text>
              <Flex flex="1" gap="10px" align="center">
                {a.flow.map((step, idx) => (
                  <Pill key={`${step.status}-${idx}`} step={step} />
                ))}
              </Flex>
            </Flex>
          </GridFlex>
        ))}
      </Flex>
      <style jsx global>{`
        @keyframes slideDown {
          from {
            transform: translateY(-8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </Box>
  );
};

export default SwapHistory;
