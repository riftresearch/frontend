import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Flex, Text, Spinner, Button, Image } from "@chakra-ui/react";
import { AdminSwapItem, AdminSwapFlowStep } from "@/utils/types";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { mapDbRowToAdminSwap } from "@/utils/analyticsClient";
import { ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { FiClock, FiCheck, FiX, FiExternalLink } from "react-icons/fi";
import { GridFlex } from "@/components/other/GridFlex";
import { useRouter } from "next/router";
import { filterRefunds } from "@/utils/refundHelpers";
import { toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { RefundModal } from "@/components/other/RefundModal";
import { useRefundModal } from "@/hooks/useRefundModal";
import { AssetIcon } from "@/components/other/AssetIcon";
import { NetworkBadge } from "@/components/other/NetworkBadge";
import { Chain } from "@/utils/types";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";

/** Asset icon with a small chain badge overlay in the bottom-right corner */
const AssetIconWithChain: React.FC<{
  asset: string;
  iconUrl?: string;
  size?: number;
  chain: "ETH" | "BASE" | "BTC";
}> = ({ asset, iconUrl, size = 16, chain }) => {
  const badgeSize = Math.round(size * 0.55);
  const chainValue = chain === "BTC" ? Chain.Bitcoin : chain === "BASE" ? Chain.Base : Chain.Ethereum;
  const badgeBg = chain === "BTC" ? "#F7931A" : chain === "BASE" ? "white" : "#1a1a2e";
  return (
    <Box position="relative" display="inline-flex" flexShrink={0}>
      <AssetIcon asset={asset} iconUrl={iconUrl} size={size} />
      <Box
        position="absolute"
        bottom="-2px"
        right="-3px"
        w={`${badgeSize}px`}
        h={`${badgeSize}px`}
        borderRadius="50%"
        bg={badgeBg}
        border="1.5px solid #0a0a0a"
        display="flex"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        p={chain === "BTC" ? "1px" : "0"}
      >
        <NetworkBadge chain={chainValue} size={`${badgeSize - 2}px`} />
      </Box>
    </Box>
  );
};

function displayShortTxHash(hash: string, isMobile: boolean = false): string {
  if (!hash || hash.length < 12) return hash;
  const prefix = hash.startsWith("0x") ? "0x" : "";
  const hex = hash.replace(/^0x/, "");
  const chars = isMobile ? 4 : 4;
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

/**
 * Format a raw base-unit amount string (e.g. wei) into a human-readable decimal.
 * Uses BigInt to avoid floating-point precision loss for large numbers.
 */
function formatBaseUnitAmount(rawAmount: string, decimals: number, maxDecimals?: number): string {
  const max = maxDecimals ?? Math.min(decimals, 6);
  try {
    const raw = BigInt(rawAmount);
    const divisor = BigInt(10 ** decimals);
    const wholePart = raw / divisor;
    const remainder = raw % divisor;
    if (remainder === 0n) return wholePart.toString();
    const remainderStr = remainder.toString().padStart(decimals, "0");
    const trimmed = remainderStr.replace(/0+$/, "");
    const truncated = trimmed.slice(0, max);
    return `${wholePart}.${truncated}`;
  } catch {
    // Fallback for non-integer strings (already human-readable)
    const num = parseFloat(rawAmount);
    return num.toFixed(max).replace(/\.?0+$/, "");
  }
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

  // Refunded: refunding_user (regardless of isRefundAvailable)
  if (currentStatus === "refunding_user") {
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

  // Completed: confirming_payout or swap_complete
  if (currentStatus === "confirming_payout" || currentStatus === "swap_complete") {
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

  // Confirming: deposit_confirming
  if (currentStatus === "deposit_confirming") {
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

  // Swapping: initiating_payout (default for other in-progress states)
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
  offset: number,
  btcPrice?: number | null
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
        const mappedSwap = mapDbRowToAdminSwap(row, btcPrice);

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
                status: "refunding_user",
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

    // Filter out swaps that are pending or at waiting_for_deposit WITHOUT a refund available
    // (these are created but user never deposited)
    // But KEEP waiting_for_deposit swaps that have refund available (partial deposits)

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

      // Exclude waiting_for_deposit UNLESS refund is available (partial deposit case)
      if (currentStatus === "waiting_for_deposit") {
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

/**
 * Fetch swaps for multiple addresses in parallel, merge and deduplicate by swap ID,
 * sorted by most recent first.
 */
async function fetchSwapsForAllAddresses(
  addresses: string[],
  limit: number,
  offset: number,
  btcPrice?: number | null
): Promise<{ swaps: AdminSwapItem[]; hasMore: boolean }> {
  if (addresses.length === 0) return { swaps: [], hasMore: false };

  // Fetch for all addresses in parallel
  const results = await Promise.all(
    addresses.map((addr) => fetchUserSwaps(addr, limit, offset, btcPrice))
  );

  // Merge and deduplicate by swap ID
  const swapMap = new Map<string, AdminSwapItem>();
  let anyHasMore = false;

  for (const result of results) {
    if (result.hasMore) anyHasMore = true;
    for (const swap of result.swaps) {
      if (!swapMap.has(swap.id)) {
        swapMap.set(swap.id, swap);
      }
    }
  }

  // Sort by timestamp descending (most recent first)
  const merged = Array.from(swapMap.values()).sort((a, b) => {
    return (b.swapCreationTimestamp || 0) - (a.swapCreationTimestamp || 0);
  });

  return { swaps: merged, hasMore: anyHasMore };
}

interface UserSwapHistoryProps {
  onInitialLoadComplete?: () => void;
  simulatedAddress?: string; // Optional simulated address for admin view
  embedded?: boolean; // When true, renders in compact mode for WalletPanel
  onSwapClick?: () => void; // Callback when a swap is clicked (for closing panel etc.)
}

export const UserSwapHistory: React.FC<UserSwapHistoryProps> = ({
  onInitialLoadComplete,
  simulatedAddress,
  embedded = false,
  onSwapClick,
}) => {
  // Get all EVM wallet addresses directly from Dynamic (supports multiple wallets)
  const { setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();
  const evmAddresses = React.useMemo(
    () => userWallets.filter((w) => w.chain?.toUpperCase() === "EVM").map((w) => w.address),
    [userWallets]
  );
  const isEvmConnected = evmAddresses.length > 0;

  // Use simulated address if provided, otherwise use all connected EVM addresses
  const isSimulating = !!simulatedAddress;
  const addresses: string[] = isSimulating ? [simulatedAddress!] : evmAddresses;
  const router = useRouter();
  const { isMobile } = useWindowSize();
  const { btcPrice } = useBtcEthPrices(); // Fetch current BTC price as fallback
  const [swaps, setSwaps] = useState<AdminSwapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
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
      if (addresses.length > 0) {
        fetchSwapsForAllAddresses(addresses, pageSize, 0, btcPrice).then(({ swaps: newSwaps }) => {
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
    // Skip if no addresses (not connected and not simulating)
    if (addresses.length === 0 && !isSimulating) {
      setSwaps([]);
      setHasMore(true);
      return;
    }

    // Initial fetch with retries
    const fetchWithRetries = async () => {
      setLoading(true);

      // First attempt
      let result = await fetchSwapsForAllAddresses(addresses, pageSize, 0, btcPrice);

      // If no swaps found, retry 2 more times with 100ms delay
      if (result.swaps.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        result = await fetchSwapsForAllAddresses(addresses, pageSize, 0, btcPrice);

        if (result.swaps.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          result = await fetchSwapsForAllAddresses(addresses, pageSize, 0, btcPrice);
        }
      }

      setSwaps(result.swaps);
      setHasMore(result.hasMore);
      setLoading(false);
    };

    fetchWithRetries();

    // Set up polling every 3 seconds - refresh and merge intelligently
    const pollInterval = setInterval(() => {
      fetchSwapsForAllAddresses(addresses, pageSize, 0, btcPrice).then(({ swaps: newSwaps }) => {
        setSwaps((prev) => {
          if (prev.length === 0) return newSwaps;

          // Create a map of all existing swaps by ID for fast lookup
          const swapMap = new Map<string, AdminSwapItem>();
          prev.forEach((s) => swapMap.set(s.id, s));

          // Update existing swaps with fresh data from first page
          // and add any new swaps to the front
          const newSwapIds = new Set<string>();
          newSwaps.forEach((s) => {
            newSwapIds.add(s.id);
            swapMap.set(s.id, s); // Update or add
          });

          // Rebuild the list: new swaps first (in order), then existing swaps not in new batch
          const result: AdminSwapItem[] = [];

          // Add new/updated swaps from the first page in their order
          newSwaps.forEach((s) => {
            result.push(swapMap.get(s.id)!);
          });

          // Add remaining swaps that weren't in the new batch (preserving their order)
          prev.forEach((s) => {
            if (!newSwapIds.has(s.id)) {
              result.push(s);
            }
          });

          return result;
        });
      });
    }, 3000);

    // Cleanup interval on unmount or when addresses/connection changes
    return () => clearInterval(pollInterval);
  }, [addresses.join(","), isEvmConnected, isSimulating]);

  // Fetch next page - use actual swaps count as offset to handle filtered items correctly
  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !hasMore || fetchingRef.current || addresses.length === 0) return;

    fetchingRef.current = true;
    setLoadingMore(true);

    try {
      // Use actual swaps length as offset instead of page * pageSize
      // This handles cases where filtering reduced the count
      const currentSwapsCount = swaps.length;
      const { swaps: newSwaps, hasMore: more } = await fetchSwapsForAllAddresses(
        addresses,
        pageSize,
        currentSwapsCount,
        btcPrice
      );

      if (newSwaps.length === 0) {
        // No more swaps to load
        setHasMore(false);
      } else {
        setSwaps((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const filtered = newSwaps.filter((s) => !existingIds.has(s.id));

          // If we got items but all were duplicates, there might still be more
          // but we need to fetch further
          if (filtered.length === 0 && more) {
            // Don't update state, will retry with higher offset on next scroll
            return prev;
          }

          return [...prev, ...filtered];
        });
        setHasMore(more && newSwaps.length > 0);
      }
    } catch (error) {
      console.error("Error fetching next page:", error);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [addresses.join(","), pageSize, loadingMore, hasMore, swaps.length]);

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

  const handleConnectWallet = () => {
    setShowAuthFlow(true);
  };

  // Show loading spinner during initial mount
  if (isInitialMount) {
    return (
      <Flex
        w="100%"
        h={embedded ? "200px" : "60vh"}
        align="center"
        justify="center"
        mt={isMobile && !embedded ? "80px" : "0"}
      >
        <Spinner size={embedded ? "md" : "xl"} color={colors.offWhite} />
      </Flex>
    );
  }

  // Only show "not connected" UI if not simulating and not connected
  if (!isEvmConnected && !isSimulating) {
    if (embedded) {
      return (
        <Flex direction="column" align="center" justify="center" py="40px" px="20px" gap="16px">
          <Text color={colors.textGray} fontSize="14px" fontFamily={FONT_FAMILIES.INTER} textAlign="center">
            Connect your EVM wallet to view swap history
          </Text>
          <Flex
            justify="center"
            align="center"
            py="10px"
            px="20px"
            borderRadius="12px"
            bg="rgba(167, 139, 250, 0.08)"
            border="2px solid #A78BFA"
            cursor="pointer"
            _hover={{ bg: "rgba(167, 139, 250, 0.18)" }}
            onClick={handleConnectWallet}
          >
            <Text color="#A78BFA" fontSize="14px" fontWeight="600" fontFamily={FONT_FAMILIES.INTER}>
              Connect Wallet
            </Text>
          </Flex>
        </Flex>
      );
    }
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
            Connect your EVM wallet to view your swap history and track the status of your current and
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

  // Embedded mode - compact rendering for WalletPanel
  if (embedded) {
    return (
      <Box w="100%" h="100%" overflow="auto" px="12px" pb="12px">
        {loading ? (
          <Flex w="100%" justify="center" align="center" py="40px">
            <Spinner size="md" color={colors.offWhite} />
          </Flex>
        ) : swaps.length === 0 ? (
          <Flex w="100%" direction="column" align="center" justify="center" py="40px">
            <Text
              fontSize="14px"
              fontFamily={FONT_FAMILIES.INTER}
              color={colors.textGray}
              mb="16px"
              textAlign="center"
            >
              No swap history found
            </Text>
            <Flex
              justify="center"
              align="center"
              py="10px"
              px="20px"
              borderRadius="12px"
              bg="rgba(167, 139, 250, 0.08)"
              border="2px solid #A78BFA"
              cursor="pointer"
              _hover={{ bg: "rgba(167, 139, 250, 0.18)" }}
              onClick={() => router.push("/")}
            >
              <Text color="#A78BFA" fontSize="14px" fontWeight="600" fontFamily={FONT_FAMILIES.INTER}>
                Create Swap
              </Text>
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" w="100%" gap="10px">
            {swaps.map((swap) => {
              const isBTCtoEVM = swap.direction === "BTC_TO_EVM";
              const timestamp = swap.swapCreationTimestamp || Date.now();

              // Get transaction hashes
              const userDepositStep = swap.flow.find(
                (s) => s.status === "waiting_for_deposit"
              );
              const mmDepositStep = swap.flow.find(
                (s) => s.status === "initiating_payout"
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

              // Colors based on direction
              const userBg = isBTCtoEVM ? "rgba(255, 143, 40, 0.15)" : "rgba(57, 74, 255, 0.2)";
              const userBorder = isBTCtoEVM ? "rgba(255, 143, 40, 0.4)" : "rgba(57, 74, 255, 0.7)";
              const mmBg = isBTCtoEVM ? "rgba(57, 74, 255, 0.2)" : "rgba(255, 143, 40, 0.15)";
              const mmBorder = isBTCtoEVM ? "rgba(57, 74, 255, 0.7)" : "rgba(255, 143, 40, 0.4)";

              // Determine input/output based on direction
              let inputAsset: string;
              let inputAmount: string;
              let inputIcon: string | undefined;
              let outputAsset: string;

              if (isBTCtoEVM) {
                inputAsset = "BTC";
                inputAmount = swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "");
                outputAsset = "cbBTC";
              } else {
                if (swap.startAssetMetadata) {
                  inputAsset = swap.startAssetMetadata.ticker;
                  inputAmount = formatBaseUnitAmount(
                    swap.startAssetMetadata.amount,
                    swap.startAssetMetadata.decimals
                  );
                  inputIcon = swap.startAssetMetadata.icon;
                } else {
                  inputAsset = "cbBTC";
                  inputAmount = swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "");
                }
                outputAsset = "BTC";
              }

              // Check refund status
              const lastStep = swap.flow[swap.flow.length - 1];
              const isCompleted = lastStep?.state === "completed" && lastStep?.status === "swap_complete";
              const isRefundAvailable = (swap as any).isRefundAvailable;
              const currentStep =
                swap.flow.find((s) => s.state === "inProgress") || swap.flow[swap.flow.length - 1];
              const isRefunded =
                currentStep?.status === "refunding_user";

              return (
                <Flex
                  key={swap.id}
                  p="18px"
                  borderRadius="12px"
                  bg="rgba(40, 40, 40, 0.6)"
                  _hover={{ bg: "rgba(50, 50, 50, 0.7)" }}
                  cursor="pointer"
                  onClick={() => {
                    onSwapClick?.();
                    router.push(`/swap/${swap.id}`);
                  }}
                  direction="column"
                  gap="14px"
                >
                  {/* Row 1: Status (left) + USD (center) + Time (right) */}
                  <Flex justify="space-between" align="center">
                    <StatusBadge swap={swap} onClaimRefund={() => openRefundModal(swap)} />
                    <Text
                      fontSize="15px"
                      color={colors.offWhite}
                      fontFamily={FONT_FAMILIES.INTER}
                      fontWeight="600"
                    >
                      {formatUSD(swap.swapInitialAmountUsd)}
                    </Text>
                    <Text fontSize="13px" color={colors.textGray} fontFamily={FONT_FAMILIES.INTER}>
                      {formatTimeAgo(timestamp)}
                    </Text>
                  </Flex>

                  {/* Row 2: Input amount → Output amount */}
                  <Flex align="center" gap="8px">
                    <Flex align="center" gap="6px">
                      <AssetIcon asset={inputAsset} iconUrl={inputIcon} size={22} />
                      <Text
                        fontSize="14px"
                        color={colors.offWhite}
                        fontFamily={FONT_FAMILIES.INTER}
                        fontWeight="500"
                      >
                        {inputAmount} {inputAsset}
                      </Text>
                    </Flex>
                    <Text fontSize="14px" color={colors.textGray} fontFamily={FONT_FAMILIES.INTER}>
                      →
                    </Text>
                    <Flex align="center" gap="6px">
                      <AssetIcon asset={outputAsset} size={22} />
                      <Text
                        fontSize="14px"
                        color={colors.offWhite}
                        fontFamily={FONT_FAMILIES.INTER}
                        fontWeight="500"
                      >
                        {outputAsset}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Row 3: Transaction links */}
                  <Flex justify="space-between" align="center" gap="10px">
                    {/* User Deposit TX */}
                    {userTxHash ? (
                      <Flex
                        as="button"
                        onClick={(e) => {
                          e.stopPropagation();
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
                        borderRadius="12px"
                        px="10px"
                        h="34px"
                        _hover={{ filter: "brightness(1.2)" }}
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.INTER}
                        color={colors.offWhite}
                        fontWeight="500"
                        cursor="pointer"
                        align="center"
                        gap="5px"
                        flex="1"
                        justify="center"
                      >
                        {displayShortTxHash(userTxHash, true)}
                        <FiExternalLink size={11} />
                      </Flex>
                    ) : (
                      <Flex
                        flex="1"
                        h="34px"
                        align="center"
                        justify="center"
                        bg={userBg}
                        border={`1.5px solid ${userBorder}`}
                        borderRadius="12px"
                        opacity={0.5}
                      >
                        <Text fontSize="11px" color={colors.textGray} fontFamily={FONT_FAMILIES.INTER}>
                          Pending
                        </Text>
                      </Flex>
                    )}

                    {/* MM Payout TX */}
                    {isRefunded ? (
                      <Flex
                        flex="1"
                        h="34px"
                        align="center"
                        justify="center"
                        bg={mmBg}
                        border={`1.5px solid ${mmBorder}`}
                        borderRadius="12px"
                      >
                        <Text fontSize="11px" color={colors.textGray} fontFamily={FONT_FAMILIES.INTER}>
                          Refunded
                        </Text>
                      </Flex>
                    ) : isRefundAvailable ? (
                      <Flex
                        flex="1"
                        h="34px"
                        align="center"
                        justify="center"
                        bg="rgba(178, 50, 50, 0.15)"
                        border="1.5px solid rgba(178, 50, 50, 0.4)"
                        borderRadius="12px"
                      >
                        <Text fontSize="11px" color="#B23232" fontFamily={FONT_FAMILIES.INTER}>
                          Failed
                        </Text>
                      </Flex>
                    ) : mmTxHash ? (
                      <Flex
                        as="button"
                        onClick={(e) => {
                          e.stopPropagation();
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
                        borderRadius="12px"
                        px="10px"
                        h="34px"
                        _hover={{ filter: "brightness(1.2)" }}
                        fontSize="11px"
                        fontFamily={FONT_FAMILIES.INTER}
                        color={colors.offWhite}
                        fontWeight="500"
                        cursor="pointer"
                        align="center"
                        gap="5px"
                        flex="1"
                        justify="center"
                      >
                        {displayShortTxHash(mmTxHash, true)}
                        <FiExternalLink size={11} />
                      </Flex>
                    ) : (
                      <Flex
                        flex="1"
                        h="34px"
                        align="center"
                        justify="center"
                        bg={mmBg}
                        border={`1.5px solid ${mmBorder}`}
                        borderRadius="12px"
                        opacity={0.5}
                      >
                        <Text fontSize="11px" color={colors.textGray} fontFamily={FONT_FAMILIES.INTER}>
                          {isCompleted ? "Settled" : "Pending"}
                        </Text>
                      </Flex>
                    )}
                  </Flex>
                </Flex>
              );
            })}

            {/* Loading More Indicator */}
            {loadingMore && (
              <Flex justify="center" py="12px">
                <Spinner size="sm" color={colors.offWhite} />
              </Flex>
            )}

            {/* Load More Button */}
            {!loadingMore && hasMore && swaps.length > 0 && (
              <Flex justify="center" py="12px">
                <Text
                  fontSize="13px"
                  color="#A78BFA"
                  fontFamily={FONT_FAMILIES.INTER}
                  cursor="pointer"
                  _hover={{ textDecoration: "underline" }}
                  onClick={fetchNextPage}
                >
                  Load more
                </Text>
              </Flex>
            )}

            {/* End of List */}
            {!hasMore && swaps.length > 0 && (
              <Flex justify="center" py="8px">
                <Text fontSize="11px" color={colors.textGray} fontFamily={FONT_FAMILIES.INTER}>
                  No more swaps
                </Text>
              </Flex>
            )}
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
      </Box>
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
                  (s) => s.status === "waiting_for_deposit"
                );
                const mmDepositStep = swap.flow.find(
                  (s) => s.status === "initiating_payout"
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
                  lastStep?.state === "completed" && lastStep?.status === "swap_complete";
                const isRefundAvailable = (swap as any).isRefundAvailable;

                // Check if swap is refunded
                const currentStep =
                  swap.flow.find((s) => s.state === "inProgress") ||
                  swap.flow[swap.flow.length - 1];
                const isRefunded = currentStep?.status === "refunding_user";

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
                                {formatBaseUnitAmount(
                                  swap.startAssetMetadata.amount,
                                  swap.startAssetMetadata.decimals
                                )}
                              </Text>
                              <AssetIcon
                                asset={swap.startAssetMetadata.ticker}
                                iconUrl={swap.startAssetMetadata.icon}
                                address={swap.startAssetMetadata.address}
                                chainId={swap.chain === "BASE" ? 8453 : 1}
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
                  fontFamily={FONT_FAMILIES.INTER}
                  color={colors.textGray}
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing="0.5px"
                  position="sticky"
                  top="0"
                  zIndex={10}
                  flexShrink={0}
                >
                  <Text flex="0 0 105px">Created</Text>
                  <Text flex="0 0 278px">Address</Text>
                  <Text flex="0 0 367px">Txns</Text>
                  <Text flex="0 0 276px">Asset</Text>
                  <Text flex="0 0 125px">Value</Text>
                  <Text flex="1">Status</Text>
                </Flex>

                {/* Table Rows */}
                {swaps.map((swap) => {
                  const userDepositStep = swap.flow.find(
                    (s) => s.status === "waiting_for_deposit"
                  );
                  const mmDepositStep = swap.flow.find(
                    (s) => s.status === "initiating_payout"
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
                    lastStep?.state === "completed" && lastStep?.status === "swap_complete";
                  const isRefundAvailable = (swap as any).isRefundAvailable;

                  // Check if swap is refunded
                  const currentStep =
                    swap.flow.find((s) => s.state === "inProgress") ||
                    swap.flow[swap.flow.length - 1];
                  const isRefunded = currentStep?.status === "refunding_user";

                  return (
                    <Flex
                      key={swap.id}
                      w="100%"
                      px="32px"
                      py="16px"
                      borderBottom={`1px solid ${colors.borderGray}`}
                      align="center"
                      fontFamily={FONT_FAMILIES.INTER}
                      _hover={{ bg: "rgba(255, 255, 255, 0.02)" }}
                      transition="background 0.15s ease"
                      cursor="pointer"
                      onClick={() => router.push(`/swap/${swap.id}`)}
                    >
                      {/* Created */}
                      <Flex
                        flex="0 0 105px"
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
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          {formatTimeAgo(swap.swapCreationTimestamp)}
                        </Text>
                      </Flex>

                      {/* Address: sender → payout */}
                      <Flex flex="0 0 278px" align="center" gap="8px">
                        {(() => {
                          const senderAddr = swap.evmAccountAddress;
                          const payoutAddr = swap.rawData?.user_destination_address;
                          const senderShort = senderAddr ? `${senderAddr.slice(0, 6)}...${senderAddr.slice(-4)}` : "-";
                          const payoutShort = payoutAddr ? `${payoutAddr.slice(0, 6)}...${payoutAddr.slice(-4)}` : "-";

                          // Sender is always EVM, payout depends on direction
                          const senderExplorerUrl = senderAddr
                            ? swap.chain === "BASE"
                              ? `https://basescan.org/address/${senderAddr}`
                              : `https://etherscan.io/address/${senderAddr}`
                            : undefined;
                          const isBtcAddress = payoutAddr
                            ? payoutAddr.startsWith("bc1") || payoutAddr.startsWith("1") || payoutAddr.startsWith("3")
                            : false;
                          const payoutExplorerUrl = payoutAddr
                            ? isBtcAddress
                              ? `https://mempool.space/address/${payoutAddr}`
                              : swap.chain === "BASE"
                                ? `https://basescan.org/address/${payoutAddr}`
                                : `https://etherscan.io/address/${payoutAddr}`
                            : undefined;

                          return (
                            <>
                              <Flex
                                as="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (senderExplorerUrl) window.open(senderExplorerUrl, "_blank");
                                }}
                                bg={userBg}
                                border={`1.5px solid ${userBorder}`}
                                borderRadius="16px"
                                px="10px"
                                h="32px"
                                _hover={{ filter: "brightness(1.2)" }}
                                fontSize="11px"
                                color={colors.offWhite}
                                fontWeight="500"
                                cursor="pointer"
                                align="center"
                                gap="4px"
                                letterSpacing="-0.5px"
                              >
                                {senderShort}
                                <FiExternalLink size={10} />
                              </Flex>
                              <Text fontSize="12px" color={colors.textGray}>→</Text>
                              <Flex
                                as="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (payoutExplorerUrl) window.open(payoutExplorerUrl, "_blank");
                                }}
                                bg={mmBg}
                                border={`1.5px solid ${mmBorder}`}
                                borderRadius="16px"
                                px="10px"
                                h="32px"
                                _hover={{ filter: "brightness(1.2)" }}
                                fontSize="11px"
                                color={colors.offWhite}
                                fontWeight="500"
                                cursor="pointer"
                                align="center"
                                gap="4px"
                                letterSpacing="-0.5px"
                              >
                                {payoutShort}
                                <FiExternalLink size={10} />
                              </Flex>
                            </>
                          );
                        })()}
                      </Flex>

                      {/* Txns: deposit tx → payout tx */}
                      <Flex flex="0 0 367px" align="center" gap="8px">
                        {userTxHash ? (
                          <Flex
                            as="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url =
                                userTxChain === "BTC"
                                  ? `https://mempool.space/tx/${userTxHash}`
                                  : swap.chain === "BASE"
                                    ? `https://basescan.org/tx/${userTxHash}`
                                    : `https://etherscan.io/tx/${userTxHash}`;
                              window.open(url, "_blank");
                            }}
                            bg={userBg}
                            border={`1.5px solid ${userBorder}`}
                            borderRadius="16px"
                            px="10px"
                            h="32px"
                            _hover={{ filter: "brightness(1.2)" }}
                            fontSize="11px"
                            color={colors.offWhite}
                            fontWeight="500"
                            cursor="pointer"
                            align="center"
                            gap="4px"
                            letterSpacing="-0.5px"
                          >
                            Deposit - {displayShortTxHash(userTxHash)}
                            <FiExternalLink size={10} />
                          </Flex>
                        ) : (
                          <Text fontSize="11px" color={colors.textGray}>-</Text>
                        )}
                        <Text fontSize="12px" color={colors.textGray}>→</Text>
                        {mmTxHash ? (
                          <Flex
                            as="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url =
                                mmTxChain === "BTC"
                                  ? `https://mempool.space/tx/${mmTxHash}`
                                  : swap.chain === "BASE"
                                    ? `https://basescan.org/tx/${mmTxHash}`
                                    : `https://etherscan.io/tx/${mmTxHash}`;
                              window.open(url, "_blank");
                            }}
                            bg={mmBg}
                            border={`1.5px solid ${mmBorder}`}
                            borderRadius="16px"
                            px="10px"
                            h="32px"
                            _hover={{ filter: "brightness(1.2)" }}
                            fontSize="11px"
                            color={colors.offWhite}
                            fontWeight="500"
                            cursor="pointer"
                            align="center"
                            gap="4px"
                            letterSpacing="-0.5px"
                          >
                            Payout - {displayShortTxHash(mmTxHash)}
                            <FiExternalLink size={10} />
                          </Flex>
                        ) : (
                          <Text fontSize="11px" color={colors.textGray}>-</Text>
                        )}
                      </Flex>

                      {/* Asset: input amount+icon → output amount+icon */}
                      <Flex flex="0 0 276px" gap="5px" align="center">
                        {/* Input */}
                        {swap.direction === "EVM_TO_BTC" && swap.startAssetMetadata ? (
                          <>
                            <Text
                              fontSize="13px"
                              color={colors.offWhite}
                              fontWeight="500"
                              letterSpacing="-0.5px"
                            >
                              {formatBaseUnitAmount(
                                swap.startAssetMetadata.amount,
                                swap.startAssetMetadata.decimals
                              )}
                            </Text>
                            <AssetIconWithChain
                              asset={swap.startAssetMetadata.ticker}
                              iconUrl={swap.startAssetMetadata.icon}
                              size={24}
                              chain={swap.chain}
                            />
                          </>
                        ) : (
                          <>
                            <Text
                              fontSize="13px"
                              color={colors.offWhite}
                              fontWeight="500"
                              letterSpacing="-0.5px"
                            >
                              {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                            </Text>
                            <AssetIconWithChain
                              asset={isBTCtoEVM ? "BTC" : "cbBTC"}
                              size={24}
                              chain={isBTCtoEVM ? "BTC" : swap.chain}
                            />
                          </>
                        )}

                        <Text fontSize="13px" color={colors.textGray} mx="1px">→</Text>

                        {/* Output */}
                        {swap.outputAmount ? (
                          <Text
                            fontSize="13px"
                            color={colors.offWhite}
                            fontWeight="500"
                            letterSpacing="-0.5px"
                          >
                            {formatBaseUnitAmount(swap.outputAmount, swap.outputDecimals || 8)}
                          </Text>
                        ) : null}
                        <AssetIconWithChain
                          asset={swap.outputAsset || (isBTCtoEVM ? "cbBTC" : "BTC")}
                          size={24}
                          chain={isBTCtoEVM ? swap.chain : "BTC"}
                        />
                      </Flex>

                      {/* Value */}
                      <Flex flex="0 0 125px">
                        <Text
                          fontSize="13px"
                          color={colors.offWhite}
                          fontWeight="500"
                        >
                          {formatUSD(swap.swapInitialAmountUsd)}
                        </Text>
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
                <Flex align="center" gap="6px">
                  <Text fontSize="14px" color={colors.offWhite}>
                    {selectedSwap.direction === "BTC_TO_EVM"
                      ? "BTC"
                      : selectedSwap.startAssetMetadata?.ticker || "cbBTC"}
                  </Text>
                  <Text fontSize="14px" color={colors.textGray}>
                    →
                  </Text>
                  <Text fontSize="14px" color={colors.offWhite}>
                    {selectedSwap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"}
                  </Text>
                  <Text
                    fontSize="12px"
                    color={selectedSwap.chain === "BASE" ? "#0052FF" : "#627EEA"}
                    fontWeight="500"
                  >
                    ({selectedSwap.chain})
                  </Text>
                </Flex>
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
                    .filter((s) => s.status !== "swap_complete")
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
