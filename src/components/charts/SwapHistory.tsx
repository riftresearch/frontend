import React from "react";
import Image from "next/image";
import { Box, Flex, Text, Spinner, Tooltip, Button, Dialog, Portal } from "@chakra-ui/react";
import { GridFlex } from "@/components/other/GridFlex";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { AdminSwapItem, AdminSwapFlowStep, SwapDirection } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FiClock, FiCheck, FiChevronDown, FiChevronUp, FiX } from "react-icons/fi";
import { getSwaps, mapDbRowToAdminSwap } from "@/utils/analyticsClient";
import { toastError, toastSuccess } from "@/utils/toast";
import { useSwapStream } from "@/hooks/useSwapStream";
import { useSwapAverages } from "@/hooks/useSwapAverages";

function displayShortAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  const prefix = addr.startsWith("0x") ? "0x" : "";
  const hex = addr.replace(/^0x/, "");
  return `${prefix}${hex.slice(0, 3)}...${hex.slice(-3)}`;
}

function explorerUrl(chain: "ETH" | "BASE", address: string): string {
  const base = chain === "ETH" ? "https://etherscan.io" : "https://basescan.org";
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

  // Handle both hh:mm:ss and mm:ss formats
  if (parts.length === 3) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = Number(parts[2]);
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return 0;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (Number.isNaN(m) || Number.isNaN(s)) return 0;
    return m * 60 + s;
  }

  return 0;
}

function formatSecondsToMinSec(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.max(0, Math.floor(seconds % 60));

  // Only seconds (less than 1 minute)
  if (h === 0 && m === 0) {
    return `${s}`;
  }

  // Minutes and seconds (less than 1 hour)
  if (h === 0) {
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Hours, minutes, and seconds
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const AssetIcon: React.FC<{ badge?: "BTC" | "cbBTC" }> = ({ badge }) => {
  if (!badge) return null;
  const src = badge === "BTC" ? "/images/BTC_icon.svg" : "/images/cbBTC_icon.svg";
  return <Image src={src} alt={badge} width={18} height={18} style={{ opacity: 0.9 }} />;
};

const Pill: React.FC<{ step: AdminSwapFlowStep }> = ({ step }) => {
  const displayedLabel = step.label;
  const hasTx = step.txHash && step.txChain;
  const isClickable =
    hasTx &&
    (step.status === "waiting_user_deposit_initiated" ||
      step.status === "waiting_mm_deposit_initiated");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!step.txHash || !step.txChain) {
      toastError(null, {
        title: "Transaction Not Available",
        description: "Transaction hash not available yet",
      });
      return;
    }

    // Add 0x prefix to Ethereum transaction hashes if missing
    let txHash = step.txHash;
    if (step.txChain !== "BTC" && !txHash.startsWith("0x")) {
      txHash = `0x${txHash}`;
    }

    const url =
      step.txChain === "ETH"
        ? `https://etherscan.io/tx/${txHash}`
        : `https://mempool.space/tx/${txHash}`;

    window.open(url, "_blank");
  };

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

  // Check if this is a confirmation pill
  const isConfsPill = displayedLabel.includes("Conf");

  const pillContent = (
    <Flex
      align="center"
      bg={s.bg}
      borderRadius="14px"
      border={`2px solid ${s.border}`}
      color={s.text}
      px="15px"
      py="5px"
      gap="8px"
      cursor={isClickable ? "pointer" : "default"}
      onClick={isClickable ? handleClick : undefined}
      _hover={isClickable ? { filter: "brightness(1.1)", transform: "scale(1.02)" } : undefined}
      transition="all 150ms ease"
      minW={isConfsPill ? "80px" : undefined}
      justifyContent={isConfsPill ? "center" : undefined}
    >
      <Text fontSize="11px" fontFamily={FONT_FAMILIES.SF_PRO}>
        {displayedLabel}
      </Text>
      {(step.status === "waiting_user_deposit_initiated" ||
        step.status === "waiting_mm_deposit_initiated") && <AssetIcon badge={step.badge} />}
    </Flex>
  );

  if (!isClickable || !step.txHash) {
    return pillContent;
  }

  const truncatedHash = `${step.txHash.slice(0, 6)}...${step.txHash.slice(-4)}`;

  return (
    <Tooltip.Root openDelay={200} closeDelay={0}>
      <Tooltip.Trigger asChild>{pillContent}</Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content
          bg={colorsAnalytics.offBlackLighter}
          color={colorsAnalytics.offWhite}
          borderRadius="8px"
          px="12px"
          py="6px"
          fontSize="12px"
        >
          <Tooltip.Arrow />
          <Text>Open transaction: {truncatedHash}</Text>
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
};

const StepWithTime: React.FC<{
  step: AdminSwapFlowStep;
  previousStepTimestamp?: number;
  currentTime: number;
}> = ({ step, previousStepTimestamp, currentTime }) => {
  const timeRowHeight = 22; // reserve consistent space above every pill
  const LIVE_TIMER_OFFSET = 13; // Subtract 13 seconds to account for backend processing delay

  // Calculate live duration for in-progress steps
  const displayDuration = React.useMemo(() => {
    if (step.duration) {
      // Step is completed, show locked duration (real calculation)
      return step.duration;
    }

    if (step.state === "inProgress" && previousStepTimestamp) {
      // Step is in progress, show live counting timer
      const elapsed = currentTime - previousStepTimestamp;
      const seconds = Math.max(0, Math.floor(elapsed / 1000) - LIVE_TIMER_OFFSET);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }

    return undefined;
  }, [step.duration, step.state, previousStepTimestamp, currentTime]);

  const isCompleted = step.state === "completed";
  const showIcon = displayDuration || isCompleted;

  return (
    <Flex direction="column" align="center" justify="flex-start" minW="auto" letterSpacing={"0px"}>
      <Flex
        align="center"
        justify="center"
        gap="6px"
        mb="6px"
        h={`${timeRowHeight}px`}
        visibility={showIcon ? "visible" : "hidden"}
      >
        {isCompleted ? (
          <FiCheck color={colorsAnalytics.textGray} size={12} />
        ) : (
          <FiClock color={colorsAnalytics.textGray} size={12} />
        )}
        <Text fontSize="11px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
          {displayDuration || ""}
        </Text>
      </Flex>
      <Pill step={step} />
    </Flex>
  );
};

const FinalTime: React.FC<{
  totalSeconds: number;
  completed: boolean;
  swapCreatedTimestamp: number;
  currentTime: number;
}> = ({ totalSeconds, completed, swapCreatedTimestamp, currentTime }) => {
  const LIVE_TIMER_OFFSET = 13; // Subtract 13 seconds to account for backend processing delay
  const color = completed ? colorsAnalytics.greenOutline : colorsAnalytics.textGray;

  // Calculate live elapsed time for in-progress swaps
  const displayTime = React.useMemo(() => {
    if (completed) {
      // Show locked total time (real calculation)
      return formatSecondsToMinSec(totalSeconds);
    }

    // Show live counting time from swap creation (with offset adjustment)
    const elapsed = currentTime - swapCreatedTimestamp;
    const seconds = Math.max(0, Math.floor(elapsed / 1000) - LIVE_TIMER_OFFSET);
    return formatSecondsToMinSec(seconds);
  }, [completed, totalSeconds, swapCreatedTimestamp, currentTime]);

  return (
    <Flex direction="column" align="center" justify="center" minW="45px">
      {completed ? (
        <FiCheck color={colorsAnalytics.greenOutline} size={11} />
      ) : (
        <FiClock color={colorsAnalytics.textGray} size={10} />
      )}
      <Text mt="6px" fontSize="11px" color={color} fontFamily={FONT_FAMILIES.SF_PRO}>
        {displayTime}
      </Text>
    </Flex>
  );
};

const Row: React.FC<{
  swap: AdminSwapItem;
  currentTime: number;
  onClick?: () => void;
}> = React.memo(
  ({ swap, currentTime, onClick }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const filteredFlow = swap.flow.filter((s) => s.status !== "settled");
    const totalSeconds = React.useMemo(
      () => swap.flow.reduce((acc, s) => acc + parseDurationToSeconds(s.duration), 0),
      [swap.flow]
    );
    const isCompleted = React.useMemo(() => {
      return filteredFlow.every((s) => s.state === "completed");
    }, [filteredFlow]);

    const handleRowClick = () => {
      // Don't open modal if user was dragging to select text
      if (isDragging) {
        setIsDragging(false);
        return;
      }
      onClick?.();
    };

    const impliedUsdPerBtc =
      swap.swapInitialAmountBtc > 0 ? swap.swapInitialAmountUsd / swap.swapInitialAmountBtc : 0;
    const riftFeeBtc = swap.riftFeeSats / 100000000; // Convert sats to BTC
    const riftFeeUsd = riftFeeBtc * impliedUsdPerBtc;

    // Get timestamp for previous step to calculate live duration
    const getPreviousStepTimestamp = (index: number): number | undefined => {
      const timestamps = swap.stepTimestamps;
      if (!timestamps) return undefined;

      switch (index) {
        case 0:
          return undefined; // Created has no previous
        case 1:
          return timestamps.created; // User Sent
        case 2:
          return timestamps.userDepositDetected; // User Confs
        case 3:
          return timestamps.userConfirmed; // MM Sent
        case 4:
          return timestamps.mmDepositDetected; // MM Confs
        default:
          return undefined;
      }
    };

    return (
      <Flex
        w="100%"
        py="14px"
        px="16px"
        align="center"
        letterSpacing={"-0.8px"}
        cursor="pointer"
        _hover={{ bg: "rgba(255, 255, 255, 0.03)" }}
        transition="background 150ms ease"
        onClick={handleRowClick}
        onMouseDown={() => setIsDragging(false)}
        onMouseMove={(e) => {
          if (e.buttons === 1) {
            setIsDragging(true);
          }
        }}
      >
        <Box w="50px">
          <Text fontSize="13px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            {swap.rawData?.swap_number || swap.rawData?.swapNumber || "—"}
          </Text>
        </Box>
        <Box w="107px">
          <Flex
            as="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(swap.id);
              toastSuccess({
                title: "Copied to clipboard",
                description: `Swap ID: ${swap.id.slice(0, 6)}...`,
              });
            }}
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
              fontSize="13px"
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {swap.id.slice(0, 6)}...
            </Text>
          </Flex>
        </Box>
        <Box w="109px">
          <Text fontSize="13px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            {timeAgoFrom(currentTime, swap.swapCreationTimestamp)}
          </Text>
        </Box>
        <Box w="115px">
          <Flex
            as="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(explorerUrl(swap.chain, swap.evmAccountAddress), "_blank");
            }}
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
              fontSize="13px"
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {displayShortAddress(swap.evmAccountAddress)}
            </Text>
          </Flex>
        </Box>
        <Box w="91px">
          <Text fontSize="13px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
            {swap.direction === "BTC_TO_EVM" ? "BTC→ETH" : "ETH→BTC"}
          </Text>
        </Box>

        <Box w="150px">
          <Text fontSize="13px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
            {formatUSD(swap.swapInitialAmountUsd)}
          </Text>
          <Text fontSize="13px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            {formatBTC(swap.swapInitialAmountBtc)}
          </Text>
        </Box>
        <Box w="95px">
          <Text fontSize="13px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
            {formatUSD(riftFeeUsd)}
          </Text>
          <Text fontSize="13px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            {swap.riftFeeSats.toLocaleString()} sats
          </Text>
        </Box>
        <Box w="103px">
          <Text fontSize="13px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            MM - {formatUSD(swap.mmFeeUsd)}
          </Text>
          <Text fontSize="13px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
            GAS - {formatUSD(swap.networkFeeUsd)}
          </Text>
        </Box>
        <Flex flex="1" gap="6px" wrap="wrap" align="center" mr="-16px">
          {filteredFlow.map((step, idx) => (
            <StepWithTime
              key={`${step.status}-${idx}`}
              step={step}
              previousStepTimestamp={getPreviousStepTimestamp(idx)}
              currentTime={currentTime}
            />
          ))}
          <FinalTime
            totalSeconds={totalSeconds}
            completed={isCompleted}
            swapCreatedTimestamp={swap.swapCreationTimestamp}
            currentTime={currentTime}
          />
        </Flex>
      </Flex>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if swap changed or if this swap has in-progress steps
    if (prevProps.swap.id !== nextProps.swap.id) return false;
    if (prevProps.swap !== nextProps.swap) return false;

    // Check if any step is in progress - if so, update on time change
    const hasInProgress = nextProps.swap.flow.some((step) => step.state === "inProgress");

    // If no in-progress steps, skip time updates (only re-render if swap changes)
    if (!hasInProgress && prevProps.currentTime !== nextProps.currentTime) {
      return true; // Skip re-render
    }

    return false; // Re-render
  }
);

Row.displayName = "Row";

function timeAgoFrom(nowMs: number, tsMs: number): string {
  const diff = Math.max(0, nowMs - tsMs);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getSwapCategory(status: string): "created" | "completed" | "failed" | "in-progress" {
  if (status === "waiting_user_deposit_initiated") return "created";
  if (status === "settled") return "completed";
  if (status === "refunding_user" || status === "refunding_mm" || status === "failed")
    return "failed";
  return "in-progress";
}

// Helper to build flow steps for averages display
function buildAverageFlowSteps(
  direction: "BTC_TO_EVM" | "ETH_TO_BTC",
  avgData: {
    time_created_to_user_sent_ms: number;
    time_user_sent_to_confs_ms: number;
    time_user_confs_to_mm_sent_ms: number;
    time_mm_sent_to_mm_confs_ms: number;
  }
): AdminSwapFlowStep[] {
  const userAsset = direction === "BTC_TO_EVM" ? "BTC" : "cbBTC";
  const mmAsset = direction === "BTC_TO_EVM" ? "cbBTC" : "BTC";

  return [
    {
      status: "pending",
      label: "Created",
      state: "completed",
    },
    {
      status: "waiting_user_deposit_initiated",
      label: "User Sent",
      state: "completed",
      badge: userAsset,
      duration: formatSecondsToMinSec(Math.round(avgData.time_created_to_user_sent_ms / 1000)),
    },
    {
      status: "waiting_user_deposit_confirmed",
      label: "Confs",
      state: "completed",
      duration: formatSecondsToMinSec(Math.round(avgData.time_user_sent_to_confs_ms / 1000)),
    },
    {
      status: "waiting_mm_deposit_initiated",
      label: "MM Sent",
      state: "completed",
      badge: mmAsset,
      duration: formatSecondsToMinSec(Math.round(avgData.time_user_confs_to_mm_sent_ms / 1000)),
    },
    {
      status: "waiting_mm_deposit_confirmed",
      label: "Confs",
      state: "completed",
      duration: formatSecondsToMinSec(Math.round(avgData.time_mm_sent_to_mm_confs_ms / 1000)),
    },
  ];
}

export const SwapHistory: React.FC<{
  heightBlocks?: number;
  onStatsUpdate?: (stats: {
    totalSwaps: number;
    inProgressSwaps: number;
    uniqueUsers: number;
  }) => void;
}> = ({ heightBlocks = 13, onStatsUpdate }) => {
  const storeSwaps = useAnalyticsStore((s) => s.adminSwaps);
  const [allSwaps, setAllSwaps] = React.useState<AdminSwapItem[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [animatingSwapIds, setAnimatingSwapIds] = React.useState<Set<string>>(new Set());
  const [updatingSwapIds, setUpdatingSwapIds] = React.useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = React.useState(Date.now());
  const [showAverages, setShowAverages] = React.useState(false);
  const [filter, setFilter] = React.useState<
    "all" | "completed" | "in-progress" | "created" | "failed"
  >("all");

  // Fetch averages from backend when showAverages is true
  const { data: averagesData, isLoading: isLoadingAverages } = useSwapAverages(showAverages);
  const [isAtTop, setIsAtTop] = React.useState(true);
  const [prunedSwapCount, setPrunedSwapCount] = React.useState(0);
  const [selectedSwap, setSelectedSwap] = React.useState<AdminSwapItem | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const scrollPositionRef = React.useRef(0);
  const pageSize = 20;

  // Maximum swaps to keep in memory when at the top of the scroll position
  // This prevents infinite memory growth when the page is left open for long periods
  const MAX_SWAPS_IN_MEMORY = 100;

  // Connect to real-time swap stream
  const { latestSwap, updatedSwap, totalSwaps, inProgressSwaps, uniqueUsers, isConnected } =
    useSwapStream();
  const latestSwapRef = React.useRef<any>(null);
  const updatedSwapRef = React.useRef<any>(null);
  const processedSwapIds = React.useRef<Set<string>>(new Set());

  // Update current time for live timers and "time ago" display
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second for live timers

    return () => clearInterval(interval);
  }, []);

  // Merge store swaps (live updates) with fetched swaps (pagination)
  const swaps = React.useMemo(() => {
    const mergedMap = new Map<string, AdminSwapItem>();

    // Add all fetched swaps
    allSwaps.forEach((swap) => mergedMap.set(swap.id, swap));

    // Overlay store swaps (for live updates from polling)
    // Only add store swaps that are newer than our latest fetched swap
    const latestFetchedTime = allSwaps[0]?.swapCreationTimestamp || 0;
    storeSwaps
      .filter((swap) => swap.swapCreationTimestamp > latestFetchedTime)
      .forEach((swap) => mergedMap.set(swap.id, swap));

    const allMerged = Array.from(mergedMap.values()).sort(
      (a, b) => b.swapCreationTimestamp - a.swapCreationTimestamp
    );

    // Apply filter based on swap category
    if (filter === "all") return allMerged;

    return allMerged.filter((swap) => {
      // Get the most recent status from the flow (last in-progress or completed step)
      const currentStep =
        swap.flow.find((step) => step.state === "inProgress") || swap.flow[swap.flow.length - 1];
      const category = getSwapCategory(currentStep?.status || "");
      return category === filter;
    });
  }, [allSwaps, storeSwaps, filter]);

  // Notify parent component of stats changes
  React.useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate({ totalSwaps, inProgressSwaps, uniqueUsers });
    }
  }, [totalSwaps, inProgressSwaps, uniqueUsers, onStatsUpdate]);

  const averages = React.useMemo(() => {
    const byDir: Record<SwapDirection, AdminSwapItem[]> = {
      BTC_TO_EVM: [],
      EVM_TO_BTC: [],
      UNKNOWN: [],
    };
    for (const s of swaps) {
      if (s.direction !== "UNKNOWN") {
        byDir[s.direction].push(s);
      }
    }
    function avg(nums: number[]) {
      if (!nums.length) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }

    // Helper to calculate average duration from flow steps
    function avgDuration(swaps: AdminSwapItem[], stepIndex: number): string | undefined {
      const durations = swaps
        .map((s) => s.flow[stepIndex]?.duration)
        .filter((d): d is string => !!d)
        .map((d) => {
          const [min, sec] = d.split(":").map(Number);
          return min * 60 + sec;
        });

      if (durations.length === 0) return undefined;

      const avgSeconds = Math.round(avg(durations));
      const minutes = Math.floor(avgSeconds / 60);
      const seconds = avgSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const build = (dir: SwapDirection) => {
      const list = byDir[dir];
      const avgUsd = avg(list.map((s) => s.swapInitialAmountUsd));
      const avgBtc = avg(list.map((s) => s.swapInitialAmountBtc));
      const avgRiftFeeSats = Math.round(avg(list.map((s) => s.riftFeeSats)));
      const avgUserConfs = Math.round(avg(list.map((s) => s.userConfs || 0)));
      const avgMmConfs = Math.round(avg(list.map((s) => s.mmConfs || 0)));

      // Calculate average total time
      const totalTimes = list.map((s) =>
        s.flow.reduce((acc, step) => acc + parseDurationToSeconds(step.duration), 0)
      );
      const avgTotalSeconds = Math.round(avg(totalTimes));

      const filteredFlow: AdminSwapFlowStep[] = [
        {
          status: "pending",
          label: "Created",
          state: "completed",
        },
        {
          status: "waiting_user_deposit_initiated",
          label: "User Sent",
          state: "completed",
          badge: dir === "BTC_TO_EVM" ? "BTC" : "cbBTC",
          duration: avgDuration(list, 1),
        },
        {
          status: "waiting_user_deposit_confirmed",
          label: `${Math.max(avgUserConfs, 0)} Confs`,
          state: "completed",
          duration: avgDuration(list, 2),
        },
        {
          status: "waiting_mm_deposit_initiated",
          label: "MM Sent",
          state: "completed",
          badge: dir === "BTC_TO_EVM" ? "cbBTC" : "BTC",
          duration: avgDuration(list, 3),
        },
        {
          status: "waiting_mm_deposit_confirmed",
          label: `${Math.max(avgMmConfs, 0)}+ Confs`,
          state: "completed",
          duration: avgDuration(list, 4),
        },
      ];

      return {
        dir,
        count: list.length,
        avgUsd,
        avgBtc,
        avgRiftFeeSats,
        avgTotalSeconds,
        flow: filteredFlow,
      };
    };
    return [build("BTC_TO_EVM"), build("EVM_TO_BTC")];
  }, [swaps]);

  // Fetch next page from analytics server
  const fetchNextPage = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      console.log(`Fetching page ${page} (${pageSize} swaps, filter: ${filter})...`);
      const data = await getSwaps(page, pageSize, filter);

      console.log("📦 Raw swaps response:", JSON.stringify(data, null, 2));
      console.log("📊 Pagination:", data.pagination);

      const mapped = (data?.swaps || []).map((row: any) => mapDbRowToAdminSwap(row));

      console.log(`✅ Received ${mapped.length} swaps from page ${page}`);
      if (data?.swaps?.length > 0) {
        console.log("🔍 First swap sample:", JSON.stringify(data.swaps[0], null, 2));
      }

      if (mapped.length < pageSize) {
        setHasMore(false);
      }

      setAllSwaps((prev) => {
        const existing = new Set(prev.map((s) => s.id));
        const newSwaps = mapped.filter((s) => !existing.has(s.id));
        console.log(`Added ${newSwaps.length} new swaps (${existing.size} existing)`);
        return [...prev, ...newSwaps];
      });

      setPage((p) => p + 1);
    } catch (error) {
      console.error("Error fetching swaps:", error);
    } finally {
      setIsLoadingMore(false);
      setIsInitialLoad(false);
    }
  }, [page, pageSize, isLoadingMore, hasMore, filter]);

  // Initial load and refetch when filter changes
  React.useEffect(() => {
    // Reset pagination when filter changes
    setAllSwaps([]);
    setPage(0);
    setHasMore(true);
    setIsInitialLoad(true);
  }, [filter]);

  // Fetch initial page
  React.useEffect(() => {
    if (page === 0 && allSwaps.length === 0) {
      fetchNextPage();
    }
  }, [page, allSwaps.length, fetchNextPage]);

  // Handle new swap from WebSocket stream
  React.useEffect(() => {
    if (!latestSwap) return;

    // Use a ref to prevent duplicate processing of same swap
    if (latestSwap === latestSwapRef.current) return;
    latestSwapRef.current = latestSwap;

    const mapped = mapDbRowToAdminSwap(latestSwap);

    // Check if we've already processed this swap ID
    if (processedSwapIds.current.has(mapped.id)) {
      return;
    }

    // Mark this swap as processed
    processedSwapIds.current.add(mapped.id);
    console.log("Adding new swap to list:", mapped.id);

    // Add to the list if not already present
    setAllSwaps((prev) => {
      if (prev.some((s) => s.id === mapped.id)) {
        return prev;
      }

      let newSwaps = [mapped, ...prev];

      // If we're at the top and have too many swaps, prune from the bottom
      if (isAtTop && newSwaps.length > MAX_SWAPS_IN_MEMORY) {
        const prunedCount = newSwaps.length - MAX_SWAPS_IN_MEMORY;
        console.log(`Pruning ${prunedCount} old swaps from memory (staying at top)`);
        newSwaps = newSwaps.slice(0, MAX_SWAPS_IN_MEMORY);

        // Track total pruned count
        setPrunedSwapCount((prev) => prev + prunedCount);

        // Adjust pagination to account for pruned items
        setHasMore(true);
      }

      return newSwaps;
    });

    // Add to animating set
    setAnimatingSwapIds((prev) => {
      const next = new Set(prev);
      next.add(mapped.id);
      return next;
    });

    // Remove from animating set after animation completes
    setTimeout(() => {
      setAnimatingSwapIds((prev) => {
        const next = new Set(prev);
        next.delete(mapped.id);
        return next;
      });
    }, 1000);
  }, [latestSwap, isAtTop]);

  // Handle updated swap from WebSocket stream
  React.useEffect(() => {
    if (!updatedSwap) return;

    // Use a ref to prevent duplicate processing
    if (updatedSwap === updatedSwapRef.current) return;
    updatedSwapRef.current = updatedSwap;

    const mapped = mapDbRowToAdminSwap(updatedSwap);

    // console.log("Updating existing swap:", mapped.id);

    // Update the existing swap in the list
    setAllSwaps((prev) => prev.map((swap) => (swap.id === mapped.id ? mapped : swap)));

    // Add to updating animation set
    setUpdatingSwapIds((prev) => {
      const next = new Set(prev);
      next.add(mapped.id);
      return next;
    });

    // Remove from updating set after animation completes
    setTimeout(() => {
      setUpdatingSwapIds((prev) => {
        const next = new Set(prev);
        next.delete(mapped.id);
        return next;
      });
    }, 600);
  }, [updatedSwap]);

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      scrollPositionRef.current = el.scrollTop;

      // Check if we're at the top (within 50px)
      const wasAtTop = isAtTop;
      const nowAtTop = el.scrollTop < 50;
      setIsAtTop(nowAtTop);

      // If we scrolled away from the top, reset pruned count
      if (wasAtTop && !nowAtTop) {
        setPrunedSwapCount(0);
      }

      // Check if we need to load more when scrolling to bottom
      if (!isLoadingMore && hasMore) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 100) {
          fetchNextPage();
        }
      }
    },
    [isLoadingMore, hasMore, fetchNextPage, isAtTop]
  );

  return (
    <Box position="relative" w="100%">
      <GridFlex width="100%" heightBlocks={heightBlocks} contentPadding={0}>
        <Flex direction="column" w="100%" h="100%">
          {/* Header Row with Filter Buttons */}
          <Flex
            px="16px"
            pt="16px"
            pb="8px"
            fontSize="14px"
            align="center"
            fontWeight="bold"
            color={colorsAnalytics.textGray}
            flexShrink={0}
            justify="space-between"
          >
            <Flex align="center" flex="1">
              <Box w="50px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>#</Text>
              </Box>
              <Box w="107px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Swap ID</Text>
              </Box>
              <Box w="109px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Time</Text>
              </Box>
              <Box w="115px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>User</Text>
              </Box>
              <Box w="91px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Direction</Text>
              </Box>
              <Box w="150px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Amount</Text>
              </Box>
              <Box w="95px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Rift Fee</Text>
              </Box>
              <Box w="103px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Other Fees</Text>
              </Box>
              <Flex flex="1">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Flow</Text>
              </Flex>
            </Flex>

            {/* Filter Buttons */}
            <Flex gap="8px" ml="16px">
              <Button
                size="sm"
                onClick={() => setFilter("failed")}
                bg={filter === "failed" ? colorsAnalytics.greenBackground : "transparent"}
                borderWidth="2px"
                borderRadius="16px"
                borderColor={
                  filter === "failed" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
                }
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="12px"
                px="12px"
                _hover={
                  filter === "failed"
                    ? {}
                    : {
                        opacity: 0.8,
                      }
                }
              >
                Failed
              </Button>
              <Button
                size="sm"
                onClick={() => setFilter("created")}
                bg={filter === "created" ? colorsAnalytics.greenBackground : "transparent"}
                borderWidth="2px"
                borderRadius="16px"
                borderColor={
                  filter === "created" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
                }
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="12px"
                px="12px"
                _hover={
                  filter === "created"
                    ? {}
                    : {
                        opacity: 0.8,
                      }
                }
              >
                Awaiting Deposit
              </Button>
              <Button
                size="sm"
                onClick={() => setFilter("in-progress")}
                bg={filter === "in-progress" ? colorsAnalytics.greenBackground : "transparent"}
                borderWidth="2px"
                borderRadius="16px"
                borderColor={
                  filter === "in-progress"
                    ? colorsAnalytics.greenOutline
                    : colorsAnalytics.borderGray
                }
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="12px"
                px="12px"
                _hover={
                  filter === "in-progress"
                    ? {}
                    : {
                        opacity: 0.8,
                      }
                }
              >
                In-Progress
              </Button>
              <Button
                size="sm"
                onClick={() => setFilter("completed")}
                bg={filter === "completed" ? colorsAnalytics.greenBackground : "transparent"}
                borderWidth="2px"
                borderRadius="16px"
                borderColor={
                  filter === "completed" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
                }
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="12px"
                px="12px"
                _hover={
                  filter === "completed"
                    ? {}
                    : {
                        opacity: 0.8,
                      }
                }
              >
                Completed
              </Button>
              <Button
                size="sm"
                onClick={() => setFilter("all")}
                bg={filter === "all" ? colorsAnalytics.greenBackground : "transparent"}
                borderWidth="2px"
                borderRadius="16px"
                borderColor={
                  filter === "all" ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
                }
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize="12px"
                px="12px"
                _hover={
                  filter === "all"
                    ? {}
                    : {
                        opacity: 0.8,
                      }
                }
              >
                All
              </Button>
            </Flex>

            {/* Pruning Indicator
            {prunedSwapCount > 0 && isAtTop && (
              <Text
                fontSize="12px"
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
                ml="16px"
                fontStyle="italic"
              >
                {prunedSwapCount} older swaps pruned • Scroll down to load more
              </Text>
            )} */}
          </Flex>

          {/* Rows */}
          <Box
            flex="1"
            overflowY="auto"
            overflowX="hidden"
            onScroll={handleScroll}
            mr="8px"
            css={{
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#333",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "#444",
              },
            }}
            minHeight="0"
          >
            <Flex direction="column" w="100%">
              {isInitialLoad && swaps.length === 0 ? (
                <Flex justify="center" align="center" py="40px">
                  <Spinner size="md" color={colorsAnalytics.offWhite} />
                </Flex>
              ) : (
                <>
                  {swaps.map((s, idx) => {
                    const isNew = animatingSwapIds.has(s.id);
                    const isUpdating = updatingSwapIds.has(s.id);

                    return (
                      <Flex
                        key={s.id}
                        w="100%"
                        flexShrink={0}
                        transition="all 300ms ease"
                        animation={
                          isNew
                            ? "slideDownGreen 600ms ease"
                            : isUpdating
                              ? "pulseGreen 600ms ease"
                              : undefined
                        }
                      >
                        <Row
                          swap={s}
                          currentTime={currentTime}
                          onClick={() => {
                            setSelectedSwap(s);
                            setIsModalOpen(true);
                          }}
                        />
                      </Flex>
                    );
                  })}
                  {isLoadingMore && (
                    <Flex justify="center" py="12px" flexShrink={0}>
                      <Spinner size="sm" color={colorsAnalytics.offWhite} />
                    </Flex>
                  )}
                  {!hasMore && swaps.length > 0 && (
                    <Flex justify="center" py="12px" flexShrink={0}>
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        No more swaps to load
                      </Text>
                    </Flex>
                  )}
                  {swaps.length === 0 && !isInitialLoad && (
                    <Flex justify="center" py="40px">
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        No{" "}
                        {filter === "completed"
                          ? "completed"
                          : filter === "in-progress"
                            ? "in-progress"
                            : filter === "created"
                              ? "created"
                              : filter === "failed"
                                ? "failed"
                                : ""}{" "}
                        swaps found
                      </Text>
                    </Flex>
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Flex>
      </GridFlex>

      {/* Show Averages Button */}
      <Flex py="12px" mt="12px" w="100%" justify="center">
        <Button
          onClick={() => setShowAverages(!showAverages)}
          bg={colorsAnalytics.offBlack}
          borderWidth="2px"
          borderColor={colorsAnalytics.borderGray}
          color={colorsAnalytics.offWhite}
          fontFamily={FONT_FAMILIES.SF_PRO}
          fontSize="14px"
          borderRadius="16px"
          _hover={{
            borderColor: colorsAnalytics.borderGrayLight,
            bg: colorsAnalytics.offBlackLighter,
          }}
          size="sm"
          px="20px"
        >
          <Flex align="center" gap="8px">
            <Text>{showAverages ? "Hide Averages" : "Show Averages"}</Text>
            {showAverages ? <FiChevronUp /> : <FiChevronDown />}
          </Flex>
        </Button>
      </Flex>

      {/* Averages block below the container */}
      {showAverages && (
        <Flex pt="12px" w="100%">
          <GridFlex width="100%" heightBlocks={7} contentPadding={0}>
            <Flex direction="column" pt="10px" w="100%">
              {isLoadingAverages ? (
                <Flex justify="center" align="center" py="40px">
                  <Spinner size="md" color={colorsAnalytics.offWhite} />
                </Flex>
              ) : averagesData ? (
                <>
                  {/* BTC to ETH Averages */}
                  {averagesData.btc_to_eth.count > 0 && (
                    <Flex w="100%" py="14px" px="16px" align="center" letterSpacing={"-0.8px"}>
                      {/* Direction Label - aligned with ID column */}
                      <Box w="119px" ml="16px" mr="-16px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          fontWeight="bold"
                        >
                          BTC→ETH Averages
                        </Text>
                        <Text
                          fontSize="13px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {new Intl.NumberFormat("en-US").format(averagesData.btc_to_eth.count)}{" "}
                          Swaps
                        </Text>
                      </Box>

                      {/* Created column - skip */}
                      <Box w="115px" />

                      {/* Account column - skip */}
                      <Box w="125px" />

                      {/* Direction column - skip */}
                      <Box w="83px" />

                      {/* Swap Amount */}
                      <Box w="156px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          ${averagesData.btc_to_eth.averages.amount_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {averagesData.btc_to_eth.averages.amount_btc} BTC
                        </Text>
                      </Box>

                      {/* Rift Fee */}
                      <Box w="95px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          ${averagesData.btc_to_eth.averages.protocol_fee_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {averagesData.btc_to_eth.averages.protocol_fee_sats.toLocaleString()} sats
                        </Text>
                      </Box>

                      {/* Other Fees */}
                      <Box w="103px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          MM - ${averagesData.btc_to_eth.averages.liquidity_fee_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          GAS - ${averagesData.btc_to_eth.averages.network_fee_usd}
                        </Text>
                      </Box>

                      {/* Swap Flow Tracker */}
                      <Flex flex="1" gap="6px" wrap="wrap" align="center" mr="-16px">
                        {buildAverageFlowSteps("BTC_TO_EVM", averagesData.btc_to_eth.averages).map(
                          (step, idx) => (
                            <StepWithTime
                              key={`${step.status}-${idx}`}
                              step={step}
                              currentTime={currentTime}
                            />
                          )
                        )}
                        {/* Average Total Time */}
                        <Flex direction="column" align="center" justify="center" minW="60px">
                          <FiCheck color={colorsAnalytics.greenOutline} size={16} />
                          <Text
                            mt="6px"
                            fontSize="14px"
                            color={colorsAnalytics.greenOutline}
                            fontFamily={FONT_FAMILIES.SF_PRO}
                          >
                            {formatSecondsToMinSec(
                              averagesData.btc_to_eth.averages.time_full_seconds
                            )}
                          </Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  )}

                  {/* ETH to BTC Averages */}
                  {averagesData.eth_to_btc.count > 0 && (
                    <Flex w="100%" py="14px" px="16px" align="center" letterSpacing={"-0.8px"}>
                      {/* Direction Label */}
                      <Box w="119px" ml="16px" mr="-16px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          fontWeight="bold"
                        >
                          ETH→BTC Averages
                        </Text>
                        <Text
                          fontSize="13px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {new Intl.NumberFormat("en-US").format(averagesData.eth_to_btc.count)}{" "}
                          Swaps
                        </Text>
                      </Box>

                      <Box w="115px" />
                      <Box w="125px" />
                      <Box w="83px" />

                      {/* Swap Amount */}
                      <Box w="156px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          ${averagesData.eth_to_btc.averages.amount_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {averagesData.eth_to_btc.averages.amount_btc} BTC
                        </Text>
                      </Box>

                      {/* Rift Fee */}
                      <Box w="95px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          ${averagesData.eth_to_btc.averages.protocol_fee_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {averagesData.eth_to_btc.averages.protocol_fee_sats.toLocaleString()} sats
                        </Text>
                      </Box>

                      {/* Other Fees */}
                      <Box w="103px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          MM - ${averagesData.eth_to_btc.averages.liquidity_fee_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          GAS - ${averagesData.eth_to_btc.averages.network_fee_usd}
                        </Text>
                      </Box>

                      {/* Swap Flow Tracker */}
                      <Flex flex="1" gap="6px" wrap="wrap" align="center" mr="-16px">
                        {buildAverageFlowSteps("ETH_TO_BTC", averagesData.eth_to_btc.averages).map(
                          (step, idx) => (
                            <StepWithTime
                              key={`${step.status}-${idx}`}
                              step={step}
                              currentTime={currentTime}
                            />
                          )
                        )}
                        {/* Average Total Time */}
                        <Flex direction="column" align="center" justify="center" minW="60px">
                          <FiCheck color={colorsAnalytics.greenOutline} size={16} />
                          <Text
                            mt="6px"
                            fontSize="14px"
                            color={colorsAnalytics.greenOutline}
                            fontFamily={FONT_FAMILIES.SF_PRO}
                          >
                            {formatSecondsToMinSec(
                              averagesData.eth_to_btc.averages.time_full_seconds
                            )}
                          </Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  )}

                  {/* Combined Average */}
                  {averagesData.combined && (
                    <Flex
                      w="100%"
                      py="14px"
                      px="16px"
                      align="center"
                      letterSpacing={"-0.8px"}
                      mt="12px"
                      pt="24px"
                      borderTop={`2px solid ${colorsAnalytics.borderGray}`}
                    >
                      {/* Combined Label */}
                      <Box w="119px" ml="16px" mr="-16px">
                        <Text
                          fontSize="15px"
                          color={colorsAnalytics.greenOutline}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          fontWeight="bold"
                        >
                          Combined Average
                        </Text>
                        <Text
                          fontSize="13px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {new Intl.NumberFormat("en-US").format(averagesData.combined.count)} Total
                          Swaps
                        </Text>
                      </Box>

                      <Box w="115px" />
                      <Box w="125px" />
                      <Box w="83px" />

                      {/* Combined Swap Amount */}
                      <Box w="156px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          ${averagesData.combined.averages.amount_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {averagesData.combined.averages.amount_btc} BTC
                        </Text>
                      </Box>

                      {/* Rift Fee */}
                      <Box w="95px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          ${averagesData.combined.averages.protocol_fee_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {averagesData.combined.averages.protocol_fee_sats.toLocaleString()} sats
                        </Text>
                      </Box>

                      {/* Other Fees */}
                      <Box w="103px">
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          MM - ${averagesData.combined.averages.liquidity_fee_usd}
                        </Text>
                        <Text
                          fontSize="14px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          GAS - ${averagesData.combined.averages.network_fee_usd}
                        </Text>
                      </Box>

                      {/* Combined Average Total Time - just show final time, no individual steps */}
                      <Flex flex="1" justify="flex-start" align="center" pl="10px" mr="-16px">
                        <Flex direction="column" align="center" justify="center" minW="60px">
                          <FiCheck color={colorsAnalytics.greenOutline} size={16} />
                          <Text
                            mt="6px"
                            fontSize="14px"
                            color={colorsAnalytics.greenOutline}
                            fontFamily={FONT_FAMILIES.SF_PRO}
                          >
                            {formatSecondsToMinSec(
                              averagesData.combined.averages.time_full_seconds
                            )}
                          </Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  )}
                </>
              ) : null}
            </Flex>
          </GridFlex>
        </Flex>
      )}

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

        @keyframes slideDownGreen {
          0% {
            transform: translateY(-12px);
            opacity: 0;
            background-color: rgba(34, 197, 94, 0.15);
          }
          20% {
            background-color: rgba(34, 197, 94, 0.15);
          }
          100% {
            transform: translateY(0);
            opacity: 1;
            background-color: transparent;
          }
        }

        @keyframes pulseGreen {
          0% {
            background-color: transparent;
          }
          50% {
            background-color: rgba(34, 197, 94, 0.15);
          }
          100% {
            background-color: transparent;
          }
        }
      `}</style>

      {/* Swap Details Modal */}
      {selectedSwap && (
        <Dialog.Root open={isModalOpen} onOpenChange={(e) => setIsModalOpen(e.open)}>
          <Portal>
            <Dialog.Backdrop
              bg="rgba(0, 0, 0, 0.8)"
              backdropFilter="blur(4px)"
              position="fixed"
              inset="0"
              zIndex={1000}
            />
            <Dialog.Positioner
              position="fixed"
              inset="0"
              zIndex={1001}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Dialog.Content
                bg={colorsAnalytics.offBlack}
                border={`2px solid ${colorsAnalytics.borderGray}`}
                borderRadius="16px"
                p="32px"
                maxW="900px"
                maxH="90vh"
                overflowY="auto"
                css={{
                  "&::-webkit-scrollbar": {
                    width: "8px",
                  },
                  "&::-webkit-scrollbar-track": {
                    background: "transparent",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background: "#333",
                    borderRadius: "4px",
                  },
                }}
              >
                <Flex justify="space-between" align="center" mb="24px">
                  <Dialog.Title>
                    <Text
                      fontSize="24px"
                      fontWeight="bold"
                      color={colorsAnalytics.offWhite}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                    >
                      Swap Details
                    </Text>
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <Button
                      size="sm"
                      bg="transparent"
                      border={`2px solid ${colorsAnalytics.borderGray}`}
                      borderRadius="8px"
                      color={colorsAnalytics.offWhite}
                      _hover={{ filter: "brightness(1.2)" }}
                      p="8px"
                    >
                      <FiX size={20} />
                    </Button>
                  </Dialog.CloseTrigger>
                </Flex>

                <Flex direction="column" gap="20px">
                  {/* Swap ID */}
                  <Flex direction="column" gap="8px">
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.textGray}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontWeight="bold"
                    >
                      Swap ID
                    </Text>
                    <Flex
                      as="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedSwap.id);
                        toastSuccess({
                          title: "Copied to clipboard",
                          description: `Swap ID copied`,
                        });
                      }}
                      bg="#1D1D1D"
                      px="12px"
                      py="8px"
                      borderRadius="8px"
                      _hover={{ filter: "brightness(1.1)" }}
                      cursor="pointer"
                      align="center"
                      justify="space-between"
                    >
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        {selectedSwap.id}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Direction & Chain */}
                  <Flex gap="20px">
                    <Flex direction="column" gap="8px" flex="1">
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontWeight="bold"
                      >
                        Direction
                      </Text>
                      <Text
                        fontSize="16px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        {selectedSwap.direction === "BTC_TO_EVM" ? "BTC → ETH" : "ETH → BTC"}
                      </Text>
                    </Flex>
                    <Flex direction="column" gap="8px" flex="1">
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontWeight="bold"
                      >
                        Chain
                      </Text>
                      <Text
                        fontSize="16px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        {selectedSwap.chain}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* User Account */}
                  <Flex direction="column" gap="8px">
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.textGray}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontWeight="bold"
                    >
                      User Account
                    </Text>
                    <Flex
                      as="button"
                      onClick={() =>
                        window.open(
                          explorerUrl(selectedSwap.chain, selectedSwap.evmAccountAddress),
                          "_blank"
                        )
                      }
                      bg="#1D1D1D"
                      px="12px"
                      py="8px"
                      borderRadius="8px"
                      _hover={{ filter: "brightness(1.1)" }}
                      cursor="pointer"
                      justify="space-between"
                      align="center"
                    >
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        {selectedSwap.evmAccountAddress}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Swap Amount */}
                  <Flex direction="column" gap="8px">
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.textGray}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontWeight="bold"
                    >
                      Swap Amount
                    </Text>
                    <Flex direction="column">
                      <Text
                        fontSize="18px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontWeight="bold"
                      >
                        {formatUSD(selectedSwap.swapInitialAmountUsd)}
                      </Text>
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        {formatBTC(selectedSwap.swapInitialAmountBtc)}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Fees Section */}
                  <Flex direction="column" gap="16px">
                    <Text
                      fontSize="16px"
                      color={colorsAnalytics.offWhite}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontWeight="bold"
                    >
                      Fees Breakdown
                    </Text>

                    <Flex direction="column" gap="12px" pl="12px">
                      {/* Rift Fee */}
                      <Flex direction="column" gap="4px">
                        <Text
                          fontSize="13px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          Rift Fee
                        </Text>
                        <Flex gap="12px" align="center">
                          <Text
                            fontSize="15px"
                            color={colorsAnalytics.offWhite}
                            fontFamily={FONT_FAMILIES.SF_PRO}
                          >
                            {selectedSwap.riftFeeSats.toLocaleString()} sats
                          </Text>
                          <Text
                            fontSize="13px"
                            color={colorsAnalytics.textGray}
                            fontFamily={FONT_FAMILIES.SF_PRO}
                          >
                            (
                            {formatUSD(
                              (selectedSwap.riftFeeSats / 100000000) *
                                (selectedSwap.swapInitialAmountUsd /
                                  selectedSwap.swapInitialAmountBtc)
                            )}
                            )
                          </Text>
                        </Flex>
                      </Flex>

                      {/* Network Fee */}
                      <Flex direction="column" gap="4px">
                        <Text
                          fontSize="13px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          Network/Gas Fee
                        </Text>
                        <Text
                          fontSize="15px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {formatUSD(selectedSwap.networkFeeUsd)}
                        </Text>
                      </Flex>

                      {/* Market Maker Fee */}
                      <Flex direction="column" gap="4px">
                        <Text
                          fontSize="13px"
                          color={colorsAnalytics.textGray}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          Market Maker Fee
                        </Text>
                        <Text
                          fontSize="15px"
                          color={colorsAnalytics.offWhite}
                          fontFamily={FONT_FAMILIES.SF_PRO}
                        >
                          {formatUSD(selectedSwap.mmFeeUsd)}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>

                  {/* Timestamps */}
                  {selectedSwap.stepTimestamps && (
                    <Flex direction="column" gap="8px">
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.textGray}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontWeight="bold"
                      >
                        Created
                      </Text>
                      <Text
                        fontSize="14px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        {new Date(selectedSwap.swapCreationTimestamp).toLocaleString()}
                      </Text>
                    </Flex>
                  )}

                  {/* Flow Status */}
                  <Flex direction="column" gap="12px">
                    <Text
                      fontSize="16px"
                      color={colorsAnalytics.offWhite}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontWeight="bold"
                    >
                      Swap Flow Status
                    </Text>
                    <Flex direction="column" gap="8px">
                      {selectedSwap.flow
                        .filter((s) => s.status !== "settled")
                        .map((step, idx) => (
                          <Flex key={idx} align="center" gap="12px">
                            <Box>
                              {step.state === "completed" ? (
                                <FiCheck color={colorsAnalytics.greenOutline} size={16} />
                              ) : step.state === "inProgress" ? (
                                <FiClock color={colorsAnalytics.textGray} size={16} />
                              ) : (
                                <Box
                                  w="16px"
                                  h="16px"
                                  borderRadius="50%"
                                  border={`2px solid ${colorsAnalytics.borderGray}`}
                                />
                              )}
                            </Box>
                            <Text
                              fontSize="14px"
                              color={
                                step.state === "completed"
                                  ? colorsAnalytics.offWhite
                                  : colorsAnalytics.textGray
                              }
                              fontFamily={FONT_FAMILIES.SF_PRO}
                            >
                              {step.label}
                              {step.duration && ` (${step.duration})`}
                            </Text>
                          </Flex>
                        ))}
                    </Flex>
                  </Flex>

                  {/* Raw Data Section */}
                  {selectedSwap.rawData && (
                    <Flex
                      direction="column"
                      gap="12px"
                      mt="20px"
                      pt="20px"
                      borderTop={`1px solid ${colorsAnalytics.borderGray}`}
                    >
                      <Text
                        fontSize="16px"
                        color={colorsAnalytics.offWhite}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        fontWeight="bold"
                      >
                        Complete Swap & Quote Data
                      </Text>
                      <Box
                        bg="#0a0a0a"
                        borderRadius="8px"
                        p="16px"
                        border={`1px solid ${colorsAnalytics.borderGray}`}
                        fontFamily="monospace"
                        fontSize="12px"
                        overflowX="auto"
                        css={{
                          "&::-webkit-scrollbar": {
                            height: "6px",
                          },
                          "&::-webkit-scrollbar-track": {
                            background: "transparent",
                          },
                          "&::-webkit-scrollbar-thumb": {
                            background: "#333",
                            borderRadius: "3px",
                          },
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            color: colorsAnalytics.offWhite,
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
                          navigator.clipboard.writeText(
                            JSON.stringify(selectedSwap.rawData, null, 2)
                          );
                          toastSuccess({
                            title: "Copied to clipboard",
                            description: "Complete swap data copied",
                          });
                        }}
                        bg={colorsAnalytics.greenBackground}
                        border={`2px solid ${colorsAnalytics.greenOutline}`}
                        color={colorsAnalytics.offWhite}
                        _hover={{ filter: "brightness(1.2)" }}
                        fontFamily={FONT_FAMILIES.SF_PRO}
                      >
                        Copy Raw Data to Clipboard
                      </Button>
                    </Flex>
                  )}
                </Flex>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </Box>
  );
};

export default SwapHistory;
