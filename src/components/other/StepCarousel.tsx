import React, { useState, useEffect } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/utils/store";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import useWindowSize from "@/hooks/useWindowSize";
import { toastSuccess, toastError } from "@/utils/toast";

// Type guard to check if swap is Bitcoin deposit
type SwapType = "bitcoin-deposit" | "evm-deposit";

interface StepCarouselProps {
  swapId?: string;
  swapType: SwapType;
  evmConfirmations: number;
  btcConfirmations: number;
  mmDepositChain?: string;
  userDepositTx?: string;
  showFillingOrderWarning: boolean;
  marginTopCustom?: string;
  paddingBottomCustom?: string;
  paddingTopCustom?: string;
  onNewSwap: () => void;
  onViewUserDeposit: () => void;
}

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

export function StepCarousel({
  swapId,
  swapType,
  evmConfirmations,
  btcConfirmations,
  mmDepositChain,
  marginTopCustom,
  paddingBottomCustom,
  paddingTopCustom,
  userDepositTx,
  showFillingOrderWarning,
  onNewSwap,
  onViewUserDeposit,
}: StepCarouselProps) {
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
      console.log("[StepCarousel] 🔵 INITIALIZING - Before setting completed steps:", {
        currentStepIndex,
        depositFlowState,
        isSettled,
        stepsLength: steps.length,
      });

      // Set completed steps for all steps before the current one
      const completedStepIds = new Set<string>();
      for (let i = 0; i < currentStepIndex; i++) {
        console.log(`[StepCarousel] 🔵 Marking step ${i} (${steps[i].id}) as completed`);
        completedStepIds.add(steps[i].id);
      }

      // If we're on the settled step, mark it as completed too
      if (isSettled) {
        console.log(
          `[StepCarousel] 🔵 Marking current step ${currentStepIndex} (${steps[currentStepIndex].id}) as completed (settled)`
        );
        completedStepIds.add(steps[currentStepIndex].id);
        setShowButtons(true);
      }

      console.log("[StepCarousel] 🔵 INITIALIZED carousel:", {
        currentStepIndex,
        isSettled,
        completedStepIds: Array.from(completedStepIds),
        currentStepId: steps[currentStepIndex]?.id,
        depositFlowState,
      });

      setCompletedSteps(completedStepIds);
      setSlideOffset(-currentStepIndex * 86);
      setIsInitialized(true);
      setPreviousStepIndex(currentStepIndex);
    }
  }, [currentStepIndex, isInitialized, isSettled, steps, depositFlowState]);

  // Handle step transitions
  useEffect(() => {
    if (
      isInitialized &&
      currentStepIndex !== previousStepIndex &&
      previousStepIndex >= 0 &&
      currentStepIndex !== -1
    ) {
      const stepDifference = currentStepIndex - previousStepIndex;

      console.log("[StepCarousel] 🟢 TRANSITION detected:", {
        previousStepIndex,
        currentStepIndex,
        stepDifference,
        depositFlowState,
        completedSteps: Array.from(completedSteps),
      });

      // Handle forward progression
      if (stepDifference > 0) {
        console.log("[StepCarousel] 🟢 Forward progression detected");
        const newCompletedSteps = new Set(completedSteps);
        for (let i = previousStepIndex; i < currentStepIndex; i++) {
          console.log(
            `[StepCarousel] 🟢 Marking step ${i} (${steps[i].id}) as completed (transition)`
          );
          newCompletedSteps.add(steps[i].id);
        }
        console.log("[StepCarousel] 🟢 New completed steps:", Array.from(newCompletedSteps));
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
    <Box
      position="relative"
      pb={paddingBottomCustom ? paddingBottomCustom : "0px"}
      width="100%"
      zIndex={1}
      height="100%"
      overflow="hidden"
    >
      {/* Steps */}
      <motion.div
        animate={{
          y: slideOffset,
          paddingTop: paddingTopCustom ? paddingTopCustom : "10px",
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

              // Show time estimate for Bitcoin confirmations
              let timeEstimate = "";
              if (currentConfs === 0) {
                timeEstimate = isMobile ? "\n(~20 mins remaining)" : " (~20 mins remaining)";
              } else if (currentConfs === 1) {
                timeEstimate = isMobile ? "\n(~10 mins remaining)" : " (~10 mins remaining)";
              }

              stepDescription = `Confirming... ${currentConfs}/${requiredConfs} confirmations${timeEstimate}`;
            } else {
              const requiredConfs = 4; // EVM->BTC needs 4 confirmations
              const currentConfs = Math.min(evmConfirmations, requiredConfs);
              stepDescription = `Confirming... ${currentConfs}/${requiredConfs} confirmations`;
            }
          }

          // Step 3: Filling order warning
          if (step.id === "3-WaitingMMDepositInitiated" && showFillingOrderWarning) {
            stepDescription =
              "Market makers are taking longer than usual to fill your order... you order will be refunded if not filled.";
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
                    whiteSpace="pre-line"
                  >
                    {stepDescription}
                  </Text>
                  {step.id === "4-WaitingMMDepositConfirmed" && isSettled && (
                    <Text
                      color="rgba(255,255,255,0.5)"
                      fontSize="12px"
                      fontFamily="Aux"
                      mt="10px"
                      mb="-10px"
                      textAlign="center"
                      fontStyle="italic"
                    >
                      Your wallet may wait for two block confirmations before funds show up.
                    </Text>
                  )}
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
              gap: isMobile ? "6px" : "12px",
              zIndex: 4,
            }}
          >
            {getShortTxnId() && (
              <Flex
                as="button"
                mt="-106px"
                alignItems="center"
                gap="8px"
                bg="rgba(2, 123, 30, 0.25)"
                borderRadius={isMobile ? "26px" : "16px"}
                padding={isMobile ? "10px 16px" : "8px 16px"}
                justifyContent="center"
                width={isMobile ? "100%" : "250px"}
                border="2px solid #3F7244"
                cursor="pointer"
                onClick={handleViewTransaction}
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(2, 123, 30, 0.35)",
                  boxShadow: "0 4px 12px rgba(127, 58, 12, 0.3)",
                }}
                transition="all 0.2s"
              >
                <Text
                  color="white"
                  fontFamily="Nostromo"
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  VIEW PAYOUT TXN
                </Text>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </Flex>
            )}

            <Flex
              gap={isMobile ? "6px" : "16px"}
              mt={isMobile ? "0" : "1px"}
              justifyContent="center"
              direction={isMobile ? "column" : "row"}
              width={isMobile ? "100%" : "auto"}
            >
              <Box
                as="button"
                onClick={onViewUserDeposit}
                border="2px solid rgba(255, 255, 255, 0.22)"
                borderRadius={isMobile ? "26px" : "16px"}
                width={isMobile ? "100%" : "250px"}
                background="rgba(255, 255, 255, 0.05)"
                padding={isMobile ? "10px 16px" : "8px 16px"}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(255, 255, 255, 0.10)",
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  boxShadow: "0 4px 12px rgba(255, 255, 255, 0.1)",
                }}
              >
                <Text
                  color="white"
                  fontFamily="Nostromo"
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  VIEW DEPOSIT
                </Text>
              </Box>

              <Box
                as="button"
                onClick={handleNewSwap}
                borderRadius={isMobile ? "26px" : "16px"}
                width={isMobile ? "100%" : "250px"}
                border="2px solid #6651B3"
                background="rgba(86, 50, 168, 0.30)"
                padding={isMobile ? "10px 16px" : "8px 16px"}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(86, 50, 168, 0.45)",
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
