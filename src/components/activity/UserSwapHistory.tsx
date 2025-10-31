import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Box, Flex, Text, Spinner, Button } from "@chakra-ui/react";
import { useAccount, useWalletClient } from "wagmi";
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
import { GLOBAL_CONFIG, otcClient, rfqClient } from "@/utils/constants";
import {
  createSignedRefundRequest,
  executeCompleteRefund,
  formatRefundError,
  validateRefundAddress,
} from "@/utils/refundHelpers";
import { toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";

function displayShortTxHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  const prefix = hash.startsWith("0x") ? "0x" : "";
  const hex = hash.replace(/^0x/, "");
  // Show double the characters: 8 at start and 8 at end
  return `${prefix}${hex.slice(0, 8)}...${hex.slice(-8)}`;
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

const AssetIcon: React.FC<{ badge?: "BTC" | "cbBTC" }> = ({ badge }) => {
  if (!badge) return null;
  const src = badge === "BTC" ? "/images/BTC_icon.svg" : "/images/cbBTC_icon.svg";
  return <Image src={src} alt={badge} width={18} height={18} style={{ opacity: 0.9 }} />;
};

const StatusBadge: React.FC<{ swap: AdminSwapItem; onClaimRefund?: () => void }> = ({
  swap,
  onClaimRefund,
}) => {
  // Find the current step based on status priority
  const currentStep =
    swap.flow.find((s) => s.state === "inProgress") || swap.flow[swap.flow.length - 1];
  const currentStatus = currentStep?.status;
  const isRefundAvailable = (swap as any).isRefundAvailable;

  // console.log(`[STATUS BADGE ${swap.id}]`, {
  //   swapId: swap.id,
  //   currentStep,
  //   currentStatus,
  //   isRefundAvailable,
  //   allFlowSteps: swap.flow.map((s) => ({ state: s.state, status: s.status })),
  // });

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
        onClick={onClaimRefund}
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
        const mappedSwap = mapDbRowToAdminSwap(row);

        // Check if refund is available based on server flag and balance check
        let isRefundAvailable = false;
        let shouldMarkAsRefunded = false;
        if (row.isRefundAvailable || row.is_refund_available) {
          console.log(
            `[BALANCE CHECK] Swap ${mappedSwap.id}: Server says refund available, checking balance...`
          );
          // Server says refund is available, now check if user has already withdrawn funds
          // by looking up if the deposit address has any balance
          const userDepositAddress = row.user_deposit_address;
          const userDepositChain = row.quote.from_chain; // ethereum or bitcoin

          if (userDepositChain === "bitcoin") {
            // look up if the deposit address has any balance from the electrs endpoint
            try {
              const electrsUrl = `${GLOBAL_CONFIG.esploraUrl}/address/${userDepositAddress}`;
              const electrsResponse = await fetch(electrsUrl);
              if (!electrsResponse.ok) {
                console.warn(`Failed to fetch Bitcoin balance for ${userDepositAddress}`);
                isRefundAvailable = false; // Default to not available if we can't check
              } else {
                const electrsData = await electrsResponse.json();
                // Check if address has any confirmed or unconfirmed balance
                const totalBalance =
                  (electrsData.chain_stats?.funded_txo_sum || 0) -
                  (electrsData.chain_stats?.spent_txo_sum || 0);
                const mempoolBalance =
                  (electrsData.mempool_stats?.funded_txo_sum || 0) -
                  (electrsData.mempool_stats?.spent_txo_sum || 0);
                const hasBalance = totalBalance + mempoolBalance > 0;
                isRefundAvailable = hasBalance;
                shouldMarkAsRefunded = !hasBalance; // No balance means funds were withdrawn
                console.log(
                  `[BALANCE CHECK] Bitcoin balance for ${userDepositAddress}: ${totalBalance + mempoolBalance} sats, shouldMarkAsRefunded: ${shouldMarkAsRefunded}`
                );
              }
            } catch (error) {
              console.warn(`Error checking Bitcoin balance for ${userDepositAddress}:`, error);
              isRefundAvailable = false; // Default to not available if we can't check
            }
          } else {
            // look up if the deposit address has any cbBTC balance using token-balance API
            try {
              const cbBTCAddress = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
              // Use the existing token-balance API to check cbBTC balance
              const chainId = 1;
              const response = await fetch(
                `/api/token-balance?wallet=${userDepositAddress}&chainId=${chainId}`
              );
              if (!response.ok) {
                console.warn(`Failed to fetch EVM balance for ${userDepositAddress}`);
                isRefundAvailable = false; // Default to not available if we can't check
              } else {
                const data = await response.json();

                // Look for cbBTC token in the results
                if (data.result?.result) {
                  const cbBTCToken = data.result.result.find(
                    (token: any) => token.address?.toLowerCase() === cbBTCAddress.toLowerCase()
                  );
                  if (cbBTCToken) {
                    const balance = BigInt(cbBTCToken.totalBalance || "0");
                    const hasBalance = balance > 0n;
                    isRefundAvailable = hasBalance;
                    shouldMarkAsRefunded = !hasBalance; // No balance means funds were withdrawn
                    console.log(
                      `[BALANCE CHECK] cbBTC balance for ${userDepositAddress}: ${balance.toString()}, shouldMarkAsRefunded: ${shouldMarkAsRefunded}`
                    );
                  } else {
                    isRefundAvailable = false; // No cbBTC token found
                    shouldMarkAsRefunded = true; // No token found means withdrawn
                    console.log(
                      `[BALANCE CHECK] No cbBTC token found for ${userDepositAddress}, shouldMarkAsRefunded: true`
                    );
                  }
                } else {
                  isRefundAvailable = false; // No tokens found
                  shouldMarkAsRefunded = true; // No tokens means withdrawn
                }
              }
            } catch (error) {
              console.warn(`Error checking cbBTC balance for ${userDepositAddress}:`, error);
              isRefundAvailable = false; // Default to not available if we can't check
            }
          }
        }

        // If server says refund available but balance is 0, mark as refunded
        if (shouldMarkAsRefunded && mappedSwap.flow.length > 0) {
          console.log(`[REFUND DETECTED] Swap ${mappedSwap.id}: Balance is 0, marking as refunded`);
          console.log(
            `[REFUND DETECTED] Current flow:`,
            mappedSwap.flow.map((s) => ({ status: s.status, state: s.state }))
          );

          // Mark all in-progress steps as completed
          mappedSwap.flow.forEach((step) => {
            if (step.state === "inProgress") {
              step.state = "completed";
            }
          });

          // Update the last step to show refunded status
          const lastStep = mappedSwap.flow[mappedSwap.flow.length - 1];
          lastStep.status = "user_refunded_detected";
          lastStep.state = "completed";

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

    // Filter out swaps that are pending or only at waiting_user_deposit_initiated
    // (these are created but user never deposited)
    const swaps = allSwaps.filter((swap: AdminSwapItem) => {
      const currentStep =
        swap.flow.find((s: AdminSwapFlowStep) => s.state === "inProgress") ||
        swap.flow[swap.flow.length - 1];
      const currentStatus = currentStep?.status;
      // Exclude if pending or only at waiting_user_deposit_initiated
      return currentStatus !== "pending" && currentStatus !== "waiting_user_deposit_initiated";
    });

    console.log("[FETCH USER SWAPS] Swaps after filtering:", swaps);

    const hasMore = allSwaps.length === limit; // If we got a full page, there might be more

    return { swaps, hasMore };
  } catch (error) {
    console.error("Error fetching user swaps:", error);
    return { swaps: [], hasMore: false };
  }
}

export const UserSwapHistory: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();
  const { isMobile } = useWindowSize();
  const [swaps, setSwaps] = useState<AdminSwapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const fetchingRef = useRef(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Refund modal state
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedFailedSwap, setSelectedFailedSwap] = useState<AdminSwapItem | null>(null);
  const [refundAddress, setRefundAddress] = useState("");
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [refundStatus, setRefundStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );

  // Handle initial mount - wait briefly for wallet to auto-reconnect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 500); // Wait 500ms for wallet to auto-reconnect

    return () => clearTimeout(timer);
  }, []);

  // Fetch initial swaps with retry logic and set up polling
  useEffect(() => {
    if (!isConnected || !address) {
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
  }, [address, isConnected]);

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
      <>
        <GridFlex
          maxW="750px"
          w="100%"
          contentPadding={isMobile ? "20px" : "32px"}
          borderRadius="40px"
          mb="20px"
          mt={isMobile ? "80px" : "0"}
        >
          <Flex direction="column" w="100%" align="center">
            <Text
              fontSize={isMobile ? "24px" : "36px"}
              mt={isMobile ? "-8px" : "-15px"}
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colorsAnalytics.offWhite}
              textAlign="center"
            >
              Swap History
            </Text>
            <Text
              fontSize={isMobile ? "13px" : "15px"}
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colorsAnalytics.textGray}
              mt="-2px"
              mb="-4px"
              letterSpacing="-0.5px"
              textAlign="center"
            >
              Manage the status of your current and previous Rift swaps.
            </Text>
          </Flex>
        </GridFlex>
        <GridFlex width="100%" borderRadius="40px" heightBlocks={13} contentPadding={0}>
          <Flex direction="column" w="100%" h="100%" align="center" justify="center">
            <Spinner size="lg" color={colors.offWhite} />
          </Flex>
        </GridFlex>
      </>
    );
  }

  const handleOpenRefundModal = (swap: AdminSwapItem) => {
    setSelectedFailedSwap(swap);
    setRefundModalOpen(true);
    setRefundAddress("");
  };

  const handleCloseRefundModal = () => {
    setRefundModalOpen(false);
    setSelectedFailedSwap(null);
    setRefundAddress("");
    setRefundStatus("idle");
    setIsClaimingRefund(false);
  };

  const handleClaimRefund = async () => {
    if (!selectedFailedSwap || !walletClient) {
      if (!walletClient) {
        toastError(null, {
          title: "Wallet not connected",
          description: "Please connect your wallet to claim a refund.",
        });
      }
      return;
    }

    // Check if address is empty
    if (!refundAddress || refundAddress.trim() === "") {
      toastError(null, {
        title: "Address required",
        description: "Please enter your refund address.",
      });
      return;
    }

    // Validate the refund address format
    const addressType = selectedFailedSwap.direction === "BTC_TO_EVM" ? "bitcoin" : "ethereum";
    if (!validateRefundAddress(refundAddress, addressType)) {
      toastError(null, {
        title: "Invalid address",
        description: `Please enter a valid ${addressType === "bitcoin" ? "Bitcoin" : "Ethereum"} address.`,
      });
      return;
    }

    setIsClaimingRefund(true);
    setRefundStatus("loading");

    try {
      console.log("[CLAIM REFUND] Starting refund claim:", {
        swapId: selectedFailedSwap.id,
        refundAddress,
        swap: selectedFailedSwap,
        walletAddress: walletClient.account?.address,
      });

      // Create signed refund request
      const { refundResponse, transactionHash } = await executeCompleteRefund(
        otcClient,
        walletClient,
        selectedFailedSwap.id,
        refundAddress,
        "0" // Default fee of 0 - can be adjusted if needed
      );

      console.log("[CLAIM REFUND] refund processed, response:", refundResponse);

      console.log("[CLAIM REFUND] Server response:", transactionHash);

      setRefundStatus("success");
      toastSuccess({
        title: "Refund claimed!",
        description: "Your refund has been successfully processed. It will arrive shortly.",
      });

      // Wait a moment before closing the modal so user can see success state
      setTimeout(() => {
        handleCloseRefundModal();
        // Refresh the swaps list to update the status
        if (address) {
          fetchUserSwaps(address, pageSize, 0).then(({ swaps: newSwaps }) => {
            setSwaps(newSwaps);
          });
        }
      }, 2000);
    } catch (error) {
      console.error("[CLAIM REFUND] Error:", error);
      setRefundStatus("error");

      const errorMessage = formatRefundError(error);
      toastError(error, {
        title: "Refund failed",
        description: errorMessage,
      });
    } finally {
      setIsClaimingRefund(false);
    }
  };

  if (!isConnected) {
    return (
      <>
        <GridFlex
          maxW="750px"
          w="100%"
          contentPadding={isMobile ? "20px" : "32px"}
          borderRadius="40px"
          mb="20px"
          mt={isMobile ? "80px" : "0"}
        >
          <Flex direction="column" w="100%" align="center">
            <Text
              fontSize={isMobile ? "24px" : "36px"}
              mt={isMobile ? "-8px" : "-15px"}
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colorsAnalytics.offWhite}
              textAlign="center"
            >
              Swap History
            </Text>
            <Text
              fontSize={isMobile ? "13px" : "15px"}
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colorsAnalytics.textGray}
              mt="-2px"
              mb="-4px"
              letterSpacing="-0.5px"
              textAlign="center"
            >
              Manage the status of your current and previous Rift swaps.
            </Text>
          </Flex>
        </GridFlex>
        <GridFlex
          width={isMobile ? "100%" : "595px"}
          contentPadding={isMobile ? "40px 20px" : "60px"}
          borderRadius="60px"
        >
          <Flex direction="column" w="100%" align="center">
            <Text
              fontSize={isMobile ? "24px" : "32px"}
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              mb="16px"
              textAlign="center"
            >
              Swap History
            </Text>
            <Text
              fontSize={isMobile ? "14px" : "16px"}
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
              borderRadius="12px"
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
      </>
    );
  }

  return (
    <>
      <GridFlex
        maxW="750px"
        w="100%"
        contentPadding={isMobile ? "20px" : "32px"}
        borderRadius="40px"
        mb="20px"
        mt={isMobile ? "80px" : "0"}
      >
        <Flex direction="column" w="100%" align="center">
          <Text
            fontSize={isMobile ? "24px" : "36px"}
            mt={isMobile ? "-8px" : "-15px"}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colorsAnalytics.offWhite}
            textAlign="center"
          >
            Swap History
          </Text>
          <Text
            fontSize={isMobile ? "13px" : "15px"}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colorsAnalytics.textGray}
            mt="-2px"
            mb="-4px"
            letterSpacing="-0.5px"
            textAlign="center"
          >
            Manage the status of your current and previous Rift swaps.
          </Text>
        </Flex>
      </GridFlex>
      {isMobile ? (
        // Mobile: Simple scrollable container
        <Flex direction="column" w="100%" pb="20px">
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
                    // w="100%"
                    p="16px"
                    mx="12px"
                    mb="12px"
                    bg="rgba(18, 18, 18, 0.6)"
                    borderRadius="16px"
                    border={`1px solid ${colors.borderGray}`}
                    _hover={{ bg: "rgba(28, 28, 28, 0.7)" }}
                    transition="background 0.15s ease"
                    cursor="pointer"
                    onClick={() => router.push(`/swap/${swap.id}`)}
                    gap="12px"
                  >
                    {/* Time */}
                    <Flex direction="column" gap="4px">
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
                        fontSize="12px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.offWhite}
                        letterSpacing="-0.5px"
                      >
                        {formatTimeAgo(swap.swapCreationTimestamp)}
                      </Text>
                    </Flex>

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
                      <Flex gap="4px" align="center">
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                        </Text>
                        <AssetIcon badge={isBTCtoEVM ? "BTC" : "cbBTC"} />
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {isBTCtoEVM ? "BTC" : "cbBTC"}
                        </Text>
                      </Flex>
                    </Flex>

                    {/* Deposit Txn */}
                    <Flex direction="column" gap="4px">
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
                    <Flex direction="column" gap="4px">
                      <Text
                        fontSize="10px"
                        fontFamily={FONT_FAMILIES.SF_PRO}
                        color={colors.textGray}
                        textTransform="uppercase"
                        fontWeight="600"
                        letterSpacing="0.5px"
                      >
                        Direction
                      </Text>
                      <Flex align="center" gap="6px">
                        <AssetIcon badge={swap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"} />
                        <Text
                          fontSize="12px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          letterSpacing="-0.5px"
                        >
                          {swap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"}
                        </Text>
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          →
                        </Text>
                        <AssetIcon badge={swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"} />
                        <Text
                          fontSize="12px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          letterSpacing="-0.5px"
                        >
                          {swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"}
                        </Text>
                      </Flex>
                    </Flex>

                    {/* Payout Txn */}
                    <Flex direction="column" gap="4px">
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
                      <StatusBadge swap={swap} onClaimRefund={() => handleOpenRefundModal(swap)} />
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
            </Flex>
          )}
        </Flex>
      ) : (
        // Desktop: GridFlex with fixed height and scrolling
        <GridFlex width="100%" borderRadius="40px" heightBlocks={13} contentPadding={0}>
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
                      {/* Time */}
                      <Flex flex="0 0 122px">
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
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.offWhite}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {swap.swapInitialAmountBtc.toFixed(8).replace(/\.?0+$/, "")}
                        </Text>
                        <AssetIcon badge={isBTCtoEVM ? "BTC" : "cbBTC"} />
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          fontWeight="500"
                          letterSpacing="-0.5px"
                        >
                          {isBTCtoEVM ? "BTC" : "cbBTC"}
                        </Text>
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
                        <AssetIcon badge={swap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"} />
                        <Text
                          fontSize="12px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          {swap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"}
                        </Text>
                        <Text
                          fontSize="13px"
                          fontFamily={FONT_FAMILIES.AUX_MONO}
                          color={colors.textGray}
                          letterSpacing="-0.5px"
                        >
                          →
                        </Text>
                        <AssetIcon badge={swap.direction === "BTC_TO_EVM" ? "cbBTC" : "BTC"} />
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
                        <StatusBadge
                          swap={swap}
                          onClaimRefund={() => handleOpenRefundModal(swap)}
                        />
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

      {/* Refund Modal */}
      {refundModalOpen && selectedFailedSwap && (
        <Flex
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          width="100vw"
          height="100vh"
          zIndex={999999}
          bg="rgba(0, 0, 0, 0.85)"
          align="center"
          justify="center"
          style={{
            backdropFilter: "blur(4px)",
          }}
          onClick={handleCloseRefundModal}
        >
          <Box
            bg="#1a1a1a"
            borderWidth={2}
            w="500px"
            maxWidth="90%"
            borderColor={colors.borderGray}
            borderRadius="20px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.offWhite}
            position="relative"
            p="32px"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close Button */}
            <Flex
              pb="24px"
              fontSize="24px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              fontWeight="bold"
              justify="center"
              align="center"
              position="relative"
            >
              <Button
                position="absolute"
                left="0"
                top="0"
                bg="transparent"
                border="none"
                color={colors.textGray}
                _hover={{ color: colors.offWhite }}
                onClick={handleCloseRefundModal}
                p="5px"
                minW="auto"
                h="auto"
                disabled={isClaimingRefund}
                opacity={isClaimingRefund ? 0.5 : 1}
              >
                <FiX size={24} />
              </Button>
              <Text>Claim Refund</Text>
            </Flex>

            {/* Body */}
            <Flex direction="column" gap="24px" pb="8px">
              <Text
                fontSize="13px"
                textAlign="center"
                lineHeight="1.6"
                mb="5px"
                color={colors.textGray}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                letterSpacing="-0.5px"
              >
                The market maker failed to fill your order. Please paste your refund address to
                claim your funds.
              </Text>

              {/* Address Input */}
              <Flex direction="column" gap="8px">
                <Flex align="center" gap="8px" mb="4px">
                  <AssetIcon
                    badge={selectedFailedSwap.direction === "BTC_TO_EVM" ? "BTC" : "cbBTC"}
                  />
                  <Text fontSize="13px" color={colors.textGray} fontFamily={FONT_FAMILIES.AUX_MONO}>
                    {selectedFailedSwap.direction === "BTC_TO_EVM" ? "Bitcoin" : "cbBTC"} Address
                  </Text>
                </Flex>
                <input
                  type="text"
                  value={refundAddress}
                  onChange={(e) => setRefundAddress(e.target.value)}
                  placeholder={
                    selectedFailedSwap.direction === "BTC_TO_EVM"
                      ? "Enter Bitcoin address"
                      : "Enter cbBTC address"
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: `2px solid ${colors.borderGray}`,
                    backgroundColor: colors.offBlack,
                    color: colors.offWhite,
                    fontFamily: FONT_FAMILIES.AUX_MONO,
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </Flex>

              {/* Status message for success/error */}
              {refundStatus === "success" && (
                <Flex
                  align="center"
                  justify="center"
                  gap="8px"
                  p="12px"
                  borderRadius="12px"
                  bg="rgba(34, 197, 94, 0.15)"
                  border="1.5px solid rgba(34, 197, 94, 0.4)"
                >
                  <FiCheck size={16} color="#22c55e" />
                  <Text fontSize="13px" color="#22c55e" fontFamily={FONT_FAMILIES.AUX_MONO}>
                    Refund successfully claimed!
                  </Text>
                </Flex>
              )}
              {refundStatus === "error" && (
                <Flex
                  align="center"
                  justify="center"
                  gap="8px"
                  p="12px"
                  borderRadius="12px"
                  bg="rgba(239, 68, 68, 0.15)"
                  border="1.5px solid rgba(239, 68, 68, 0.4)"
                >
                  <FiX size={16} color="#ef4444" />
                  <Text fontSize="13px" color="#ef4444" fontFamily={FONT_FAMILIES.AUX_MONO}>
                    Failed to claim refund. Please try again.
                  </Text>
                </Flex>
              )}

              {/* Claim Button */}
              <Flex justify="center">
                <Button
                  onClick={handleClaimRefund}
                  cursor={isClaimingRefund ? "not-allowed" : "pointer"}
                  color={colors.offWhite}
                  _active={{ bg: colors.swapBgColor }}
                  _hover={{ bg: isClaimingRefund ? colors.swapBgColor : colors.swapHoverColor }}
                  borderRadius="12px"
                  border={`2.5px solid ${colors.swapBorderColor}`}
                  type="button"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="15px"
                  paddingX="32px"
                  paddingY="10px"
                  bg={colors.swapBgColor}
                  disabled={isClaimingRefund}
                  w="100%"
                >
                  {isClaimingRefund ? (
                    <Flex align="center" gap="8px">
                      <Spinner size="sm" color={colors.offWhite} />
                      <Text>Processing...</Text>
                    </Flex>
                  ) : (
                    "CLAIM REFUND"
                  )}
                </Button>
              </Flex>
            </Flex>
          </Box>
        </Flex>
      )}
    </>
  );
};
