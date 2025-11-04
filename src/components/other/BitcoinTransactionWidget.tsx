import React, { useState, useEffect } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy } from "react-icons/lu";
import { FiExternalLink } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import useWindowSize from "@/hooks/useWindowSize";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { toastSuccess, toastError } from "@/utils/toast";
import WebAssetTag from "./WebAssetTag";
import { useStore } from "@/utils/store";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { useRouter } from "next/router";
import { filterRefunds } from "@/utils/refundHelpers";
import { mapDbRowToAdminSwap, ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { AdminSwapItem } from "@/utils/types";
import { RefundModal } from "./RefundModal";
import { useRefundModal } from "@/hooks/useRefundModal";
import { esploraClient } from "@/utils/esploraClient";

interface BitcoinTransactionWidgetProps {
  address: string;
  amount: number;
  bitcoinUri: string;
  depositTx?: string;
  swapId?: string;
}

// Step configuration for Bitcoin deposit flow
const steps = [
  {
    id: "1-WaitingUserDepositInitiated",
    label: "AWAITING BITCOIN DEPOSIT",
    description: "Waiting for your Bitcoin deposit...",
  },
  {
    id: "2-WaitingUserDepositConfirmed",
    label: "CONFIRMING DEPOSIT",
    description: "Waiting for 2 block confirmations...",
  },
  {
    id: "3-WaitingMMDepositInitiated",
    label: "FILLING ORDER",
    description: "Market makers are filling your order...",
  },
  {
    id: "4-WaitingMMDepositConfirmed",
    label: "SWAP COMPLETE",
    description: "Assets are headed your way!",
  },
];

function StepCarousel({
  isMobile,
  currentStepIndex,
  completedSteps,
  btcConfirmations,
  userDepositTx,
  showFillingOrderWarning,
}: {
  isMobile: boolean;
  currentStepIndex: number;
  completedSteps: Set<string>;
  btcConfirmations: number;
  userDepositTx?: string;
  showFillingOrderWarning: boolean;
}) {
  // Calculate slide offset based on current step
  const slideOffset = -currentStepIndex * 86; // 86px per step

  return (
    <Box position="relative" width="100%" height="100%" overflow="hidden">
      <motion.div
        animate={{
          y: slideOffset,
          paddingTop: "10px",
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        {/* Render all steps */}
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);

          // Calculate position-based properties (matching TransactionWidget)
          // slideOffset is negative, so we need to add it to get correct position
          const positionFromTop = index + slideOffset / 86;
          const isCurrent = Math.abs(positionFromTop) < 0.1; // Current is at position 0

          // Dynamic description based on step and confirmations
          let stepDescription = step.description;

          // Step 2: User Bitcoin deposit confirmation
          if (
            step.id === "2-WaitingUserDepositConfirmed" &&
            btcConfirmations > 0 &&
            userDepositTx
          ) {
            const requiredConfs = 2; // BTC->EVM swaps need 2 confirmations
            const currentConfs = Math.min(btcConfirmations, requiredConfs);
            stepDescription = `Confirming... ${currentConfs}/${requiredConfs} confirmations`;
          }

          // Step 3: Filling order - show warning if taking too long
          if (step.id === "3-WaitingMMDepositInitiated" && showFillingOrderWarning) {
            stepDescription =
              "Market makers are taking longer than usual to fill your order... if not filled within 1 hour, your order will be refunded";
          }

          // Animate opacity based on position (matching TransactionWidget logic)
          const opacity =
            positionFromTop < 0
              ? 0 // Above viewport
              : positionFromTop < 0.1
                ? 1 // Current step (position ~0)
                : positionFromTop < 1.1
                  ? 0.4 // Next step (position ~1)
                  : positionFromTop < 3
                    ? Math.max(0.1, 0.3 - (positionFromTop - 1) * 0.1) // Future steps
                    : 0; // Too far down

          return (
            <motion.div
              key={step.id}
              style={{
                height: currentStepIndex === 3 ? "79px" : "86px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
              animate={{ opacity }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Flex direction="column" alignItems="center" justifyContent="center">
                {/* Title with checkmark/spinner on left side */}
                <Flex alignItems="center" justifyContent="center" gap="12px">
                  {/* Loading Spinner or Checkmark */}
                  <Box
                    width="24px"
                    height="24px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {isCurrent && !isCompleted ? (
                      // Loading Spinner for current step (including Settled step initially)
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <Box
                          width="20px"
                          height="20px"
                          border="2px solid rgba(255,255,255,0.3)"
                          borderTop="2px solid white"
                          borderRadius="50%"
                        />
                      </motion.div>
                    ) : isCompleted ? (
                      // Checkmark for completed steps
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          duration: 0.4,
                          type: "spring",
                          damping: 15,
                          stiffness: 300,
                          delay: 0.1,
                        }}
                      >
                        <Box
                          width="24px"
                          height="24px"
                          borderRadius="50%"
                          bg="#4CAF50"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        </Box>
                      </motion.div>
                    ) : (
                      // Inactive circle for future steps
                      <Box
                        width="24px"
                        height="24px"
                        borderRadius="50%"
                        border="2px solid rgba(255,255,255,0.3)"
                      />
                    )}
                  </Box>

                  <motion.div
                    initial={{
                      color: isCurrent ? "white" : "rgba(255,255,255,0.6)",
                      fontSize: isCurrent
                        ? isMobile
                          ? "16px"
                          : "20px"
                        : isMobile
                          ? "14px"
                          : "18px",
                    }}
                    animate={{
                      color: isCurrent ? "white" : "rgba(255,255,255,0.6)",
                      fontSize: isCurrent
                        ? isMobile
                          ? "16px"
                          : "20px"
                        : isMobile
                          ? "14px"
                          : "18px",
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <Text fontFamily="Nostromo" fontWeight="bold" letterSpacing="1px">
                      {step.label}
                    </Text>
                  </motion.div>
                </Flex>

                {/* Description - centered below title */}
                <motion.div
                  initial={{
                    opacity: isCurrent ? 1 : 0,
                  }}
                  animate={{
                    opacity: isCurrent ? 1 : 0,
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ textAlign: "center" }}
                >
                  <Text
                    color="rgba(255,255,255,0.7)"
                    fontSize={isMobile ? "12px" : "13px"}
                    fontFamily="Aux"
                    mt="9px"
                    textAlign="center"
                  >
                    {stepDescription}
                  </Text>
                </motion.div>
              </Flex>
            </motion.div>
          );
        })}
      </motion.div>
    </Box>
  );
}

export function BitcoinTransactionWidget({
  address,
  amount,
  bitcoinUri,
  depositTx,
  swapId,
}: BitcoinTransactionWidgetProps) {
  const { isMobile } = useWindowSize();
  const router = useRouter();
  const depositFlowState = useStore((state) => state.depositFlowState);
  const swapResponse = useStore((state) => state.swapResponse);

  // Use provided swapId prop, fallback to store value
  const currentSwapId = swapId || swapResponse?.swap_id;
  const { data: swapStatusInfo } = useSwapStatus(currentSwapId);

  // Track completed steps
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showButtons, setShowButtons] = useState(false);
  const [isRefundAvailable, setIsRefundAvailable] = useState(false);
  const [failedSwapData, setFailedSwapData] = useState<AdminSwapItem | null>(null);
  const [btcConfirmations, setBtcConfirmations] = useState<number>(0);
  const [showFillingOrderWarning, setShowFillingOrderWarning] = useState(false);
  const [isSwapRefunded, setIsSwapRefunded] = useState(false);

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
  } = useRefundModal({ redirectOnSuccess: true });

  // Map deposit flow state to step index
  // If status is "5-Settled", treat it as step 3 (the final step, index 3)
  const isSettled = depositFlowState === "5-Settled";
  const currentStepIndex = isSettled ? 3 : steps.findIndex((step) => step.id === depositFlowState);
  const validStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  // Check if swap has expired (created > 12 hours ago and still on step 1)
  const isExpired = React.useMemo(() => {
    if (validStepIndex !== 0 || !swapStatusInfo?.created_at) return false;

    const createdAt = new Date(swapStatusInfo.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceCreation > 12;
  }, [validStepIndex, swapStatusInfo?.created_at]);

  // Check if stuck on "FILLING ORDER" step for more than 10 minutes
  useEffect(() => {
    console.log("[FILLING ORDER WARNING] Deposit flow state:", depositFlowState);
    if (depositFlowState !== "3-WaitingMMDepositInitiated") {
      setShowFillingOrderWarning(false);
      return;
    }

    // Get the timestamp when swap was created
    const swapCreatedAt = swapStatusInfo?.created_at;

    console.log("[FILLING ORDER WARNING] Swap created at:", swapCreatedAt);
    if (!swapCreatedAt) {
      return;
    }

    const checkTimer = () => {
      const createdTime = new Date(swapCreatedAt);
      const now = new Date();
      const minutesSinceCreated = (now.getTime() - createdTime.getTime()) / (1000 * 60);
      console.log("[FILLING ORDER WARNING] Minutes since created:", minutesSinceCreated);

      if (minutesSinceCreated >= 10) {
        setShowFillingOrderWarning(true);
      }
    };

    // Check immediately
    checkTimer();

    // Check every 30 seconds
    const interval = setInterval(checkTimer, 30000);

    return () => clearInterval(interval);
  }, [depositFlowState, swapStatusInfo?.created_at]);

  // Poll for Bitcoin confirmations when user deposit is being confirmed (step 2)
  useEffect(() => {
    // Only poll for BTC confirmations when user has deposited Bitcoin (step 2)
    if (depositFlowState !== "2-WaitingUserDepositConfirmed") {
      return;
    }

    const userDepositTx = swapStatusInfo?.user_deposit?.deposit_tx;

    if (!userDepositTx || !depositTx) {
      return;
    }

    // Type guard: at this point userDepositTx is definitely a string
    const txHash: string = userDepositTx;
    let isCancelled = false;

    async function fetchConfirmations() {
      try {
        const confirmations = await esploraClient.getConfirmations(txHash);
        if (!isCancelled) {
          setBtcConfirmations(confirmations);
          console.log(`[BTC CONFIRMATIONS] ${userDepositTx}: ${confirmations} confirmations`);
        }
      } catch (error) {
        console.error("Error fetching BTC confirmations:", error);
      }
    }

    // Fetch immediately
    fetchConfirmations();

    // Poll every 30 seconds
    const interval = setInterval(fetchConfirmations, 30000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [depositFlowState, swapStatusInfo?.user_deposit?.deposit_tx, depositTx]);

  // Fetch swap data from analytics API and check refund eligibility
  useEffect(() => {
    async function checkRefundEligibility() {
      if (!currentSwapId || validStepIndex !== 2) {
        setIsRefundAvailable(false);
        return;
      }

      try {
        // Fetch swap data from analytics API
        const url = `${ANALYTICS_API_URL}/api/swap/${currentSwapId}`;
        console.log(`[REFUND CHECK] Fetching swap data from: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(
            `Failed to fetch swap data for refund check: ${currentSwapId}`,
            response.status
          );
          setIsRefundAvailable(false);
          return;
        }

        const data = await response.json();
        console.log(`[REFUND CHECK] Raw response:`, data);

        // The single swap endpoint returns {swap: {...}}, but we need the format from /api/swaps
        // The row should have the refund flag at the top level
        let row = data.swap || data;

        // Check if we need to add the refund flag by checking the response structure
        // If isRefundAvailable is not present, we need to check the swap status manually
        if (row.isRefundAvailable === undefined && row.is_refund_available === undefined) {
          // Calculate refund availability based on the checkRefundEligibility logic
          const status = row.status;
          const userDepositConfirmedAt = row.user_deposit?.deposit_confirmed_at;
          const mmDepositInitiatedAt = row.mm_deposit?.deposit_detected_at;

          console.log(`[REFUND CHECK] Calculating refund eligibility from status:`, {
            status,
            userDepositConfirmedAt,
            mmDepositInitiatedAt,
          });

          // Check Case 1: MM never initiated deposit (>1 hour after user deposit confirmed)
          if (status === "WaitingMMDepositInitiated" && userDepositConfirmedAt) {
            const userDepositTime = new Date(userDepositConfirmedAt);
            const now = new Date();
            const hoursSinceUserDeposit =
              (now.getTime() - userDepositTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceUserDeposit >= 1) {
              row.isRefundAvailable = true;
              console.log(
                `[REFUND CHECK] MM never initiated deposit, ${hoursSinceUserDeposit.toFixed(2)} hours since user deposit`
              );
            }
          }

          // Check Case 2: MM deposit never confirmed (>24 hours after MM initiated)
          if (status === "WaitingMMDepositConfirmed" && mmDepositInitiatedAt) {
            const mmDepositTime = new Date(mmDepositInitiatedAt);
            const now = new Date();
            const hoursSinceMMDeposit =
              (now.getTime() - mmDepositTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceMMDeposit >= 24) {
              row.isRefundAvailable = true;
              console.log(
                `[REFUND CHECK] MM deposit never confirmed, ${hoursSinceMMDeposit.toFixed(2)} hours since MM deposit`
              );
            }
          }
        }

        console.log(`[REFUND CHECK] Swap data after refund flag check:`, row);
        console.log(`[REFUND CHECK] Server refund flags:`, {
          isRefundAvailable: row.isRefundAvailable,
          is_refund_available: row.is_refund_available,
        });

        let mappedSwap = mapDbRowToAdminSwap(row);
        console.log(`[REFUND CHECK] Mapped swap:`, mappedSwap);

        // Use filterRefunds to check if refund is available
        const { isRefundAvailable: refundAvailable, shouldMarkAsRefunded } = await filterRefunds(
          row,
          mappedSwap
        );

        // If balance is 0 (shouldMarkAsRefunded), modify the flow to show refunded status
        if (shouldMarkAsRefunded && mappedSwap.flow.length > 0) {
          console.log(`[DETECTOR] Modifying flow for refunded swap ${currentSwapId}`);

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
                status: "user_refunded_detected" as any,
                label: "Refunded",
                state: "completed",
              },
            ];

            console.log(
              `[DETECTOR] Updated flow:`,
              mappedSwap.flow.map((s) => ({
                status: s.status,
                state: s.state,
                label: s.label,
              }))
            );
          }
        }

        console.log(`[REFUND CHECK] Swap ${currentSwapId}: isRefundAvailable = ${refundAvailable}`);
        console.log(`[REFUND CHECK] shouldMarkAsRefunded = ${shouldMarkAsRefunded}`);

        // DETECTOR logging
        console.log("═══════════════════════════════════════════════");
        console.log(`[DETECTOR] Swap ID: ${currentSwapId}`);
        console.log(`[DETECTOR] Step: ${validStepIndex} (${depositFlowState})`);
        console.log(`[DETECTOR] isRefundAvailable: ${refundAvailable}`);
        console.log(`[DETECTOR] shouldMarkAsRefunded: ${shouldMarkAsRefunded}`);
        console.log(
          `[DETECTOR] Current flow:`,
          mappedSwap.flow.map((s) => ({
            status: s.status,
            state: s.state,
            label: s.label,
          }))
        );

        // Check if swap is actually refunded by looking at flow
        const currentStep =
          mappedSwap.flow.find((s) => s.state === "inProgress") ||
          mappedSwap.flow[mappedSwap.flow.length - 1];
        const isSwapRefunded =
          currentStep?.status === "refunding_user" ||
          currentStep?.status === "refunding_mm" ||
          currentStep?.status === "user_refunded_detected";

        console.log(`[DETECTOR] Current step:`, currentStep);
        console.log(`[DETECTOR] isSwapRefunded (by status): ${isSwapRefunded}`);
        console.log("═══════════════════════════════════════════════");

        // Set the refunded state
        setIsSwapRefunded(isSwapRefunded);

        // If refund available, store the swap data
        if (refundAvailable) {
          setIsRefundAvailable(true);
          setFailedSwapData(mappedSwap);
        }
        // If swap was refunded (balance = 0), don't show refund available
        else if (shouldMarkAsRefunded) {
          setIsRefundAvailable(false);
          setFailedSwapData(null);
        } else {
          setIsRefundAvailable(false);
          setFailedSwapData(null);
        }
      } catch (error) {
        console.error(`Error checking refund eligibility for ${currentSwapId}:`, error);
        setIsRefundAvailable(false);
      }
    }

    checkRefundEligibility();
  }, [currentSwapId, validStepIndex]);

  // Update completed steps when moving forward
  useEffect(() => {
    if (validStepIndex > 0) {
      const newCompletedSteps = new Set(completedSteps);
      for (let i = 0; i < validStepIndex; i++) {
        newCompletedSteps.add(steps[i].id);
      }
      // If settled, also mark the final step as completed and show buttons
      console.log("[debug] isSettled", isSettled);
      console.log("[debug] validStepIndex", validStepIndex);
      if (isSettled && validStepIndex === 3) {
        newCompletedSteps.add(steps[3].id);
        setTimeout(() => {
          setShowButtons(true);
        }, 1000); // Delay to match the animation
      }
      setCompletedSteps(newCompletedSteps);
    }
  }, [validStepIndex, isSettled]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess({
        title: "Copied to Clipboard",
        description: `${label} copied successfully`,
      });
    } catch (err) {
      console.error(`Failed to copy ${label}:`, err);
      toastError(err, {
        title: "Copy Failed",
        description: `Unable to copy ${label}`,
      });
    }
  };

  const handleViewTransaction = () => {
    if (depositTx) {
      window.open(`https://mempool.space/tx/${depositTx}`, "_blank");
    }
  };

  const handleViewMmTransaction = () => {
    const txnId = swapStatusInfo?.mm_deposit?.deposit_tx;
    const chain = swapStatusInfo?.mm_deposit?.chain;

    if (txnId) {
      // MM deposit for BTC->cbBTC is on Ethereum (cbBTC is ERC-20)
      if (chain === "ETH") {
        window.open(`https://etherscan.io/tx/${txnId}`, "_blank");
      } else if (chain === "BASE") {
        window.open(`https://basescan.org/tx/${txnId}`, "_blank");
      } else {
        window.open(`https://etherscan.io/tx/${txnId}`, "_blank");
      }
    } else {
      window.open("https://etherscan.io", "_blank");
    }
  };

  const handleCopyTxn = async () => {
    const txnId = swapStatusInfo?.mm_deposit?.deposit_tx;
    if (txnId) {
      try {
        await navigator.clipboard.writeText(txnId);
        toastSuccess({
          title: "Copied to Clipboard",
          description: "Transaction ID copied successfully",
        });
      } catch (err) {
        console.error("Failed to copy transaction ID:", err);
        toastError(err, {
          title: "Copy Failed",
          description: "Unable to copy transaction ID",
        });
      }
    }
  };

  const getShortTxnId = () => {
    const txnId = swapStatusInfo?.mm_deposit?.deposit_tx;
    if (!txnId) return "";
    return `${txnId.slice(0, 12)}...${txnId.slice(-12)}`;
  };

  const handleNewSwap = () => {
    router.push("/");
  };

  // If swap has been refunded, show refunded completion view
  if (isSwapRefunded) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          {/* Top Half - Refund Icon */}
          <Box
            w="100%"
            h="50%"
            borderRadius="40px"
            position="absolute"
            top="0px"
            background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
            display="flex"
            backdropFilter="blur(20px)"
            alignItems="center"
            justifyContent="center"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "40px",
              padding: "3px",
              background:
                "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
            }}
          >
            {/* Refund Icon */}
            <Box
              width="110px"
              height="110px"
              borderRadius="50%"
              bg="rgba(251, 191, 36, 0.2)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="3px solid rgba(251, 191, 36, 0.5)"
              zIndex={1}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </Box>
          </Box>

          {/* Bottom Half - Refunded Message */}
          <Box
            h="50%"
            bottom="0px"
            position="absolute"
            padding="20px"
            w="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="20px"
          >
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.offWhite}
              textAlign="center"
              px="40px"
              lineHeight="1.6"
            >
              This swap has been refunded. You can view details in the swap history page.
            </Text>

            {/* Buttons */}
            <Flex
              gap="16px"
              justifyContent="center"
              direction={isMobile ? "column" : "row"}
              flexWrap="wrap"
              alignItems="center"
            >
              {/* Swap History Button */}
              <Box
                as="button"
                onClick={() => router.push("/history")}
                border="2px solid rgba(255, 255, 255, 0.3)"
                borderRadius="16px"
                width={isMobile ? "240px" : "190px"}
                background="rgba(255, 255, 255, 0.1)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="13px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  SWAP HISTORY
                </Text>
              </Box>

              {/* New Swap Button */}
              <Box
                as="button"
                onClick={handleNewSwap}
                borderRadius="16px"
                width={isMobile ? "240px" : "190px"}
                border="2px solid #6651B3"
                background="rgba(86, 50, 168, 0.30)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  NEW SWAP
                </Text>
              </Box>
            </Flex>
          </Box>
        </Box>
      </Flex>
    );
  }

  // If refund is available (MM failed to fill), show failed view
  if (isRefundAvailable) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          {/* Top Half - Error Icon */}
          <Box
            w="100%"
            h="50%"
            borderRadius="40px"
            position="absolute"
            top="0px"
            background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
            display="flex"
            backdropFilter="blur(20px)"
            alignItems="center"
            justifyContent="center"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "40px",
              padding: "3px",
              background:
                "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
            }}
          >
            {/* Error Icon */}
            <Box
              width="110px"
              height="110px"
              borderRadius="50%"
              bg="rgba(231, 76, 60, 0.2)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="3px solid rgba(231, 76, 60, 0.5)"
              zIndex={1}
            >
              <Text fontSize="60px" color="#E74C3C">
                !
              </Text>
            </Box>
          </Box>

          {/* Bottom Half - Failed Message */}
          <Box
            h="50%"
            bottom="0px"
            position="absolute"
            padding="20px"
            w="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="20px"
          >
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.offWhite}
              textAlign="center"
              px="40px"
              mt="-15px"
              mb="15px"
              lineHeight="1.6"
            >
              The market maker failed to fill your order. You can initiate a refund in the swap
              history page or with the button below.
            </Text>

            {/* Buttons */}
            <Flex
              gap="16px"
              justifyContent="center"
              direction={isMobile ? "column" : "row"}
              flexWrap="wrap"
            >
              {/* View Deposit Transaction Button - if we have user deposit tx */}
              {depositTx && (
                <Box
                  as="button"
                  onClick={handleViewTransaction}
                  border="2px solid rgba(255, 255, 255, 0.3)"
                  borderRadius="16px"
                  width={isMobile ? "240px" : "210px"}
                  background="rgba(255, 255, 255, 0.1)"
                  padding="12px 16px"
                  cursor="pointer"
                  transition="all 0.2s"
                  zIndex={1}
                  _hover={{
                    transform: "translateY(-2px)",
                    bg: "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <Text
                    color="white"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    fontSize="13px"
                    fontWeight="normal"
                    letterSpacing="0.5px"
                  >
                    VIEW DEPOSIT TXN
                  </Text>
                </Box>
              )}

              {/* Initiate Refund Button */}
              <Box
                as="button"
                onClick={() => failedSwapData && openRefundModal(failedSwapData)}
                borderRadius="16px"
                width={isMobile ? "240px" : "210px"}
                border="2px solid #6651B3"
                background="rgba(86, 50, 168, 0.30)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  INITIATE REFUND
                </Text>
              </Box>
            </Flex>
          </Box>
        </Box>

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
      </Flex>
    );
  }

  // If expired, show simple expired view
  if (isExpired) {
    return (
      <Flex direction="column" alignItems="center" gap="20px">
        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap="24px"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          {/* Expired Message */}
          <Flex direction="column" alignItems="center" gap="16px" zIndex={1}>
            <Text
              fontSize="24px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              letterSpacing="1px"
            >
              SWAP EXPIRED
            </Text>

            {/* Swap ID */}
            {currentSwapId && (
              <Flex
                alignItems="center"
                gap="8px"
                bg="rgba(251, 191, 36, 0.15)"
                borderRadius="12px"
                padding="10px 16px"
                border="1px solid rgba(251, 191, 36, 0.4)"
                cursor="pointer"
                onClick={() => copyToClipboard(currentSwapId, "Swap ID")}
                _hover={{ bg: "rgba(251, 191, 36, 0.2)" }}
                transition="all 0.2s"
              >
                <Text
                  color="rgba(251, 191, 36, 0.9)"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontSize="13px"
                  fontWeight="normal"
                >
                  SWAP ID - {currentSwapId.slice(0, 8)}...{currentSwapId.slice(-8)}
                </Text>
                <LuCopy
                  color="rgba(251, 191, 36, 0.9)"
                  size={14}
                  style={{
                    flexShrink: 0,
                  }}
                />
              </Flex>
            )}
          </Flex>

          {/* Buttons */}
          <Flex gap="16px" justifyContent="center" flexWrap="wrap">
            {/* View Deposit Transaction Button - if we have user deposit tx */}
            {depositTx && (
              <Box
                as="button"
                onClick={handleViewTransaction}
                border="2px solid rgba(255, 255, 255, 0.3)"
                borderRadius="16px"
                width={isMobile ? "160px" : "180px"}
                background="rgba(255, 255, 255, 0.1)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="13px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  VIEW DEPOSIT TXN
                </Text>
              </Box>
            )}

            {/* New Swap Button */}
            <Box
              as="button"
              onClick={handleNewSwap}
              borderRadius="16px"
              width={isMobile ? "140px" : "160px"}
              border="2px solid #6651B3"
              background="rgba(86, 50, 168, 0.30)"
              padding="12px 16px"
              cursor="pointer"
              transition="all 0.2s"
              zIndex={1}
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
              }}
            >
              <Text
                color="white"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                fontWeight="normal"
                letterSpacing="0.5px"
              >
                NEW SWAP
              </Text>
            </Box>
          </Flex>
        </Box>
      </Flex>
    );
  }

  // Normal swap view
  return (
    <Flex direction="column" alignItems="center" gap="20px">
      <Box
        w={isMobile ? "100%" : "805px"}
        h={isMobile ? "600px" : "510px"}
        borderRadius="40px"
        mt="70px"
        boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
        backdropFilter="blur(9px)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        _before={{
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "40px",
          padding: "3px",
          background: "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "xor",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
        }}
      >
        {/* Top Half - QR Code and Details Section */}
        <Box
          w="100%"
          h="54%"
          borderRadius="40px"
          position="absolute"
          top="0px"
          background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
          display="flex"
          backdropFilter="blur(20px)"
          alignItems="center"
          justifyContent="center"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          {/* Corner decorations */}
          <img
            src="/images/txns/top_left.svg"
            alt=""
            style={{
              position: "absolute",
              top: "25px",
              left: "40px",
              width: "28px",
              height: "28px",
              opacity: 0.5,
            }}
          />
          <img
            src="/images/txns/top_right.svg"
            alt=""
            style={{
              position: "absolute",
              top: "25px",
              right: "40px",
              width: "40px",
              height: "40px",
              opacity: 0.5,
            }}
          />
          <img
            src="/images/txns/bottom_left.svg"
            alt=""
            style={{
              position: "absolute",
              bottom: "25px",
              left: "40px",
              width: "40px",
              height: "40px",
              opacity: 0.5,
            }}
          />
          <img
            src="/images/txns/bottom_right.svg"
            alt=""
            style={{
              position: "absolute",
              bottom: "25px",
              right: "40px",
              width: "28px",
              height: "28px",
              opacity: 0.5,
            }}
          />

          {/* Show QR Code only on first step, otherwise show loader or checkmark */}
          {validStepIndex === 0 ? (
            <Flex
              direction={isMobile ? "column" : "row"}
              align="center"
              justify="center"
              gap={isMobile ? "20px" : "40px"}
              zIndex={1}
              px={isMobile ? "20px" : "100px"}
            >
              {/* QR Code on Left */}
              <Flex
                py="10px"
                px="10px"
                borderRadius="12px"
                bg="white"
                boxShadow="0px 8px 20px rgba(0, 16, 118, 0.3)"
                justify="center"
                align="center"
                flexShrink={0}
              >
                <QRCodeSVG value={bitcoinUri} size={isMobile ? 100 : 160} />
              </Flex>

              {/* Address and Amount Details on Right - Stacked Vertically */}
              <Flex
                direction="column"
                gap={isMobile ? "16px" : "24px"}
                flex="1"
                maxW={isMobile ? "100%" : "500px"}
              >
                {/* Bitcoin Address Section */}
                <Flex direction="column" w="100%">
                  <Text
                    fontSize={isMobile ? "10px" : "11px"}
                    color="rgba(255,255,255,0.5)"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    letterSpacing="1px"
                    mb="8px"
                  >
                    BITCOIN ADDRESS
                  </Text>
                  <Flex
                    alignItems="flex-end"
                    gap="12px"
                    position="relative"
                    role="group"
                    cursor="pointer"
                    onClick={() => copyToClipboard(address, "Bitcoin Address")}
                  >
                    <Text
                      color={colors.offWhite}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      fontSize={isMobile ? "18px" : "26px"}
                      letterSpacing={isMobile ? "-1.2px" : "-1.8px"}
                      fontWeight="500"
                      flex="1"
                      lineHeight="1.3"
                      wordBreak="break-all"
                    >
                      {address}
                    </Text>
                    <Box
                      opacity={0.6}
                      _groupHover={{
                        opacity: 1,
                      }}
                      transition="opacity 0.2s"
                      mb="2px"
                    >
                      <LuCopy
                        color="rgba(255, 255, 255, 0.8)"
                        size={20}
                        style={{
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                      />
                    </Box>
                  </Flex>
                </Flex>

                {/* Amount Section */}
                <Flex direction="column" w="100%">
                  <Text
                    fontSize={isMobile ? "10px" : "11px"}
                    color="rgba(255,255,255,0.5)"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    letterSpacing="1px"
                    mb="8px"
                  >
                    DEPOSIT AMOUNT
                  </Text>
                  <Flex
                    alignItems="center"
                    gap="12px"
                    position="relative"
                    role="group"
                    cursor="pointer"
                    onClick={() => copyToClipboard(amount.toFixed(8), "Bitcoin Amount")}
                  >
                    <Text
                      color={colors.offWhite}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      fontSize={isMobile ? "18px" : "26px"}
                      letterSpacing={isMobile ? "-1.2px" : "-1.8px"}
                      fontWeight="500"
                    >
                      {amount.toFixed(8)}
                    </Text>
                    <Box
                      opacity={0.6}
                      _groupHover={{
                        opacity: 1,
                      }}
                      transition="opacity 0.2s"
                    >
                      <LuCopy
                        color="rgba(255, 255, 255, 0.8)"
                        size={20}
                        style={{
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                      />
                    </Box>
                    <Box transform="scale(0.7)" transformOrigin="left center">
                      <WebAssetTag asset="BTC" />
                    </Box>
                  </Flex>
                </Flex>
              </Flex>
            </Flex>
          ) : isSettled ? (
            // Show checkmark when settled
            <motion.div
              key="success"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              <img
                src="/images/txns/check.svg"
                alt="Success"
                style={{
                  width: "110px",
                  height: "110px",
                  filter: "drop-shadow(0 0 8px rgba(171, 125, 255, 0.1))",
                }}
              />
            </motion.div>
          ) : (
            // Show loading dots for steps 1-2
            <Flex
              direction="column"
              alignItems="center"
              justifyContent="center"
              marginTop="60px"
              gap="24px"
              zIndex={1}
            >
              <motion.div
                key="loading"
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      y: [0, -10, 0],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.2,
                    }}
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                    }}
                  />
                ))}
              </motion.div>

              {/* View User Deposit Transaction Button */}
              {depositTx && (
                <Flex
                  as="button"
                  onClick={handleViewTransaction}
                  alignItems="center"
                  justifyContent="center"
                  gap="8px"
                  px="18px"
                  mt="20px"
                  py="7px"
                  borderRadius="12px"
                  bg="rgba(255, 255, 255, 0.1)"
                  border="1px solid rgba(255, 255, 255, 0.2)"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{
                    bg: "rgba(255, 255, 255, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                  _active={{
                    transform: "scale(0.98)",
                  }}
                >
                  <Text
                    fontSize="11px"
                    color="rgba(255, 255, 255, 0.9)"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    letterSpacing="0.5px"
                  >
                    VIEW DEPOSIT TXN IN MEMPOOL
                  </Text>
                  <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
                </Flex>
              )}
            </Flex>
          )}
        </Box>

        {/* Bottom Half - Steps */}
        <Box
          h="45%"
          bottom="0px"
          position="absolute"
          padding="20px"
          w="100%"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="flex-start"
          overflow="hidden"
          borderRadius="0 0 40px 40px"
        >
          {/* Step Carousel */}
          <Box
            width="100%"
            height="auto"
            flex="1"
            display="flex"
            alignItems="flex-start"
            overflow="hidden"
            position="relative"
          >
            <StepCarousel
              isMobile={isMobile}
              currentStepIndex={validStepIndex}
              completedSteps={completedSteps}
              btcConfirmations={btcConfirmations}
              userDepositTx={depositTx}
              showFillingOrderWarning={showFillingOrderWarning}
            />

            {/* Action buttons that appear after swap completion */}
            <AnimatePresence>
              {showButtons && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                    zIndex: 4,
                  }}
                >
                  {/* Transaction ID Display */}
                  {getShortTxnId() && (
                    <Flex
                      mt="-100px"
                      mb="64px"
                      alignItems="center"
                      gap="8px"
                      bg="rgba(255, 255, 255, 0.1)"
                      borderRadius="12px"
                      padding="6px 12px"
                      border="1px solid rgba(255, 255, 255, 0.2)"
                      cursor="pointer"
                      onClick={handleCopyTxn}
                      _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                      transition="all 0.2s"
                    >
                      <Text
                        color="rgba(255, 255, 255, 0.8)"
                        fontFamily="Aux"
                        fontSize="12px"
                        fontWeight="normal"
                      >
                        TXN HASH - {getShortTxnId()}
                      </Text>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.6)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </Flex>
                  )}

                  {/* Button Row */}
                  <Flex gap="16px" mt="-52px" justifyContent="center">
                    {/* View Transaction Button */}
                    <Box
                      as="button"
                      onClick={handleViewMmTransaction}
                      border="2px solid #3F7244"
                      borderRadius="16px"
                      width={isMobile ? "140px" : "160px"}
                      background="rgba(2, 123, 30, 0.25)"
                      padding="8px 16px"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(127, 58, 12, 0.3)",
                      }}
                    >
                      <Text
                        color="white"
                        fontFamily="Nostromo"
                        fontSize="14px"
                        fontWeight="normal"
                        letterSpacing="0.5px"
                      >
                        VIEW TXN
                      </Text>
                    </Box>

                    {/* New Swap Button */}
                    <Box
                      as="button"
                      onClick={handleNewSwap}
                      borderRadius="16px"
                      width={isMobile ? "140px" : "160px"}
                      border="2px solid #6651B3"
                      background="rgba(86, 50, 168, 0.30)"
                      padding="8px 16px"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
                      }}
                    >
                      <Text
                        color="white"
                        fontFamily="Nostromo"
                        fontSize="14px"
                        fontWeight="normal"
                        letterSpacing="0.5px"
                      >
                        NEW SWAP
                      </Text>
                    </Box>
                  </Flex>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      </Box>

      {/* Warning/Status Text - Outside the main container */}
      {validStepIndex === 0 && (
        <Text
          marginTop="10px"
          fontSize={"12px"}
          color="rgba(255, 255, 255, 0.5)"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          textAlign="center"
          px={isMobile ? "20px" : "0"}
        >
          WARNING: Please send the exact amount above to complete the swap.
        </Text>
      )}
      {validStepIndex === 1 && (
        <Text
          fontSize={"12px"}
          marginTop="10px"
          color="rgba(255, 255, 255, 0.5)"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          textAlign="center"
          px={isMobile ? "20px" : "0"}
        >
          Estimated time remaining: ~20 minutes
        </Text>
      )}
      {validStepIndex === 2 && (
        <Text
          marginTop="10px"
          fontSize={"12px"}
          color="rgba(255, 255, 255, 0.5)"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          textAlign="center"
          px={isMobile ? "20px" : "0"}
        >
          Estimated time remaining: ~10 minutes
        </Text>
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
    </Flex>
  );
}
