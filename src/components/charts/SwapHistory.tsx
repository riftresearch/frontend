import React from "react";
import Image from "next/image";
import { Box, Flex, Text, Spinner, Tooltip } from "@chakra-ui/react";
import { GridFlex } from "@/components/other/GridFlex";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { AdminSwapItem, AdminSwapFlowStep, SwapDirection } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FiClock, FiCheck } from "react-icons/fi";
import { getSwaps } from "@/utils/analyticsClient";
import { toastError } from "@/utils/toast";
import { useSwapStream } from "@/hooks/useSwapStream";

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
  const hasTx = step.txHash && step.txChain;
  const isClickable =
    hasTx &&
    (step.status === "waiting_user_deposit_initiated" ||
      step.status === "waiting_mm_deposit_initiated");

  const handleClick = () => {
    if (!step.txHash || !step.txChain) {
      toastError(null, {
        title: "Transaction Not Available",
        description: "Transaction hash not available yet",
      });
      return;
    }

    const url =
      step.txChain === "ETH"
        ? `https://etherscan.io/tx/${step.txHash}`
        : `https://mempool.space/tx/${step.txHash}`;

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
      _hover={
        isClickable
          ? { filter: "brightness(1.1)", transform: "scale(1.02)" }
          : undefined
      }
      transition="all 150ms ease"
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
          {swap.chain}
          {/* {swap.statusTesting} */}
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

function formatDuration(startMs: number, endMs: number): string {
  const diffSeconds = Math.floor((endMs - startMs) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function mapDbRowToAdminSwap(row: any, btcPriceUsd?: number): AdminSwapItem {
  const createdAtMs = new Date(row.created_at).getTime();
  const direction: SwapDirection = "EVM_TO_BTC";
  const status: string = (row.status || "pending") as string;
  const order: Array<AdminSwapFlowStep["status"]> = [
    "pending",
    "waiting_user_deposit_initiated",
    "waiting_user_deposit_confirmed",
    "waiting_mm_deposit_initiated",
    "waiting_mm_deposit_confirmed",
    "settled",
  ];
  const currentIndex = Math.max(0, order.indexOf(status as any));
  const userConfs = Number(row?.user_deposit_status?.confirmations || 0);
  const mmConfs = Number(row?.mm_deposit_status?.confirmations || 0);

  // Parse timestamps for duration calculations
  const createdAt = createdAtMs;
  const userDepositDetectedAt = row?.user_deposit_status?.deposit_detected_at
    ? new Date(row.user_deposit_status.deposit_detected_at).getTime()
    : null;
  const userConfirmedAt = row?.user_deposit_status?.confirmed_at
    ? new Date(row.user_deposit_status.confirmed_at).getTime()
    : null;
  const mmDepositDetectedAt = row?.mm_deposit_status?.deposit_detected_at
    ? new Date(row.mm_deposit_status.deposit_detected_at).getTime()
    : null;
  const mmPrivateKeySentAt = row?.mm_private_key_sent_at
    ? new Date(row.mm_private_key_sent_at).getTime()
    : null;

  // Calculate durations for each step
  // created -> user sent
  const durationCreatedToUserSent =
    userDepositDetectedAt && createdAt
      ? formatDuration(createdAt, userDepositDetectedAt)
      : undefined;

  // user sent -> confs
  const durationUserSentToConfs =
    userConfirmedAt && userDepositDetectedAt
      ? formatDuration(userDepositDetectedAt, userConfirmedAt)
      : undefined;

  // user confs -> mm sent
  const durationUserConfsToMmSent =
    mmDepositDetectedAt && userConfirmedAt
      ? formatDuration(userConfirmedAt, mmDepositDetectedAt)
      : undefined;

  // mm sent -> mm confs
  const durationMmSentToMmConfs =
    mmPrivateKeySentAt && mmDepositDetectedAt
      ? formatDuration(mmDepositDetectedAt, mmPrivateKeySentAt)
      : undefined;

  // Extract transaction hashes
  const userTxHash = row?.user_deposit_status?.tx_hash;
  const mmTxHash = row?.mm_deposit_status?.tx_hash;

  // Extract amounts - user_deposit_status.amount is in hex (wei for ETH tokens)
  // For cbBTC, it's 8 decimals like BTC
  const userDepositAmountHex = row?.user_deposit_status?.amount || "0x0";
  const mmDepositAmountHex = row?.mm_deposit_status?.amount || "0x0";

  // Convert hex to decimal and adjust for 8 decimals (cbBTC/BTC standard)
  const userDepositAmount = parseInt(userDepositAmountHex, 16) / 1e8;
  const mmDepositAmount = parseInt(mmDepositAmountHex, 16) / 1e8;

  // Use the user's deposit amount as the swap amount (in BTC)
  const swapAmountBtc = userDepositAmount || 0.001;
  const swapAmountUsd = btcPriceUsd
    ? swapAmountBtc * btcPriceUsd
    : swapAmountBtc * 64000;

  // Estimate fees (these could come from the quote data if available)
  const riftFeeBtc = swapAmountBtc * 0.001; // 0.1% fee estimate
  const networkFeeUsd = 1.5; // Rough estimate
  const mmFeeUsd = swapAmountUsd * 0.002; // 0.2% MM fee estimate

  const steps: AdminSwapFlowStep[] = [
    {
      status: "pending",
      label: "Created",
      state: currentIndex > 0 ? "completed" : "inProgress",
      // No duration - this is the starting point
    },
    {
      status: "waiting_user_deposit_initiated",
      label: "User Sent",
      state:
        currentIndex > 1
          ? "completed"
          : currentIndex === 1
            ? "inProgress"
            : "notStarted",
      badge: "cbBTC",
      duration: durationCreatedToUserSent, // Time from created -> user sent
      txHash: userTxHash,
      txChain: "ETH", // User sends cbBTC on ETH
    },
    {
      status: "waiting_user_deposit_confirmed",
      label: `${userConfs} Confs`,
      state:
        currentIndex > 2
          ? "completed"
          : currentIndex === 2
            ? "inProgress"
            : "notStarted",
      duration: durationUserSentToConfs, // Time from user sent -> confs
    },
    {
      status: "waiting_mm_deposit_initiated",
      label: "MM Sent",
      state:
        currentIndex > 3
          ? "completed"
          : currentIndex === 3
            ? "inProgress"
            : "notStarted",
      badge: "BTC",
      duration: durationUserConfsToMmSent, // Time from user confs -> mm sent
      txHash: mmTxHash,
      txChain: "BTC", // MM sends BTC
    },
    {
      status: "waiting_mm_deposit_confirmed",
      label: `${mmConfs}+ Confs`,
      state:
        currentIndex > 4
          ? "completed"
          : currentIndex === 4
            ? "inProgress"
            : "notStarted",
      duration: durationMmSentToMmConfs, // Time from mm sent -> mm confs
    },
    {
      status: "settled",
      label: "Settled",
      state: currentIndex >= 5 ? "completed" : "notStarted",
      // No duration shown for final step
    },
  ];

  return {
    statusTesting: status,
    id: row.id,
    swapCreationTimestamp: createdAtMs,
    evmAccountAddress:
      row.user_evm_account_address ||
      row.user_deposit_address ||
      "0x0000000000000000000000000000000000000000",
    chain: "ETH",
    direction,
    swapInitialAmountBtc: swapAmountBtc,
    swapInitialAmountUsd: swapAmountUsd,
    riftFeeBtc,
    userConfs,
    mmConfs,
    networkFeeUsd,
    mmFeeUsd,
    flow: steps,
  };
}

export const SwapHistory: React.FC<{ heightBlocks?: number }> = ({
  heightBlocks = 13,
}) => {
  const storeSwaps = useAnalyticsStore((s) => s.adminSwaps);
  const btcPriceUsd = useAnalyticsStore((s) => s.btcPriceUsd);
  const [allSwaps, setAllSwaps] = React.useState<AdminSwapItem[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [newSwapId, setNewSwapId] = React.useState<string | null>(null);
  const pageSize = 20;

  // Connect to real-time swap stream
  const { latestSwap, isConnected } = useSwapStream();

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

    return Array.from(mergedMap.values()).sort(
      (a, b) => b.swapCreationTimestamp - a.swapCreationTimestamp
    );
  }, [allSwaps, storeSwaps]);

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

    // Helper to calculate average duration from flow steps
    function avgDuration(
      swaps: AdminSwapItem[],
      stepIndex: number
    ): string | undefined {
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
      const avgRiftFeeBtc = avg(list.map((s) => s.riftFeeBtc));
      const avgUserConfs = Math.round(avg(list.map((s) => s.userConfs || 0)));
      const avgMmConfs = Math.round(avg(list.map((s) => s.mmConfs || 0)));

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
        avgRiftFeeBtc,
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
      console.log(`Fetching page ${page} (${pageSize} swaps)...`);
      const data = await getSwaps(page, pageSize);
      const mapped = (data?.swaps || []).map((row: any) =>
        mapDbRowToAdminSwap(row, btcPriceUsd)
      );

      console.log(`Received ${mapped.length} swaps from page ${page}`);

      if (mapped.length < pageSize) {
        setHasMore(false);
      }

      setAllSwaps((prev) => {
        const existing = new Set(prev.map((s) => s.id));
        const newSwaps = mapped.filter((s) => !existing.has(s.id));
        console.log(
          `Added ${newSwaps.length} new swaps (${existing.size} existing)`
        );
        return [...prev, ...newSwaps];
      });

      setPage((p) => p + 1);
    } catch (error) {
      console.error("Error fetching swaps:", error);
    } finally {
      setIsLoadingMore(false);
      setIsInitialLoad(false);
    }
  }, [page, pageSize, isLoadingMore, hasMore, btcPriceUsd]);

  // Initial load
  React.useEffect(() => {
    fetchNextPage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle new swap from SSE stream
  React.useEffect(() => {
    if (latestSwap) {
      const mapped = mapDbRowToAdminSwap(latestSwap, btcPriceUsd);

      // Add to the list if not already present
      setAllSwaps((prev) => {
        if (prev.some((s) => s.id === mapped.id)) {
          return prev;
        }
        return [mapped, ...prev];
      });

      // Trigger animation
      setNewSwapId(mapped.id);
      setTimeout(() => setNewSwapId(null), 1000);
    }
  }, [latestSwap, btcPriceUsd]);

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoadingMore || !hasMore) return;
      const el = e.currentTarget;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 100) {
        fetchNextPage();
      }
    },
    [isLoadingMore, hasMore, fetchNextPage]
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
            flexShrink={0}
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
                  {swaps.map((s, idx) => (
                    <Flex
                      key={s.id}
                      w="100%"
                      flexShrink={0}
                      transition="all 300ms ease"
                      animation={
                        newSwapId === s.id
                          ? "slideDownGreen 600ms ease"
                          : undefined
                      }
                    >
                      <Row swap={s} />
                    </Flex>
                  ))}
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
                </>
              )}
            </Flex>
          </Box>
        </Flex>
      </GridFlex>
      {/* Averages block below the container */}
      <Flex pt="12px" w="100%">
        <GridFlex width="100%" heightBlocks={4.57} contentPadding={0}>
          <Flex direction="column" pt="10px" w="100%">
            {averages.map((a) => {
              const impliedUsdPerBtc = a.avgBtc > 0 ? a.avgUsd / a.avgBtc : 0;
              const riftFeeUsd = a.avgRiftFeeBtc * impliedUsdPerBtc;

              return (
                <Flex
                  key={a.dir}
                  w="100%"
                  py="14px"
                  px="16px"
                  align="center"
                  letterSpacing={"-0.8px"}
                >
                  {/* Direction Label - aligned with "Swap Created" column */}
                  <Box w="128px" ml="16px" mr="-16px">
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.offWhite}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                      fontWeight="bold"
                    >
                      {a.dir === "BTC_TO_EVM" ? "BTC→ETH" : "ETH→BTC"} Averages
                    </Text>
                    <Text
                      fontSize="13px"
                      color={colorsAnalytics.textGray}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                    >
                      {new Intl.NumberFormat("en-US").format(a.count)} Swaps
                    </Text>
                  </Box>

                  {/* Account column - skip */}
                  <Box w="115px" />

                  {/* Chain column - skip */}
                  <Box w="60px" />

                  {/* Swap Amount - aligned with amount column */}
                  <Box w="150px">
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.offWhite}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                    >
                      {formatUSD(a.avgUsd)}
                    </Text>
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.textGray}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                    >
                      {formatBTC(a.avgBtc)}
                    </Text>
                  </Box>

                  {/* Rift Fee - aligned with fee column */}
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
                      {formatBTC(a.avgRiftFeeBtc)}
                    </Text>
                  </Box>

                  {/* Other Fees column - skip */}
                  <Box w="110px" />

                  {/* Swap Flow Tracker - aligned with flow pills */}
                  <Flex flex="1" gap="10px" wrap="wrap" align="center">
                    {a.flow.map((step, idx) => (
                      <StepWithTime key={`${step.status}-${idx}`} step={step} />
                    ))}
                  </Flex>
                </Flex>
              );
            })}
          </Flex>
        </GridFlex>
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
      `}</style>
    </Box>
  );
};

export default SwapHistory;
