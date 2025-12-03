import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Flex, Text, Spinner, Button, Image } from "@chakra-ui/react";
import { useAccount } from "wagmi";
import { AdminSwapItem, AdminSwapFlowStep } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { mapDbRowToAdminSwap } from "@/utils/analyticsClient";
import { ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { reownModal } from "@/utils/wallet";
import { FiClock, FiCheck, FiX, FiExternalLink } from "react-icons/fi";
import { GridFlex } from "@/components/other/GridFlex";
import { useRouter } from "next/router";
import { filterRefunds } from "@/utils/refundHelpers";
import { toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { RefundModal } from "@/components/other/RefundModal";
import { useRefundModal } from "@/hooks/useRefundModal";
import { AssetIcon } from "@/components/other/AssetIcon";

function displayShortTxHash(hash: string, isMobile: boolean = false): string {
  if (!hash || hash.length < 12) return hash;
  const prefix = hash.startsWith("0x") ? "0x" : "";
  const hex = hash.replace(/^0x/, "");
  // Mobile: show 6 chars at start and 6 at end (20% shorter)
  // Desktop: show 8 chars at start and 8 at end
  const chars = isMobile ? 6 : 8;
  return `${prefix}${hex.slice(0, chars)}...${hex.slice(-chars)}`;
}

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatBTC(n: number) {
  return `${Number(n)
    .toFixed(8)
    .replace(/\.0+$/, "")
    .replace(/(\.[0-9]*?)0+$/, "$1")} BTC`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

const StatusBadge: React.FC<{ swap: AdminSwapItem; onClaimRefund?: () => void }> = ({
  swap,
  onClaimRefund,
}) => {
  // Find the current step based on status priority
  const currentStep =
    swap.flow.find((s) => s.state === "inProgress") || swap.flow[swap.flow.length - 1];
  const currentStatus = currentStep?.status;
  const isRefundAvailable = (swap as any).isRefundAvailable;

  // Refunded: refunding_user, refunding_mm, or user_refunded_detected (regardless of isRefundAvailable)
  if (
    currentStatus === "refunding_user" ||
    currentStatus === "refunding_mm" ||
    currentStatus === "user_refunded_detected"
  ) {
    return (
      <Flex
        align="center"
        gap="6px"
        bg="rgba(251, 191, 36, 0.15)"
        border="1.5px solid rgba(251, 191, 36, 0.4)"
        borderRadius="16px"
        px="12px"
        h="35px"
      >
        <FiCheck size={14} color="#fbbf24" />
        <Text
          fontSize="13px"
          color="#fbbf24"
          fontWeight="500"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
        >
          Refunded
        </Text>
      </Flex>
    );
  }

  // Refund Available: show claim refund button
  if (isRefundAvailable) {
    return (
      <Flex
        as="button"
        onClick={(e) => {
          e.stopPropagation();
          onClaimRefund?.();
        }}
        align="center"
        gap="6px"
        bg="rgba(178, 50, 50, 0.15)"
        border="1.5px solid rgba(178, 50, 50, 0.4)"
        borderRadius="16px"
        px="12px"
        h="35px"
        cursor="pointer"
        _hover={{ filter: "brightness(1.2)" }}
      >
        <Text
          fontSize="13px"
          color="#E74C4C"
          fontWeight="500"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
        >
          Claim Refund
        </Text>
      </Flex>
    );
  }

  // Completed: waiting_mm_deposit_confirmed or settled
  if (currentStatus === "waiting_mm_deposit_confirmed" || currentStatus === "settled") {
    return (
      <Flex
        align="center"
        gap="6px"
        bg="rgba(34, 197, 94, 0.15)"
        border="1.5px solid rgba(34, 197, 94, 0.4)"
        borderRadius="16px"
        px="12px"
        h="35px"
      >
        <FiCheck size={14} color="#22c55e" />
        <Text
          fontSize="13px"
          color="#22c55e"
          fontWeight="500"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
        >
          Completed
        </Text>
      </Flex>
    );
  }

  // Confirming: waiting_user_deposit_confirmed
  if (currentStatus === "waiting_user_deposit_confirmed") {
    return (
      <Flex
        align="center"
        gap="6px"
        bg="rgba(59, 130, 246, 0.15)"
        border="1.5px solid rgba(59, 130, 246, 0.4)"
        borderRadius="16px"
        px="12px"
        h="35px"
      >
        <Spinner size="xs" color="#3b82f6" />
        <Text
          fontSize="13px"
          color="#3b82f6"
          fontWeight="500"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
        >
          Confirming
          <Text as="span" letterSpacing="-2px">
            ...
          </Text>
        </Text>
      </Flex>
    );
  }

  // Swapping: waiting_mm_deposit_initiated (default for other in-progress states)
  return (
    <Flex
      align="center"
      gap="6px"
      bg="rgba(251, 191, 36, 0.15)"
      border="1.5px solid rgba(251, 191, 36, 0.4)"
      borderRadius="16px"
      px="12px"
      h="35px"
    >
      <Spinner size="xs" color="#fbbf24" />
      <Text
        fontSize="13px"
        color="#fbbf24"
        fontWeight="500"
        fontFamily={FONT_FAMILIES.AUX_MONO}
        letterSpacing="-0.5px"
      >
        Swapping
        <Text as="span" letterSpacing="-2px">
          ...
        </Text>
      </Text>
    </Flex>
  );
};

async function fetchUserSwaps(
  account: string,
  limit: number,
  offset: number
): Promise<{ swaps: AdminSwapItem[]; hasMore: boolean }> {
  try {
    const url = `${ANALYTICS_API_URL}/api/swaps?account=${account}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Failed to fetch user swaps:", response.status);
      return { swaps: [], hasMore: false };
    }

    const data = await response.json();
    console.log("[FETCH USER SWAPS] Data:", data);
    if (!data.swaps || !Array.isArray(data.swaps)) {
      return { swaps: [], hasMore: false };
    }

    const allSwaps = await Promise.all(
      data.swaps.map(async (row: any) => {
        console.log("[FETCH USER SWAPS] Raw row for swap:", row.id, {
          metadata: row.metadata,
          start_asset: row.metadata?.start_asset,
        });
        const mappedSwap = mapDbRowToAdminSwap(row);

        // Check if refund is available based on server flag and balance check
        const { isRefundAvailable, shouldMarkAsRefunded } = await filterRefunds(row, mappedSwap);

        // If server says refund available but balance is 0, mark as refunded
        if (shouldMarkAsRefunded && mappedSwap.flow.length > 0) {
          console.log(`[REFUND DETECTED] Swap ${mappedSwap.id}: Balance is 0, marking as refunded`);
          console.log(
            `[REFUND DETECTED] Current flow:`,
            mappedSwap.flow.map((s) => ({ status: s.status, state: s.state }))
          );

          // Find the in-progress step (the failed step that never completed)
          const inProgressIndex = mappedSwap.flow.findIndex((s) => s.state === "inProgress");

          if (inProgressIndex !== -1) {
            // Keep all steps up to but NOT including the in-progress step
            const stepsBeforeFailed = mappedSwap.flow.slice(0, inProgressIndex);
            const failedStep = mappedSwap.flow[inProgressIndex];

            // Mark the failed step as completed but keep its original status
            failedStep.state = "completed";

            // Add a new "Refunded" step after the failed step
            mappedSwap.flow = [
              ...stepsBeforeFailed,
              failedStep,
              {
                status: "user_refunded_detected",
                label: "Refunded",
                state: "completed",
              },
            ];
          }

          console.log(
            `[REFUND DETECTED] Updated flow:`,
            mappedSwap.flow.map((s) => ({ status: s.status, state: s.state }))
          );
        }

        return {
          ...mappedSwap,
          isRefundAvailable,
        };
      })
    );

    // Filter out swaps that are pending or at waiting_user_deposit_initiated WITHOUT a refund available
    // (these are created but user never deposited)
    // But KEEP waiting_user_deposit_initiated swaps that have refund available (partial deposits)

    const swaps = allSwaps.filter((swap: AdminSwapItem) => {
      const currentStep =
        swap.flow.find((s: AdminSwapFlowStep) => s.state === "inProgress") ||
        swap.flow[swap.flow.length - 1];
      const currentStatus = currentStep?.status;
      const swapIsRefundAvailable = (swap as any).isRefundAvailable;

      console.log("[FETCH USER SWAPS] Filtering swap:", swap.id, {
        currentStatus,
        swapIsRefundAvailable,
      });

      // Exclude pending swaps
      if (currentStatus === "pending") return false;

      // Exclude waiting_user_deposit_initiated UNLESS refund is available (partial deposit case)
      if (currentStatus === "waiting_user_deposit_initiated") {
        return swapIsRefundAvailable === true;
      }

      return true;
    });

    console.log("[FETCH USER SWAPS] Swaps after filtering:", swaps);

    const hasMore = allSwaps.length === limit; // If we got a full page, there might be more

    return { swaps, hasMore };
  } catch (error) {
    console.error("Error fetching user swaps:", error);
    return { swaps: [], hasMore: false };
  }
}

interface UserSwapHistoryProps {
  onInitialLoadComplete?: () => void;
  simulatedAddress?: string; // Optional simulated address for admin view
}

export const UserSwapHistory: React.FC<UserSwapHistoryProps> = ({
  onInitialLoadComplete,
  simulatedAddress,
}) => {
  const { address: walletAddress, isConnected } = useAccount();

  // Use simulated address if provided, otherwise use wallet address
  const address = simulatedAddress || walletAddress;
  const isSimulating = !!simulatedAddress;
  const router = useRouter();
  const { isMobile } = useWindowSize();
  const [swaps, setSwaps] = useState<AdminSwapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 15; // Load 15 swaps per page to enable scrolling without overwhelming
  const fetchingRef = useRef(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Use refund modal hook
  const {
    refundModalOpen,
    selectedFailedSwap,
    refundAddress,
    setRefundAddress,
    isClaimingRefund,
    refundStatus,
    currentBitcoinFee,
    fetchingFee,
    openRefundModal,
    closeRefundModal,
    claimRefund,
  } = useRefundModal({
    onSuccess: () => {
      // Refresh the swaps list to update the status after successful refund
      if (address) {
        fetchUserSwaps(address, pageSize, 0).then(({ swaps: newSwaps }) => {
          setSwaps(newSwaps);
        });
      }
    },
  });

  // Swap details modal state
  const [selectedSwap, setSelectedSwap] = useState<AdminSwapItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Handle initial mount - wait briefly for wallet to auto-reconnect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
      onInitialLoadComplete?.();
    }, 500); // Wait 500ms for wallet to auto-reconnect

    return () => clearTimeout(timer);
  }, [onInitialLoadComplete]);

  // Fetch initial swaps with retry logic and set up polling
  useEffect(() => {
    // Skip if no address (not connected and not simulating)
    if (!address || (!isConnected && !isSimulating)) {
      setSwaps([]);
      setPage(0);
      setHasMore(true);
      return;
    }

    // Initial fetch with retries
    const fetchWithRetries = async () => {
      setLoading(true);

      // First attempt
      let result = await fetchUserSwaps(address, pageSize, 0);

      // If no swaps found, retry 2 more times with 100ms delay
      if (result.swaps.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        result = await fetchUserSwaps(address, pageSize, 0);

        if (result.swaps.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          result = await fetchUserSwaps(address, pageSize, 0);
        }
      }

      setSwaps(result.swaps);
      setHasMore(result.hasMore);
      setPage(1);
      setLoading(false);
    };

    fetchWithRetries();

    // Set up polling every 3 seconds - only refresh first page
    const pollInterval = setInterval(() => {
      fetchUserSwaps(address, pageSize, 0).then(({ swaps: newSwaps }) => {
        setSwaps((prev) => {
          // Update existing swaps and add any new ones from first page
          const existingIds = new Set(prev.slice(pageSize).map((s) => s.id));
          const updatedFirstPage = newSwaps.filter((s) => !existingIds.has(s.id));
          return [...updatedFirstPage, ...prev.slice(pageSize)];
        });
      });
    }, 3000);

    // Cleanup interval on unmount or when address/connection changes
    return () => clearInterval(pollInterval);
  }, [address, isConnected, isSimulating]);

  // Fetch next page
  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !hasMore || fetchingRef.current || !address) return;

    fetchingRef.current = true;
    setLoadingMore(true);

    try {
      const offset = page * pageSize;
      const { swaps: newSwaps, hasMore: more } = await fetchUserSwaps(address, pageSize, offset);

      setSwaps((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const filtered = newSwaps.filter((s) => !existingIds.has(s.id));
        return [...prev, ...filtered];
      });

      setHasMore(more);
      setPage((p) => p + 1);
    } catch (error) {
      console.error("Error fetching next page:", error);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [address, page, pageSize, loadingMore, hasMore]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (loadingMore || !hasMore) return;
      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 100) {
        fetchNextPage();
      }
    },
    [loadingMore, hasMore, fetchNextPage]
  );

  const handleConnectWallet = async () => {
    await reownModal.open();
  };

  // Show loading spinner during initial mount
  if (isInitialMount) {
    return (
      <Flex w="100%" h="60vh" align="center" justify="center" mt={isMobile ? "80px" : "0"}>
        <Spinner size="xl" color={colors.offWhite} />
      </Flex>
    );
  }

  // Only show "not connected" UI if not simulating and not connected
  if (!isConnected && !isSimulating) {
    return (
      <GridFlex
        width={isMobile ? "100%" : "100%"}
        contentPadding={isMobile ? "40px 20px" : "60px"}
        borderRadius="60px"
        mt={isMobile ? "80px" : "0"}
      >
        <Flex direction="column" w="100%" align="center">
          <Text
            fontSize={isMobile ? "24px" : "30px"}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colors.offWhite}
            mb="16px"
            textAlign="center"
          >
            Swap History
          </Text>
          <Text
            fontSize={isMobile ? "14px" : "14px"}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.textGray}
            letterSpacing="-0.5px"
            mb="32px"
            textAlign="center"
          >
            Connect your wallet to view your swap history and track the status of your current and
            previous Rift swaps.
          </Text>
          <Button
            letterSpacing="-0.5px"
            onClick={handleConnectWallet}
            cursor="pointer"
            color={colors.offWhite}
            _active={{ bg: colors.swapBgColor }}
            _hover={{ bg: colors.swapHoverColor }}
            borderRadius="26px"
            border={`2.5px solid ${colors.swapBorderColor}`}
            type="button"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            fontSize={isMobile ? "15px" : "17px"}
            paddingX={isMobile ? "24px" : "32px"}
            paddingY="12px"
            bg={colors.swapBgColor}
            boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
          >
            Connect Wallet
          </Button>
        </Flex>
      </GridFlex>
    );
  }

  return (
    <>
      <GridFlex
        // maxW="750px"
        w="100%"
        contentPadding={isMobile ? "20px" : "32px"}
        borderRadius="40px"
        mb="15px"
        mt={isMobile ? "80px" : "0"}
      >
        <Flex direction="column" w="100%" align="center">
          <Text
            fontSize={isMobile ? "24px" : "30px"}
            mt={isMobile ? "-8px" : "-15px"}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colorsAnalytics.offWhite}
            textAlign="center"
          >
            Swap History
          </Text>
          <Text
            fontSize={isMobile ? "13px" : "13px"}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colorsAnalytics.textGray}
            mt="-2px"
            mb="-9px"
            letterSpacing="-0.5px"
            textAlign="center"
          >
            Manage the status of your current and previous Rift swaps.
          </Text>
        </Flex>
      </GridFlex>
      {isMobile ? (
        // Mobile: Simple scrollable container
        <Flex direction="column" w="100%" maxW="750px" pb="20px" mx="auto">
          {loading ? (
            <Flex w="100%" justify="center" align="center" py="80px">
              <Spinner size="lg" color={colors.offWhite} />
            </Flex>
          ) : swaps.length === 0 ? (
            <Flex w="100%" direction="column" align="center" justify="center" py="80px">
              <Text
                fontSize="18px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                letterSpacing="-0.5px"
                color={colors.textGray}
                mb="20px"
              >
                No swaps history found
              </Text>
              <Button
                onClick={() => router.push("/")}
                cursor="pointer"
                color={colors.offWhite}
                _active={{ bg: colors.swapBgColor }}
                _hover={{ bg: colors.swapHoverColor }}
                borderRadius="12px"
                border={`2.5px solid ${colors.swapBorderColor}`}
                type="button"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="17px"
                paddingX="32px"
                paddingY="12px"
                bg={colors.swapBgColor}
                boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
              >
                Create Swap
              </Button>
            </Flex>
          ) : (
            <Flex direction="column" w="100%">
              {/* Mobile Card Layout */}
              {swaps.map((swap) => {
                const userDepositStep = swap.flow.find(
                  (s) => s.status === "waiting_user_deposit_initiated"
                );
                const mmDepositStep = swap.flow.find(
                  (s) => s.status === "waiting_mm_deposit_initiated"
                );
                let userTxHash = userDepositStep?.txHash;
                const userTxChain = userDepositStep?.txChain;
                let mmTxHash = mmDepositStep?.txHash;
                const mmTxChain = mmDepositStep?.txChain;

                // Add 0x prefix to Ethereum transaction hashes if missing
                if (userTxHash && userTxChain !== "BTC" && !userTxHash.startsWith("0x")) {
                  userTxHash = `0x${userTxHash}`;
                }
                if (mmTxHash && mmTxChain !== "BTC" && !mmTxHash.startsWith("0x")) {
                  mmTxHash = `0x${mmTxHash}`;
                }

                // Determine colors based on direction
                // BTC_TO_EVM: User deposits BTC (orange), MM pays out cbBTC (blue)
                // EVM_TO_BTC: User deposits cbBTC (blue), MM pays out BTC (orange)
                const isBTCtoEVM = swap.direction === "BTC_TO_EVM";
                const userBg = isBTCtoEVM ? "rgba(255, 143, 40, 0.15)" : "rgba(57, 74, 255, 0.2)";
                const userBorder = isBTCtoEVM
                  ? "rgba(255, 143, 40, 0.4)"
                  : "rgba(57, 74, 255, 0.7)";
                const userColor = isBTCtoEVM ? "#FF8F28" : "#7A9EFF";
                const mmBg = isBTCtoEVM ? "rgba(57, 74, 255, 0.2)" : "rgba(255, 143, 40, 0.15)";
                const mmBorder = isBTCtoEVM ? "rgba(57, 74, 255, 0.7)" : "rgba(255, 143, 40, 0.4)";
                const mmColor = isBTCtoEVM ? "#7A9EFF" : "#FF8F28";

                // Amount color matches deposit transaction color
                const amountColor = userColor;

                // Debug: Log metadata for this swap
                console.log("[RENDER SWAP] ID:", swap.id, {
                  direction: swap.direction,
                  startAssetMetadata: swap.startAssetMetadata,
                  hasMetadata: !!swap.startAssetMetadata,
                });

                const lastStep = swap.flow[swap.flow.length - 1];
                const isCompleted =
                  lastStep?.state === "completed" && lastStep?.status === "settled";
                const isRefundAvailable = (swap as any).isRefundAvailable;

                // Check if swap is refunded
                const currentStep =
                  swap.flow.find((s) => s.state === "inProgress") ||
                  swap.flow[swap.flow.length - 1];
                const isRefunded =
                  currentStep?.status === "refunding_user" ||
                  currentStep?.status === "refunding_mm" ||
                  (currentStep?.status as string) === "user_refunded_detected";

                return (
                  <Flex
                    key={swap.id}
                    direction="column"
                    w="100%"
                    p="20px"
                    mb="12px"
                    bg="rgba(10, 10, 10, 0.85)"
                    borderRadius="28px"
                    border={`1px solid ${colors.borderGray}`}
                    _hover={{ bg: "rgba(28, 28, 28, 0.9)" }}
                    transition="background 0.15s ease"
                    cursor="pointer"
                    onClick={() => router.push(`/swap/${swap.id}`)}
                    gap="12px"
                  >
                    {/* USD and Time - Combined Row */}
                    <Flex gap="20px" align="flex-start">
                      {/* USD */}
                      <Flex direction="column" gap="4px">
                        <Text
                          fontSize="10px"
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          color={colors.textGray}
                          textTransform="uppercase"
                          fontWeight="600"
                          letterSpacing="0.5px"
                        >
                          USD
                        </Text>
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {formatUSD(swap.swapInitialAmountUsd)}
                        </Text>
                      </Flex>

                      {/* Time - Clickable to open details modal */}
                      <Flex
                        direction="column"
                        gap="4px"
                        cursor="pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSwap(swap);
                          setIsDetailsModalOpen(true);
                        }}
                        _hover={{ opacity: 0.8 }}
                      >
                        <Text
                          fontSize="10px"
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          color={colors.textGray}
                          textTransform="uppercase"
                          fontWeight="600"
                          letterSpacing="0.5px"
                        >
                          Time
                        </Text>
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {formatTimeAgo(swap.swapCreationTimestamp)}
                        </Text>
                      </Flex>
                    </Flex>

                    {/* Amount Row */}
                    <Flex gap="20px" align="flex-start">
                      {/* Amount */}
                      <Flex direction="column" gap="4px">
                        <Text
                          fontSize="10px"
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          color={colors.textGray}
                          textTransform="uppercase"
                          fontWeight="600"
                          letterSpacing="0.5px"
                        >
                          Amount
                        </Text>
                        <Flex gap="4px" align="center" flexWrap="wrap">
                          {swap.direction === "EVM_TO_BTC" && swap.startAssetMetadata ? (
                            // Show ERC20 → BTC for EVM->BTC swaps
                            <>
                              {/* Input Amount + Asset */}
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.offWhite}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                {parseFloat(swap.startAssetMetadata.amount)
                                  .toFixed(Math.min(swap.startAssetMetadata.decimals, 6))
                                  .replace(/\.?0+$/, "")}
                              </Text>
                              <AssetIcon
                                asset={swap.startAssetMetadata.ticker}
                                iconUrl={swap.startAssetMetadata.icon}
                              />
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.textGray}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                {swap.startAssetMetadata.ticker}
                              </Text>

                              {/* Arrow */}
                              <Text
                                fontSize="12px"
                                color="rgba(255, 255, 255, 0.4)"
                                fontWeight="bold"
                              >
                                →
                              </Text>

                              {/* Output Amount + Asset (BTC) */}
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.offWhite}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                              </Text>
                              <AssetIcon asset="BTC" />
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.textGray}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                BTC
                              </Text>
                            </>
                          ) : (
                            // Show BTC → ERC20 for BTC->EVM swaps or legacy swaps
                            <>
                              {/* Input Amount + Asset (BTC) */}
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.offWhite}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                              </Text>
                              <AssetIcon asset="BTC" />
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.textGray}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                BTC
                              </Text>

                              {/* Arrow */}
                              <Text
                                fontSize="12px"
                                color="rgba(255, 255, 255, 0.4)"
                                fontWeight="bold"
                              >
                                →
                              </Text>

                              {/* Output Amount + Asset (cbBTC or other ERC20) */}
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.offWhite}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                              </Text>
                              <AssetIcon asset={isBTCtoEVM ? "cbBTC" : "BTC"} />
                              <Text
                                fontSize="13px"
                                fontFamily={FONT_FAMILIES.AUX_MONO}
                                color={colors.textGray}
                                fontWeight="500"
                                letterSpacing="-0.5px"
                              >
                                {isBTCtoEVM ? "cbBTC" : "BTC"}
                              </Text>
                            </>
                          )}
                        </Flex>
                      </Flex>
                    </Flex>

                    {/* Deposit and Payout Txn - Combined Row */}
                    <Flex gap="20px" align="flex-start" flexWrap="wrap">
                      {/* Deposit Txn */}
                      <Flex direction="column" gap="4px" flex="1" minW="140px">
                        <Text
                          fontSize="10px"
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          color={colors.textGray}
                          textTransform="uppercase"
                          fontWeight="600"
                          letterSpacing="0.5px"
                        >
                          Deposit Txn
                        </Text>
                        {userTxHash ? (
                          <Flex
                            as="button"
                            onClick={() => {
                              const url =
                                userTxChain === "BTC"
                                  ? `https://mempool.space/tx/${userTxHash}`
                                  : userTxChain === "ETH"
                                    ? `https://etherscan.io/tx/${userTxHash}`
                                    : `https://basescan.org/tx/${userTxHash}`;
                              window.open(url, "_blank");
                            }}
                            bg={userBg}
                            border={`1.5px solid ${userBorder}`}
                            borderRadius="16px"
                            px="10px"
                            h="35px"
                            _hover={{ filter: "brightness(1.2)" }}
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.offWhite}
                            fontWeight="500"
                            cursor="pointer"
                            w="fit-content"
                            align="center"
                            gap="4px"
                            letterSpacing="-0.5px"
                          >
                            {displayShortTxHash(userTxHash, true)}
                            <Box ml="4px">
                              <FiExternalLink size={11} />
                            </Box>
                          </Flex>
                        ) : (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                          >
                            -
                          </Text>
                        )}
                      </Flex>

                      {/* Payout Txn */}
                      <Flex direction="column" gap="4px" flex="1" minW="140px">
                        <Text
                          fontSize="10px"
                          fontFamily={FONT_FAMILIES.SF_PRO}
                          color={colors.textGray}
                          textTransform="uppercase"
                          fontWeight="600"
                          letterSpacing="0.5px"
                        >
                          Payout Txn
                        </Text>
                        {isRefunded ? (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                            fontWeight="500"
                          >
                            Refunded
                          </Text>
                        ) : isRefundAvailable ? (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color="#B23232"
                            letterSpacing="-0.5px"
                            fontWeight="500"
                          >
                            MM failed
                          </Text>
                        ) : mmTxHash ? (
                          <Flex
                            as="button"
                            onClick={() => {
                              const url =
                                mmTxChain === "BTC"
                                  ? `https://mempool.space/tx/${mmTxHash}`
                                  : mmTxChain === "ETH"
                                    ? `https://etherscan.io/tx/${mmTxHash}`
                                    : `https://basescan.org/tx/${mmTxHash}`;
                              window.open(url, "_blank");
                            }}
                            bg={mmBg}
                            border={`1.5px solid ${mmBorder}`}
                            borderRadius="16px"
                            px="10px"
                            h="35px"
                            _hover={{ filter: "brightness(1.2)" }}
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.offWhite}
                            fontWeight="500"
                            cursor="pointer"
                            w="fit-content"
                            align="center"
                            gap="4px"
                            letterSpacing="-0.5px"
                          >
                            {displayShortTxHash(mmTxHash, true)}
                            <Box ml="4px">
                              <FiExternalLink size={11} />
                            </Box>
                          </Flex>
                        ) : (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                          >
                            -
                          </Text>
                        )}
                      </Flex>
                    </Flex>

                    {/* Status */}
                    <Flex direction="column" gap="4px">
                      <Text
                        fontSize="10px"
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        color={colors.textGray}
                        textTransform="uppercase"
                        fontWeight="600"
                        letterSpacing="0.5px"
                      >
                        Status
                      </Text>
                      <StatusBadge swap={swap} onClaimRefund={() => openRefundModal(swap)} />
                    </Flex>
                  </Flex>
                );
              })}

              {/* Loading More Indicator */}
              {loadingMore && (
                <Flex justify="center" py="20px">
                  <Spinner size="sm" color={colors.offWhite} />
                </Flex>
              )}

              {/* Load More Button for mobile */}
              {!loadingMore && hasMore && swaps.length > 0 && (
                <Flex justify="center" py="20px">
                  <Button
                    onClick={fetchNextPage}
                    cursor="pointer"
                    color={colors.offWhite}
                    _active={{ bg: colors.swapBgColor }}
                    _hover={{ bg: colors.swapHoverColor }}
                    borderRadius="12px"
                    border={`2.5px solid ${colors.swapBorderColor}`}
                    type="button"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    fontSize="15px"
                    paddingX="32px"
                    paddingY="12px"
                    bg={colors.swapBgColor}
                  >
                    Load More
                  </Button>
                </Flex>
              )}

              {/* End of List Message */}
              {!hasMore && swaps.length > 0 && (
                <Flex justify="center" py="20px">
                  <Text fontSize="12px" color={colors.textGray} fontFamily={FONT_FAMILIES.AUX_MONO}>
                    No more swaps to load
                  </Text>
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      ) : (
        // Desktop: GridFlex with fixed height and scrolling
        <GridFlex width="100%" borderRadius="40px" heightBlocks={12} contentPadding={0}>
          <Flex direction="column" w="100%" h="100%">
            {loading ? (
              <Flex w="100%" justify="center" align="center" py="80px">
                <Spinner size="lg" color={colors.offWhite} />
              </Flex>
            ) : swaps.length === 0 ? (
              <Flex w="100%" h="100%" direction="column" align="center" justify="center">
                <Text
                  fontSize="18px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  letterSpacing="-0.5px"
                  color={colors.textGray}
                  mb="20px"
                >
                  No swaps history found
                </Text>
                <Button
                  onClick={() => router.push("/")}
                  cursor="pointer"
                  color={colors.offWhite}
                  _active={{ bg: colors.swapBgColor }}
                  _hover={{ bg: colors.swapHoverColor }}
                  borderRadius="12px"
                  border={`2.5px solid ${colors.swapBorderColor}`}
                  type="button"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="17px"
                  paddingX="32px"
                  paddingY="12px"
                  bg={colors.swapBgColor}
                  boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
                >
                  Create Swap
                </Button>
              </Flex>
            ) : (
              <Box
                w="100%"
                overflowY="auto"
                flex="1"
                mr="8px"
                onScroll={handleScroll}
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
              >
                {/* Desktop Table Layout */}
                {/* Table Header */}
                <Flex
                  w="100%"
                  px="32px"
                  py="12px"
                  bg="#090909"
                  borderBottom={`1px solid ${colors.borderGray}`}
                  fontSize="11px"
                  fontFamily={FONT_FAMILIES.SF_PRO}
                  color={colors.textGray}
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing="0.5px"
                  position="sticky"
                  top="0"
                  zIndex={10}
                  flexShrink={0}
                >
                  <Text flex="0 0 122px">Time</Text>
                  <Text flex="0 0 135px">USD</Text>
                  <Text flex="0 0 218px">Amount</Text>
                  <Text flex="0 0 246px">Deposit Txn</Text>
                  <Text flex="0 0 188px">Direction</Text>
                  <Text flex="0 0 230px">Payout Txn</Text>
                  <Text flex="1">Status</Text>
                </Flex>

                {/* Table Rows */}
                {swaps.map((swap) => {
                  const userDepositStep = swap.flow.find(
                    (s) => s.status === "waiting_user_deposit_initiated"
                  );
                  const mmDepositStep = swap.flow.find(
                    (s) => s.status === "waiting_mm_deposit_initiated"
                  );
                  let userTxHash = userDepositStep?.txHash;
                  const userTxChain = userDepositStep?.txChain;
                  let mmTxHash = mmDepositStep?.txHash;
                  const mmTxChain = mmDepositStep?.txChain;

                  // Add 0x prefix to Ethereum transaction hashes if missing
                  if (userTxHash && userTxChain !== "BTC" && !userTxHash.startsWith("0x")) {
                    userTxHash = `0x${userTxHash}`;
                  }
                  if (mmTxHash && mmTxChain !== "BTC" && !mmTxHash.startsWith("0x")) {
                    mmTxHash = `0x${mmTxHash}`;
                  }

                  // Determine colors based on direction
                  // BTC_TO_EVM: User deposits BTC (orange), MM pays out cbBTC (blue)
                  // EVM_TO_BTC: User deposits cbBTC (blue), MM pays out BTC (orange)
                  const isBTCtoEVM = swap.direction === "BTC_TO_EVM";
                  const userBg = isBTCtoEVM ? "rgba(255, 143, 40, 0.15)" : "rgba(57, 74, 255, 0.2)";
                  const userBorder = isBTCtoEVM
                    ? "rgba(255, 143, 40, 0.4)"
                    : "rgba(57, 74, 255, 0.7)";
                  const userColor = isBTCtoEVM ? "#FF8F28" : "#7A9EFF";
                  const mmBg = isBTCtoEVM ? "rgba(57, 74, 255, 0.2)" : "rgba(255, 143, 40, 0.15)";
                  const mmBorder = isBTCtoEVM
                    ? "rgba(57, 74, 255, 0.7)"
                    : "rgba(255, 143, 40, 0.4)";
                  const mmColor = isBTCtoEVM ? "#7A9EFF" : "#FF8F28";

                  // Amount color matches deposit transaction color
                  const amountColor = userColor;

                  const lastStep = swap.flow[swap.flow.length - 1];
                  const isCompleted =
                    lastStep?.state === "completed" && lastStep?.status === "settled";
                  const isRefundAvailable = (swap as any).isRefundAvailable;

                  // Check if swap is refunded
                  const currentStep =
                    swap.flow.find((s) => s.state === "inProgress") ||
                    swap.flow[swap.flow.length - 1];
                  const isRefunded =
                    currentStep?.status === "refunding_user" ||
                    currentStep?.status === "refunding_mm" ||
                    (currentStep?.status as string) === "user_refunded_detected";

                  return (
                    <Flex
                      key={swap.id}
                      w="100%"
                      px="32px"
                      py="16px"
                      borderBottom={`1px solid ${colors.borderGray}`}
                      align="center"
                      _hover={{ bg: "rgba(255, 255, 255, 0.02)" }}
                      transition="background 0.15s ease"
                      cursor="pointer"
                      onClick={() => router.push(`/swap/${swap.id}`)}
                    >
                      {/* Time - Clickable to open details modal */}
                      <Flex
                        flex="0 0 122px"
                        cursor="pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSwap(swap);
                          setIsDetailsModalOpen(true);
                        }}
                        _hover={{ textDecoration: "underline" }}
                      >
                        <Text
                          fontSize="12px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          {formatTimeAgo(swap.swapCreationTimestamp)}
                        </Text>
                      </Flex>

                      {/* USD */}
                      <Flex flex="0 0 135px">
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {formatUSD(swap.swapInitialAmountUsd)}
                        </Text>
                      </Flex>

                      {/* Amount */}
                      <Flex flex="0 0 218px" gap="4px" align="center">
                        {swap.direction === "EVM_TO_BTC" && swap.startAssetMetadata ? (
                          // Show ERC20 amount from metadata for EVM->BTC swaps
                          <>
                            <Text
                              fontSize="13px"
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              color={colors.offWhite}
                              fontWeight="500"
                              letterSpacing="-0.5px"
                            >
                              {parseFloat(swap.startAssetMetadata.amount)
                                .toFixed(Math.min(swap.startAssetMetadata.decimals, 6))
                                .replace(/\.?0+$/, "")}
                            </Text>
                            <AssetIcon
                              asset={swap.startAssetMetadata.ticker}
                              iconUrl={swap.startAssetMetadata.icon}
                            />
                            <Text
                              fontSize="13px"
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              color={colors.textGray}
                              fontWeight="500"
                              letterSpacing="-0.5px"
                            >
                              {swap.startAssetMetadata.ticker}
                            </Text>
                          </>
                        ) : (
                          // Show BTC amount for BTC->EVM swaps or legacy swaps
                          <>
                            <Text
                              fontSize="13px"
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              color={colors.offWhite}
                              fontWeight="500"
                              letterSpacing="-0.5px"
                            >
                              {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                            </Text>
                            <AssetIcon asset={isBTCtoEVM ? "BTC" : "cbBTC"} />
                            <Text
                              fontSize="13px"
                              fontFamily={FONT_FAMILIES.AUX_MONO}
                              color={colors.textGray}
                              fontWeight="500"
                              letterSpacing="-0.5px"
                            >
                              {isBTCtoEVM ? "BTC" : "cbBTC"}
                            </Text>
                          </>
                        )}
                      </Flex>

                      {/* User Deposit Transaction */}
                      <Flex flex="0 0 246px">
                        {userTxHash ? (
                          <Flex
                            as="button"
                            onClick={() => {
                              const url =
                                userTxChain === "BTC"
                                  ? `https://mempool.space/tx/${userTxHash}`
                                  : userTxChain === "ETH"
                                    ? `https://etherscan.io/tx/${userTxHash}`
                                    : `https://basescan.org/tx/${userTxHash}`;
                              window.open(url, "_blank");
                            }}
                            bg={userBg}
                            border={`1.5px solid ${userBorder}`}
                            borderRadius="16px"
                            px="10px"
                            h="35px"
                            _hover={{ filter: "brightness(1.2)" }}
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.offWhite}
                            fontWeight="500"
                            cursor="pointer"
                            w="fit-content"
                            align="center"
                            gap="4px"
                            letterSpacing="-0.5px"
                          >
                            {displayShortTxHash(userTxHash)}
                            <Box ml="4px">
                              <FiExternalLink size={11} />
                            </Box>
                          </Flex>
                        ) : (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                          >
                            -
                          </Text>
                        )}
                      </Flex>

                      {/* Direction */}
                      <Flex flex="0 0 188px" align="center" gap="6px">
                        {/* From Asset */}
                        <AssetIcon
                          asset={
                            swap.direction === "BTC_TO_EVM"
                              ? "BTC"
                              : swap.startAssetMetadata?.ticker || "cbBTC"
                          }
                          iconUrl={
                            swap.direction === "EVM_TO_BTC"
                              ? swap.startAssetMetadata?.icon
                              : undefined
                          }
                        />
                        <Text
                          fontSize="12px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          {swap.direction === "BTC_TO_EVM"
                            ? "BTC"
                            : swap.startAssetMetadata?.ticker || "cbBTC"}
                        </Text>
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          →
                        </Text>
                        {/* To Asset */}
                        <AssetIcon asset={swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"} />
                        <Text
                          fontSize="12px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          {swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"}
                        </Text>
                      </Flex>

                      {/* MM Payout Transaction */}
                      <Flex flex="0 0 230px">
                        {isRefunded ? (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                            fontWeight="500"
                          >
                            Swap refunded
                          </Text>
                        ) : isRefundAvailable ? (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color="#B23232"
                            letterSpacing="-0.5px"
                            fontWeight="500"
                          >
                            Market Maker failed to fill
                          </Text>
                        ) : mmTxHash ? (
                          <Flex
                            as="button"
                            onClick={() => {
                              const url =
                                mmTxChain === "BTC"
                                  ? `https://mempool.space/tx/${mmTxHash}`
                                  : mmTxChain === "ETH"
                                    ? `https://etherscan.io/tx/${mmTxHash}`
                                    : `https://basescan.org/tx/${mmTxHash}`;
                              window.open(url, "_blank");
                            }}
                            bg={mmBg}
                            border={`1.5px solid ${mmBorder}`}
                            borderRadius="16px"
                            px="10px"
                            h="35px"
                            _hover={{ filter: "brightness(1.2)" }}
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.offWhite}
                            fontWeight="500"
                            cursor="pointer"
                            w="fit-content"
                            align="center"
                            gap="4px"
                            letterSpacing="-0.5px"
                          >
                            {displayShortTxHash(mmTxHash)}
                            <Box ml="4px">
                              <FiExternalLink size={11} />
                            </Box>
                          </Flex>
                        ) : isCompleted ? (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                          >
                            -
                          </Text>
                        ) : (
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={colors.textGray}
                            letterSpacing="-0.5px"
                          >
                            -
                          </Text>
                        )}
                      </Flex>

                      {/* Status */}
                      <Flex flex="1">
                        <StatusBadge swap={swap} onClaimRefund={() => openRefundModal(swap)} />
                      </Flex>
                    </Flex>
                  );
                })}

                {/* Loading More Indicator */}
                {loadingMore && (
                  <Flex justify="center" py="20px">
                    <Spinner size="sm" color={colors.offWhite} />
                  </Flex>
                )}

                {/* End of List Message */}
                {!hasMore && swaps.length > 0 && (
                  <Flex justify="center" py="20px">
                    <Text
                      fontSize="12px"
                      color={colors.textGray}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                    ></Text>
                  </Flex>
                )}
              </Box>
            )}
          </Flex>
        </GridFlex>
      )}

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

              {/* Status */}
              <Flex direction="column" gap="4px">
                <Text fontSize="11px" color={colors.textGray} textTransform="uppercase">
                  Status
                </Text>
                <Box>
                  <StatusBadge
                    swap={selectedSwap}
                    onClaimRefund={() => {
                      setIsDetailsModalOpen(false);
                      openRefundModal(selectedSwap);
                    }}
                  />
                </Box>
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

              {/* View on Swap Page Button */}
              <Button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  router.push(`/swap/${selectedSwap.id}`);
                }}
                borderRadius="12px"
                border={`2px solid ${colors.borderGray}`}
                bg="rgba(86, 50, 168, 0.15)"
                color={colors.offWhite}
                _hover={{ bg: "rgba(86, 50, 168, 0.25)" }}
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                w="100%"
                mt="8px"
              >
                VIEW FULL SWAP PAGE
              </Button>
            </Flex>
          </Box>
        </Flex>
      )}

      {/* Refund Modal */}
      <RefundModal
        isOpen={refundModalOpen}
        selectedSwap={selectedFailedSwap}
        refundAddress={refundAddress}
        setRefundAddress={setRefundAddress}
        isClaimingRefund={isClaimingRefund}
        refundStatus={refundStatus}
        currentBitcoinFee={currentBitcoinFee}
        fetchingFee={fetchingFee}
        onClose={closeRefundModal}
        onClaimRefund={claimRefund}
      />
    </>
  );
};
