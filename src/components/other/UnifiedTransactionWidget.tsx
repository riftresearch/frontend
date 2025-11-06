import React, { useState, useEffect, useRef } from "react";
import { Box, Text, Flex, Image } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy } from "react-icons/lu";
import { FiExternalLink } from "react-icons/fi";
import { CountdownTimer } from "./CountdownTimer";
import useWindowSize from "@/hooks/useWindowSize";
import { useStore } from "@/utils/store";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { motion, AnimatePresence } from "framer-motion";
import { toastSuccess, toastError } from "@/utils/toast";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import router from "next/router";
import { filterRefunds } from "@/utils/refundHelpers";
import { mapDbRowToAdminSwap, ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { AdminSwapItem } from "@/utils/types";
import { RefundModal } from "./RefundModal";
import { useRefundModal } from "@/hooks/useRefundModal";
import { esploraClient } from "@/utils/esploraClient";
import { useEvmConfirmations } from "@/hooks/useEvmConfirmations";
import WebAssetTag from "./WebAssetTag";
import { AssetIcon } from "./AssetIcon";

// Type guard to check if swap is Bitcoin deposit
type SwapType = "bitcoin-deposit" | "evm-deposit";

interface UnifiedTransactionWidgetProps {
  swapId?: string;
  // Bitcoin-specific props (optional, only for BTC->EVM swaps)
  bitcoinAddress?: string;
  bitcoinAmount?: number;
  bitcoinUri?: string;
  bitcoinDepositTx?: string;
}

// Swap details pill component
const SwapDetailsPill: React.FC<{
  inputAmount: string;
  inputAsset: string;
  inputAssetIconUrl?: string;
  outputAmount: string;
  outputAsset: string;
  isMobile: boolean;
  width?: string;
  fontSize?: string;
}> = ({
  inputAmount,
  inputAsset,
  inputAssetIconUrl,
  outputAmount,
  outputAsset,
  width,
  fontSize,
  isMobile,
}) => {
  return (
    <Flex
      bg="rgba(0, 0, 0, 0.6)"
      borderRadius="16px"
      width={width ? width : "null"}
      padding={isMobile ? "8px 16px" : "10px 18px"}
      alignItems="center"
      justifyContent="center"
      gap={isMobile ? "8px" : "10px"}
      backdropFilter="blur(12px)"
      border="1px solid rgba(255, 255, 255, 0.08)"
    >
      {/* Input Amount + Asset */}
      <Flex alignItems="center" gap="4px">
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "13px" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.offWhite}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {inputAmount}
        </Text>
        <AssetIcon asset={inputAsset} iconUrl={inputAssetIconUrl} size={16} />
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "13px" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {inputAsset}
        </Text>
      </Flex>

      {/* Arrow */}
      <Text
        fontSize={isMobile ? "14px" : "14px"}
        color="rgba(255, 255, 255, 0.4)"
        fontWeight="bold"
      >
        →
      </Text>

      {/* Output Amount + Asset */}
      <Flex alignItems="center" gap="4px">
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "13px" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.offWhite}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {outputAmount}
        </Text>
        <AssetIcon asset={outputAsset} size={16} />
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "13px" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {outputAsset}
        </Text>
      </Flex>
    </Flex>
  );
};

// Step configuration - dynamically determined based on swap type
const getSteps = (swapType: SwapType) => {
  if (swapType === "bitcoin-deposit") {
    return [
      {
        id: "1-WaitingUserDepositInitiated",
        label: "AWAITING DEPOSIT",
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
  } else {
    return [
      {
        id: "1-WaitingUserDepositInitiated",
        label: "AWAITING DEPOSIT",
        description: "Waiting for your ERC-20 deposit...",
      },
      {
        id: "2-WaitingUserDepositConfirmed",
        label: "CONFIRMING DEPOSIT",
        description: "Waiting for block confirmations...",
      },
      {
        id: "3-WaitingMMDepositInitiated",
        label: "FILLING ORDER",
        description: "Market makers are filling your order...",
      },
      {
        id: "4-WaitingMMDepositConfirmed",
        label: "SWAP COMPLETE",
        description: "Bitcoin is headed your way!",
      },
    ];
  }
};

function StepCarousel({
  swapId,
  swapType,
  evmConfirmations,
  btcConfirmations,
  mmDepositChain,
  userDepositTx,
  showFillingOrderWarning,
  onNewSwap,
}: {
  swapId?: string;
  swapType: SwapType;
  evmConfirmations: number;
  btcConfirmations: number;
  mmDepositChain?: string;
  userDepositTx?: string;
  showFillingOrderWarning: boolean;
  onNewSwap: () => void;
}) {
  const depositFlowState = useStore((state) => state.depositFlowState);
  const swapResponse = useStore((state) => state.swapResponse);
  const { isMobile } = useWindowSize();

  // Use provided swapId prop, fallback to store value
  const currentSwapId = swapId || swapResponse?.swap_id;
  const { data: swapStatusInfo } = useSwapStatus(currentSwapId);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [slideOffset, setSlideOffset] = useState(0);
  const [previousStepIndex, setPreviousStepIndex] = useState(-1);
  const [showButtons, setShowButtons] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const steps = getSteps(swapType);

  // Check if we're in the settled state (step 4 or 5)
  const isSettled =
    depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled";

  // Find current step index
  const isSettledStatus = depositFlowState === "5-Settled";
  const currentStepIndex = isSettledStatus
    ? 3
    : steps.findIndex((step) => step.id === depositFlowState);

  // Initialize carousel state based on current step (for direct page loads)
  useEffect(() => {
    if (currentStepIndex !== -1 && !isInitialized) {
      // Set completed steps for all steps before the current one
      const completedStepIds = new Set<string>();
      for (let i = 0; i < currentStepIndex; i++) {
        completedStepIds.add(steps[i].id);
      }

      // If we're on the settled step, mark it as completed too
      if (isSettled) {
        completedStepIds.add(steps[currentStepIndex].id);
        setShowButtons(true);
      }

      setCompletedSteps(completedStepIds);
      setSlideOffset(-currentStepIndex * 86);
      setIsInitialized(true);
      setPreviousStepIndex(currentStepIndex);
    }
  }, [currentStepIndex, isInitialized, isSettled, steps]);

  // Handle step transitions
  useEffect(() => {
    if (
      isInitialized &&
      currentStepIndex !== previousStepIndex &&
      previousStepIndex >= 0 &&
      currentStepIndex !== -1
    ) {
      const stepDifference = currentStepIndex - previousStepIndex;

      // Handle forward progression
      if (stepDifference > 0) {
        const newCompletedSteps = new Set(completedSteps);
        for (let i = previousStepIndex; i < currentStepIndex; i++) {
          newCompletedSteps.add(steps[i].id);
        }
        setCompletedSteps(newCompletedSteps);

        setTimeout(() => {
          setSlideOffset(-currentStepIndex * 86);

          if (isSettled) {
            setTimeout(() => {
              setCompletedSteps((prev) => new Set([...prev, steps[currentStepIndex].id]));
              setTimeout(() => {
                setShowButtons(true);
              }, 500);
            }, 800);
          }
        }, 500);
      }
      // Handle backward progression
      else if (stepDifference < 0) {
        const newCompletedSteps = new Set(completedSteps);
        for (let i = currentStepIndex + 1; i < steps.length; i++) {
          newCompletedSteps.delete(steps[i].id);
        }
        setCompletedSteps(newCompletedSteps);
        setShowButtons(false);
        setSlideOffset(-currentStepIndex * 86);
      }
    }
    setPreviousStepIndex(currentStepIndex);
  }, [currentStepIndex, previousStepIndex, isInitialized, completedSteps, isSettled, steps]);

  if (currentStepIndex === -1) return null;

  const handleViewTransaction = () => {
    const txnId = swapStatusInfo?.mm_deposit_status?.tx_hash;
    const chain = swapStatusInfo?.quote?.to_chain;

    if (txnId) {
      if (chain === "bitcoin") {
        window.open(`https://mempool.space/tx/${txnId}`, "_blank");
      } else if (chain === "ethereum") {
        window.open(`https://etherscan.io/tx/${txnId}`, "_blank");
      } else if (chain === "base") {
        window.open(`https://basescan.org/tx/${txnId}`, "_blank");
      } else {
        window.open(`https://etherscan.io/tx/${txnId}`, "_blank");
      }
    }
  };

  const handleCopyTxn = async () => {
    const txnId = swapStatusInfo?.mm_deposit_status?.tx_hash;
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
    const txnId = swapStatusInfo?.mm_deposit_status?.tx_hash;
    if (!txnId) return "";
    return isMobile
      ? `${txnId.slice(0, 6)}...${txnId.slice(-6)}`
      : `${txnId.slice(0, 12)}...${txnId.slice(-12)}`;
  };

  const handleNewSwap = () => {
    onNewSwap();
  };

  return (
    <Box position="relative" width="100%" height="100%" overflow="hidden">
      <motion.div
        animate={{
          y: slideOffset,
          paddingTop: isSettled ? "0px" : "10px",
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const positionFromTop = index + slideOffset / 86;
          const isCurrent = Math.abs(positionFromTop) < 0.1;

          // Dynamic description based on step and confirmations
          let stepDescription = step.description;

          // Step 2: Confirmation tracking based on swap type
          if (step.id === "2-WaitingUserDepositConfirmed" && isCurrent) {
            if (swapType === "bitcoin-deposit") {
              const requiredConfs = 2; // BTC->EVM needs 2 confirmations
              const currentConfs = Math.min(btcConfirmations, requiredConfs);
              stepDescription = `Confirming... ${currentConfs}/${requiredConfs} confirmations`;
            } else {
              const requiredConfs = 4; // EVM->BTC needs 4 confirmations
              const currentConfs = Math.min(evmConfirmations, requiredConfs);
              stepDescription = `Confirming... ${currentConfs}/${requiredConfs} confirmations`;
            }
          }

          // Step 3: Filling order warning
          if (step.id === "3-WaitingMMDepositInitiated" && showFillingOrderWarning) {
            stepDescription =
              "Market makers are taking longer than usual to fill your order... if not filled within 1 hour, your order will be refunded";
          }

          // Step 4: MM deposit confirmation (for BTC deposits from MM)
          // Only show confirmation count if NOT settled yet
          if (
            step.id === "4-WaitingMMDepositConfirmed" &&
            isCurrent &&
            mmDepositChain === "bitcoin" &&
            !isSettled
          ) {
            const requiredConfs = 4; // Bitcoin needs 4 confirmations for EVM->BTC swaps
            const currentConfs = Math.min(btcConfirmations, requiredConfs);
            stepDescription = `Confirming... ${currentConfs}/${requiredConfs} confirmations`;
          }

          const opacity =
            positionFromTop < 0
              ? 0
              : positionFromTop < 0.1
                ? 1
                : positionFromTop < 1.1
                  ? 0.4
                  : positionFromTop < 3
                    ? Math.max(0.1, 0.3 - (positionFromTop - 1) * 0.1)
                    : 0;

          return (
            <motion.div
              key={step.id}
              style={{
                height: "86px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
              animate={{ opacity }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Flex direction="column" alignItems="center" justifyContent="center">
                <Flex alignItems="center" justifyContent="center" gap="12px">
                  <Box
                    width="24px"
                    height="24px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {index === currentStepIndex && !isCompleted ? (
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
                      fontSize: isCurrent ? "20px" : "18px",
                    }}
                    animate={{
                      color: isCurrent ? "white" : "rgba(255,255,255,0.6)",
                      fontSize: isCurrent ? "20px" : "18px",
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <Text fontFamily="Nostromo" fontWeight="bold" letterSpacing="1px">
                      {step.label}
                    </Text>
                  </motion.div>
                </Flex>

                <motion.div
                  initial={{ opacity: isCurrent ? 1 : 0 }}
                  animate={{ opacity: isCurrent ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ textAlign: "center" }}
                >
                  <Text
                    color="rgba(255,255,255,0.7)"
                    fontSize="13px"
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

      {/* Action buttons after completion */}
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
            {getShortTxnId() && (
              <Flex
                mt="-106px"
                mb="70px"
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

            <Flex gap="16px" mt="-55px" justifyContent="center">
              <Box
                as="button"
                onClick={handleViewTransaction}
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
  );
}

export function UnifiedTransactionWidget({
  swapId,
  bitcoinAddress,
  bitcoinAmount,
  bitcoinUri,
  bitcoinDepositTx,
}: UnifiedTransactionWidgetProps) {
  const { isMobile } = useWindowSize();
  const {
    setTransactionConfirmed,
    setSwapResponse,
    setFeeOverview,
    depositFlowState,
    countdownValue,
    swapResponse,
  } = useStore();

  // Sound effect for swap completion
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousDepositFlowStateRef = useRef<string | null>(null);

  // Use provided swapId prop, fallback to store value
  const currentSwapId = swapId || swapResponse?.swap_id;
  const { data: swapStatusInfo } = useSwapStatus(currentSwapId);

  // Handle navigation to new swap with state reset
  const handleNewSwap = () => {
    setTransactionConfirmed(false);
    setSwapResponse(null);
    setFeeOverview(null);
    router.push("/");
  };

  // Determine swap type based on props and swap data
  const swapType: SwapType = React.useMemo(() => {
    if (bitcoinAddress || swapStatusInfo?.quote?.from_chain === "bitcoin") {
      return "bitcoin-deposit";
    }
    return "evm-deposit";
  }, [bitcoinAddress, swapStatusInfo?.quote?.from_chain]);

  // Log raw swap data
  React.useEffect(() => {
    if (swapStatusInfo) {
      console.log(`[UnifiedTransactionWidget] Swap type: ${swapType}`, swapStatusInfo);
    }
  }, [swapStatusInfo, swapType]);

  const isSettled =
    depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled";
  const showLoadingDots = countdownValue === 0 && !isSettled;

  const steps = getSteps(swapType);
  const isSettledStatus = depositFlowState === "5-Settled";
  const currentStepIndex = isSettledStatus
    ? 3
    : steps.findIndex((step) => step.id === depositFlowState);
  const validStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  const [isRefundAvailable, setIsRefundAvailable] = React.useState(false);
  const [failedSwapData, setFailedSwapData] = React.useState<AdminSwapItem | null>(null);
  const [isSwapRefunded, setIsSwapRefunded] = React.useState(false);
  const [showFillingOrderWarning, setShowFillingOrderWarning] = React.useState(false);

  // Track EVM confirmations for user deposit (for EVM deposits)
  const userDepositTxHash = swapStatusInfo?.user_deposit_status?.tx_hash;
  const userDepositChain = swapStatusInfo?.quote?.from_chain;
  const userChainId =
    userDepositChain === "ethereum" ? 1 : userDepositChain === "base" ? 8453 : undefined;
  const evmConfirmations = useEvmConfirmations(
    swapType === "evm-deposit" ? userDepositTxHash : undefined,
    userChainId,
    depositFlowState === "2-WaitingUserDepositConfirmed"
  );

  // Track BTC confirmations
  const [btcConfirmations, setBtcConfirmations] = React.useState<number>(0);

  // Play sound effect when swap completes
  useEffect(() => {
    console.log("Deposit Flow State Change:", {
      previous: previousDepositFlowStateRef.current,
      current: depositFlowState,
      audioRefExists: !!audioRef.current,
    });

    // Transition from "FILLING ORDER" to "SWAP COMPLETE"
    if (
      previousDepositFlowStateRef.current === "3-WaitingMMDepositInitiated" &&
      (depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled") &&
      audioRef.current
    ) {
      console.log("🔊 Playing swap completion sound!");
      audioRef.current.play().catch((error) => {
        console.log("Failed to play swap completion sound:", error);
      });
    }

    // Update the previous state for next comparison
    previousDepositFlowStateRef.current = depositFlowState;
  }, [depositFlowState]);

  // Check if swap expired (for Bitcoin deposits only)
  const isExpired = React.useMemo(() => {
    if (swapType !== "bitcoin-deposit" || validStepIndex !== 0 || !swapStatusInfo?.created_at)
      return false;

    const createdAt = new Date(swapStatusInfo.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceCreation > 12;
  }, [swapType, validStepIndex, swapStatusInfo?.created_at]);

  // Check if stuck on "FILLING ORDER"
  useEffect(() => {
    if (depositFlowState !== "3-WaitingMMDepositInitiated") {
      setShowFillingOrderWarning(false);
      return;
    }

    const swapCreatedAt = swapStatusInfo?.created_at;
    if (!swapCreatedAt) return;

    const checkTimer = () => {
      const createdTime = new Date(swapCreatedAt);
      const now = new Date();
      const minutesSinceCreated = (now.getTime() - createdTime.getTime()) / (1000 * 60);

      if (minutesSinceCreated >= 10) {
        setShowFillingOrderWarning(true);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 30000);

    return () => clearInterval(interval);
  }, [depositFlowState, swapStatusInfo?.created_at]);

  // Poll for Bitcoin confirmations
  useEffect(() => {
    // For Bitcoin deposits: track user deposit confirmations during step 2
    // For EVM deposits: track MM deposit confirmations during step 4 (if MM deposits BTC)
    const shouldTrackBtc =
      (swapType === "bitcoin-deposit" && depositFlowState === "2-WaitingUserDepositConfirmed") ||
      (swapType === "evm-deposit" &&
        (depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled") &&
        swapStatusInfo?.quote?.to_chain === "bitcoin");

    if (!shouldTrackBtc) {
      setBtcConfirmations(0);
      return;
    }

    const txHash =
      swapType === "bitcoin-deposit"
        ? userDepositTxHash || bitcoinDepositTx
        : swapStatusInfo?.mm_deposit_status?.tx_hash;

    if (!txHash) {
      setBtcConfirmations(0);
      return;
    }

    let isCancelled = false;

    async function fetchConfirmations() {
      try {
        const confirmations = await esploraClient.getConfirmations(txHash as string);
        if (!isCancelled) {
          setBtcConfirmations(confirmations);
          console.log(`[BTC CONFIRMATIONS] ${txHash}: ${confirmations} confirmations`);
        }
      } catch (error) {
        console.error("Error fetching BTC confirmations:", error);
      }
    }

    fetchConfirmations();
    const interval = setInterval(fetchConfirmations, 30000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [
    swapType,
    depositFlowState,
    userDepositTxHash,
    bitcoinDepositTx,
    swapStatusInfo?.mm_deposit_status?.tx_hash,
    swapStatusInfo?.quote?.to_chain,
  ]);

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

  // Check refund eligibility
  React.useEffect(() => {
    async function checkRefundEligibility() {
      if (!currentSwapId || validStepIndex !== 2) {
        setIsRefundAvailable(false);
        return;
      }

      try {
        const url = `${ANALYTICS_API_URL}/api/swap/${currentSwapId}`;
        const response = await fetch(url);

        if (!response.ok) {
          setIsRefundAvailable(false);
          return;
        }

        const data = await response.json();
        let row = data.swap || data;

        // Calculate refund availability if not present
        if (row.isRefundAvailable === undefined && row.is_refund_available === undefined) {
          const status = row.status;
          const userDepositConfirmedAt = row.user_deposit?.deposit_confirmed_at;
          const mmDepositInitiatedAt = row.mm_deposit?.deposit_detected_at;

          // Case 1: MM never initiated deposit (>1 hour)
          if (status === "WaitingMMDepositInitiated" && userDepositConfirmedAt) {
            const userDepositTime = new Date(userDepositConfirmedAt);
            const now = new Date();
            const hoursSinceUserDeposit =
              (now.getTime() - userDepositTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceUserDeposit >= 1) {
              row.isRefundAvailable = true;
            }
          }

          // Case 2: MM deposit never confirmed (>24 hours)
          if (status === "WaitingMMDepositConfirmed" && mmDepositInitiatedAt) {
            const mmDepositTime = new Date(mmDepositInitiatedAt);
            const now = new Date();
            const hoursSinceMMDeposit =
              (now.getTime() - mmDepositTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceMMDeposit >= 24) {
              row.isRefundAvailable = true;
            }
          }
        }

        let mappedSwap = mapDbRowToAdminSwap(row);
        const { isRefundAvailable: refundAvailable, shouldMarkAsRefunded } = await filterRefunds(
          row,
          mappedSwap
        );

        // Modify flow if refunded
        if (shouldMarkAsRefunded && mappedSwap.flow.length > 0) {
          const inProgressIndex = mappedSwap.flow.findIndex((s) => s.state === "inProgress");

          if (inProgressIndex !== -1) {
            const stepsBeforeFailed = mappedSwap.flow.slice(0, inProgressIndex);
            const failedStep = mappedSwap.flow[inProgressIndex];
            failedStep.state = "completed";

            mappedSwap.flow = [
              ...stepsBeforeFailed,
              failedStep,
              {
                status: "user_refunded_detected" as any,
                label: "Refunded",
                state: "completed",
              },
            ];
          }
        }

        // Check if refunded
        const currentStep =
          mappedSwap.flow.find((s) => s.state === "inProgress") ||
          mappedSwap.flow[mappedSwap.flow.length - 1];
        const isSwapRefunded =
          currentStep?.status === "refunding_user" ||
          currentStep?.status === "refunding_mm" ||
          currentStep?.status === "user_refunded_detected";

        setIsSwapRefunded(isSwapRefunded);

        if (refundAvailable) {
          setIsRefundAvailable(true);
          setFailedSwapData(mappedSwap);
        } else if (shouldMarkAsRefunded) {
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

  // Format amounts
  const formatAmount = (amount: string | number | undefined, decimals: number): string => {
    if (!amount) return "0";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    const decimalPlaces = decimals === 8 ? 8 : Math.min(decimals, 6);
    return numAmount.toFixed(decimalPlaces).replace(/\.?0+$/, "");
  };

  // Get swap amounts
  // Note: inputAmountFromMetadata is calculated after getInputAssetFromMetadata() below
  // This variable will be reassigned after metadata parsing
  let inputAmount = formatAmount(
    swapStatusInfo?.quote?.from_amount
      ? parseInt(swapStatusInfo.quote.from_amount) /
          Math.pow(10, swapStatusInfo.quote.from_decimals)
      : swapType === "bitcoin-deposit"
        ? bitcoinAmount
        : undefined,
    swapStatusInfo?.quote?.from_decimals || (swapType === "bitcoin-deposit" ? 8 : 18)
  );

  const getAssetSymbol = (tokenAddress: string | undefined, defaultSymbol: string): string => {
    if (!tokenAddress) return defaultSymbol;
    if (tokenAddress === "0x0000000000000000000000000000000000000000") return "ETH";

    const tokenMap: Record<string, string> = {
      "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf": "cbBTC",
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "WBTC",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
    };

    return tokenMap[tokenAddress] || "ERC20";
  };

  // Parse start_asset from metadata
  // New format (JSON): {"ticker":"USDC","address":"0x...","icon":"https://...","amount":"123.45","decimals":6}
  // Legacy format (colon-separated): "TICKER:ADDRESS:ICON_URL"
  const getInputAssetFromMetadata = (): {
    ticker: string;
    iconUrl?: string;
    amount?: string;
    decimals?: number;
  } => {
    const startAsset = swapStatusInfo?.metadata?.start_asset;
    if (!startAsset || typeof startAsset !== "string") {
      return { ticker: "" };
    }

    // Try parsing as JSON first (new format)
    try {
      const parsed = JSON.parse(startAsset);
      // console.log("parsed input asset", parsed);
      if (parsed && typeof parsed === "object") {
        return {
          ticker: parsed.ticker || "",
          iconUrl: parsed.icon,
          amount: parsed.amount,
          decimals: parsed.decimals,
        };
      }
    } catch (e) {
      // Not JSON, try legacy format
      const parts = startAsset.split(":");
      if (parts.length >= 1 && parts[0]) {
        return {
          ticker: parts[0], // Return the ticker (e.g., "USDC", "WETH", etc.)
          iconUrl: parts.length >= 3 ? parts[2] : undefined, // Return icon URL if available
        };
      }
    }

    return { ticker: "" };
  };

  const inputAssetMetadata = getInputAssetFromMetadata();

  // For EVM deposits, prioritize metadata, then fallback to token address lookup
  // Don't use "ETH" as default to avoid showing wrong icon while loading
  const inputAsset =
    swapType === "bitcoin-deposit"
      ? "BTC"
      : inputAssetMetadata.ticker ||
        (swapStatusInfo?.quote?.from_token?.address
          ? getAssetSymbol(swapStatusInfo.quote.from_token.address, "")
          : "");

  // For icon URL, use metadata if available, otherwise don't provide one
  // This prevents showing wrong icon while data loads
  const inputAssetIconUrl = swapType === "bitcoin-deposit" ? undefined : inputAssetMetadata.iconUrl;

  // For input amount, prioritize metadata amount (human-readable) over quote amount (raw)
  // If metadata has amount, use it directly; otherwise keep the calculated amount from quote
  if (swapType === "evm-deposit" && inputAssetMetadata.amount) {
    inputAmount = formatAmount(inputAssetMetadata.amount, inputAssetMetadata.decimals || 18);
  }

  const outputAmount = formatAmount(
    swapStatusInfo?.quote?.to_amount
      ? parseInt(swapStatusInfo.quote.to_amount) / Math.pow(10, swapStatusInfo.quote.to_decimals)
      : undefined,
    swapStatusInfo?.quote?.to_decimals || (swapType === "bitcoin-deposit" ? 18 : 8)
  );

  const outputAsset =
    swapType === "bitcoin-deposit"
      ? getAssetSymbol(swapStatusInfo?.quote?.to_token?.address, "cbBTC")
      : "BTC";

  const handleViewUserTransaction = () => {
    const txnId = swapStatusInfo?.user_deposit_status?.tx_hash;
    const chain = swapStatusInfo?.quote?.from_chain;

    if (txnId) {
      if (chain === "bitcoin") {
        window.open(`https://mempool.space/tx/${txnId}`, "_blank");
      } else if (chain === "ethereum") {
        const txHash = txnId.startsWith("0x") ? txnId : `0x${txnId}`;
        window.open(`https://etherscan.io/tx/${txHash}`, "_blank");
      } else if (chain === "base") {
        const txHash = txnId.startsWith("0x") ? txnId : `0x${txnId}`;
        window.open(`https://basescan.org/tx/${txHash}`, "_blank");
      } else {
        const txHash = txnId.startsWith("0x") ? txnId : `0x${txnId}`;
        window.open(`https://etherscan.io/tx/${txHash}`, "_blank");
      }
    }
  };

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

  // REFUNDED VIEW
  if (isSwapRefunded) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        <Box mt="20px">
          <SwapDetailsPill
            inputAmount={inputAmount}
            inputAsset={inputAsset}
            inputAssetIconUrl={inputAssetIconUrl}
            outputAmount={outputAmount}
            outputAsset={outputAsset}
            isMobile={isMobile}
          />
        </Box>

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

            <Flex
              gap="16px"
              justifyContent="center"
              flexWrap="wrap"
              direction={isMobile ? "column" : "row"}
              alignItems="center"
            >
              <Box
                as="button"
                onClick={() => router.push("/history")}
                border="2px solid rgba(255, 255, 255, 0.3)"
                borderRadius="16px"
                width={isMobile ? "240px" : "180px"}
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

              <Box
                as="button"
                onClick={handleNewSwap}
                borderRadius="16px"
                width={isMobile ? "240px" : "180px"}
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

  // REFUND AVAILABLE VIEW
  if (isRefundAvailable) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        <Box mt="20px">
          <SwapDetailsPill
            inputAmount={inputAmount}
            inputAsset={inputAsset}
            inputAssetIconUrl={inputAssetIconUrl}
            outputAmount={outputAmount}
            outputAsset={outputAsset}
            isMobile={isMobile}
          />
        </Box>

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

            <Flex
              gap="16px"
              justifyContent="center"
              flexWrap="wrap"
              direction={isMobile ? "column" : "row"}
              alignItems="center"
            >
              {swapStatusInfo?.user_deposit_status?.tx_hash && (
                <Box
                  as="button"
                  onClick={handleViewUserTransaction}
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
      </Flex>
    );
  }

  // EXPIRED VIEW (Bitcoin deposits only)
  if (isExpired && swapType === "bitcoin-deposit" && bitcoinAddress) {
    return (
      <Flex direction="column" alignItems="center" gap="20px">
        <Box mt="20px">
          <SwapDetailsPill
            inputAmount={inputAmount}
            inputAsset={inputAsset}
            inputAssetIconUrl={inputAssetIconUrl}
            outputAmount={outputAmount}
            outputAsset={outputAsset}
            isMobile={isMobile}
          />
        </Box>

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
          <Flex direction="column" alignItems="center" gap="16px" zIndex={1}>
            <Text
              fontSize="24px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              letterSpacing="1px"
            >
              SWAP EXPIRED
            </Text>

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
                <LuCopy color="rgba(251, 191, 36, 0.9)" size={14} />
              </Flex>
            )}
          </Flex>

          <Flex gap="16px" justifyContent="center" flexWrap="wrap">
            {bitcoinDepositTx && (
              <Box
                as="button"
                onClick={() =>
                  window.open(`https://mempool.space/tx/${bitcoinDepositTx}`, "_blank")
                }
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

  // NORMAL SWAP VIEW
  return (
    <Flex direction="column" alignItems="center" w="100%">
      {/* Swap Details Pill - mobile: above widget, desktop: inside widget */}
      {!(swapType === "bitcoin-deposit" && validStepIndex === 0 && bitcoinAddress && bitcoinUri) &&
        isMobile && (
          <Box mb="-50px" pt="16%" w="100%" display="flex" justifyContent="center" zIndex={2}>
            <SwapDetailsPill
              width="100%"
              fontSize="4vw"
              inputAmount={inputAmount}
              inputAsset={inputAsset}
              inputAssetIconUrl={inputAssetIconUrl}
              outputAmount={outputAmount}
              outputAsset={outputAsset}
              isMobile={isMobile}
            />
          </Box>
        )}

      <Box
        w={isMobile ? "100%" : "805px"}
        h={isMobile && swapType === "bitcoin-deposit" ? "600px" : "510px"}
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
        <Box
          w="100%"
          h={swapType === "bitcoin-deposit" ? "54%" : "50%"}
          borderRadius="40px"
          position="absolute"
          top="0px"
          background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
          display="flex"
          flexDirection="column"
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
          {/* Swap Details Pill - hide when showing Bitcoin QR code, show only on desktop (mobile version is above widget) */}
          {!(
            swapType === "bitcoin-deposit" &&
            validStepIndex === 0 &&
            bitcoinAddress &&
            bitcoinUri
          ) &&
            !isMobile && (
              <Box position="absolute" top="20px" zIndex={2}>
                <SwapDetailsPill
                  inputAmount={inputAmount}
                  inputAsset={inputAsset}
                  inputAssetIconUrl={inputAssetIconUrl}
                  outputAmount={outputAmount}
                  outputAsset={outputAsset}
                  isMobile={isMobile}
                />
              </Box>
            )}

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
              width: swapType === "bitcoin-deposit" ? "40px" : "60px",
              height: swapType === "bitcoin-deposit" ? "40px" : "60px",
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
              width: swapType === "bitcoin-deposit" ? "40px" : "60px",
              height: swapType === "bitcoin-deposit" ? "40px" : "60px",
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

          {/* Conditional Top Half Content */}
          {swapType === "bitcoin-deposit" &&
          validStepIndex === 0 &&
          bitcoinAddress &&
          bitcoinUri ? (
            // Bitcoin QR Code View
            <Flex
              direction={isMobile ? "column" : "row"}
              align="center"
              justify="center"
              gap={isMobile ? "20px" : "40px"}
              zIndex={1}
              px={isMobile ? "20px" : "100px"}
            >
              <Flex
                py="10px"
                px="12px"
                borderRadius="12px"
                bg="white"
                boxShadow="0px 8px 20px rgba(0, 16, 118, 0.3)"
                justify="center"
                align="center"
                flexShrink={0}
              >
                <QRCodeSVG value={bitcoinUri} size={isMobile ? 100 : 160} />
              </Flex>

              <Flex
                direction="column"
                gap={isMobile ? "16px" : "24px"}
                flex="1"
                maxW={isMobile ? "92%" : "500px"}
              >
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
                    onClick={() => copyToClipboard(bitcoinAddress, "Bitcoin Address")}
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
                      {bitcoinAddress}
                    </Text>
                    <Box
                      opacity={0.6}
                      _groupHover={{ opacity: 1 }}
                      transition="opacity 0.2s"
                      mb="2px"
                    >
                      <LuCopy color="rgba(255, 255, 255, 0.8)" size={20} />
                    </Box>
                  </Flex>
                </Flex>

                {bitcoinAmount !== undefined && (
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
                      onClick={() => copyToClipboard(bitcoinAmount.toFixed(8), "Bitcoin Amount")}
                    >
                      <Text
                        color={colors.offWhite}
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        fontSize={isMobile ? "18px" : "26px"}
                        letterSpacing={isMobile ? "-1.2px" : "-1.8px"}
                        fontWeight="500"
                      >
                        {bitcoinAmount.toFixed(8)}
                      </Text>
                      <Box opacity={0.6} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                        <LuCopy color="rgba(255, 255, 255, 0.8)" size={20} />
                      </Box>
                      <Box transform="scale(0.7)" transformOrigin="left center">
                        <WebAssetTag asset="BTC" />
                      </Box>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </Flex>
          ) : swapType === "bitcoin-deposit" && validStepIndex > 0 && bitcoinDepositTx ? (
            // Bitcoin deposit in progress - show loading or checkmark
            <Flex
              direction="column"
              alignItems="center"
              justifyContent="center"
              marginTop={isMobile ? "20px" : "100px"}
              gap="24px"
              zIndex={1}
            >
              {isSettled ? (
                <motion.div
                  key="success"
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: isMobile ? "-10px" : "0",
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
                <>
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
                          width: isMobile ? "16.8px" : "12px",
                          height: isMobile ? "16.8px" : "12px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
                        }}
                      />
                    ))}
                  </motion.div>

                  {!isMobile && (
                    <Flex
                      as="button"
                      onClick={() =>
                        window.open(`https://mempool.space/tx/${bitcoinDepositTx}`, "_blank")
                      }
                      alignItems="center"
                      justifyContent="center"
                      gap="8px"
                      px="18px"
                      mt="40px"
                      py="7px"
                      borderRadius="19px"
                      bg="rgba(255, 255, 255, 0.1)"
                      border="1px solid rgba(255, 255, 255, 0.2)"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                      _active={{ transform: "scale(0.98)" }}
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
                </>
              )}
            </Flex>
          ) : (
            // EVM deposit view
            <AnimatePresence mode="wait">
              {countdownValue > 0 && !isSettled ? (
                <motion.div
                  key="countdown"
                  initial={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ marginTop: "30px" }}
                >
                  <CountdownTimer
                    onComplete={() => {
                      console.log("Countdown completed");
                    }}
                  />
                </motion.div>
              ) : showLoadingDots ? (
                <Flex
                  direction="column"
                  alignItems="center"
                  justifyContent="center"
                  marginTop={isMobile ? "20px" : "100px"}
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
                          width: isMobile ? "16.8px" : "12px",
                          height: isMobile ? "16.8px" : "12px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
                        }}
                      />
                    ))}
                  </motion.div>

                  {userDepositTxHash && !isMobile && (
                    <Flex
                      as="button"
                      onClick={handleViewUserTransaction}
                      alignItems="center"
                      justifyContent="center"
                      gap="8px"
                      px="18px"
                      mt="40px"
                      py="7px"
                      borderRadius="19px"
                      bg="rgba(255, 255, 255, 0.1)"
                      border="1px solid rgba(255, 255, 255, 0.2)"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                      _active={{ transform: "scale(0.98)" }}
                    >
                      <Text
                        fontSize="11px"
                        color="rgba(255, 255, 255, 0.9)"
                        fontFamily={FONT_FAMILIES.NOSTROMO}
                        letterSpacing="0.5px"
                      >
                        VIEW DEPOSIT TXN
                      </Text>
                      <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
                    </Flex>
                  )}
                </Flex>
              ) : (
                <motion.div
                  key="success"
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: isMobile ? "0px" : "30px",
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
              )}
            </AnimatePresence>
          )}
        </Box>

        {/* Bottom Half - Steps */}
        <Box
          h={swapType === "bitcoin-deposit" ? "45%" : "50%"}
          bottom="0px"
          position="absolute"
          padding="20px"
          w="100%"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <StepCarousel
            swapId={currentSwapId}
            swapType={swapType}
            evmConfirmations={evmConfirmations}
            btcConfirmations={btcConfirmations}
            mmDepositChain={swapStatusInfo?.quote?.to_chain}
            userDepositTx={bitcoinDepositTx || userDepositTxHash}
            showFillingOrderWarning={showFillingOrderWarning}
            onNewSwap={handleNewSwap}
          />
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
      </Box>

      {/* Mobile: View Deposit Transaction Button below widget */}
      {isMobile &&
        !isSettled &&
        ((swapType === "bitcoin-deposit" && validStepIndex > 0 && bitcoinDepositTx) ||
          (swapType === "evm-deposit" && userDepositTxHash && showLoadingDots)) && (
          <Box mt="30px" mb="-90px" w="100%" display="flex" justifyContent="center">
            <Flex
              as="button"
              onClick={
                swapType === "bitcoin-deposit"
                  ? () => window.open(`https://mempool.space/tx/${bitcoinDepositTx}`, "_blank")
                  : handleViewUserTransaction
              }
              alignItems="center"
              justifyContent="center"
              gap="8px"
              px="20px"
              py="10px"
              borderRadius="19px"
              bg="rgba(255, 255, 255, 0.1)"
              border="1px solid rgba(255, 255, 255, 0.2)"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                bg: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
              _active={{ transform: "scale(0.98)" }}
            >
              <Text
                fontSize="13px"
                color="rgba(255, 255, 255, 0.9)"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                letterSpacing="0.5px"
              >
                {swapType === "bitcoin-deposit"
                  ? "VIEW DEPOSIT TXN IN MEMPOOL"
                  : "VIEW DEPOSIT TXN"}
              </Text>
              <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
            </Flex>
          </Box>
        )}

      {/* Hidden audio element for swap completion sound */}
      <audio ref={audioRef} src="/assets/swap_sfx.wav" preload="auto" />

      {/* Test button for sound effect - REMOVE IN PRODUCTION */}
      <Box
        as="button"
        onClick={() => {
          if (audioRef.current) {
            audioRef.current.play().catch((error) => {
              console.error("Failed to play test sound:", error);
            });
          } else {
            console.log("Audio ref not found");
          }
        }}
        position="fixed"
        bottom="20px"
        right="20px"
        bg="purple.500"
        color="white"
        px="4"
        py="2"
        borderRadius="md"
        fontSize="sm"
        fontWeight="bold"
        _hover={{ bg: "purple.600" }}
        zIndex={9999}
      >
        Test Sound 🔊
      </Box>
    </Flex>
  );
}
