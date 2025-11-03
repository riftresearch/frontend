import React, { useState, useEffect } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { CountdownTimer } from "./CountdownTimer";
import useWindowSize from "@/hooks/useWindowSize";
import { useStore } from "@/utils/store";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { motion, AnimatePresence } from "framer-motion";
import { toastSuccess, toastError } from "@/utils/toast";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import router from "next/router";

// Step configuration
const steps = [
  {
    id: "1-WaitingUserDepositInitiated",
    label: "AWAITING DEPOSIT",
    description: "Waiting for your ERC-20 deposit...",
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
    description: "Bitcoin has been sent to your wallet!",
  },
];

function StepCarousel({ swapId }: { swapId?: string }) {
  const depositFlowState = useStore((state) => state.depositFlowState);
  const swapResponse = useStore((state) => state.swapResponse);
  // Use provided swapId prop, fallback to store value
  const currentSwapId = swapId || swapResponse?.swap_id;
  const { data: swapStatusInfo } = useSwapStatus(currentSwapId);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [slideOffset, setSlideOffset] = useState(0);
  const [previousStepIndex, setPreviousStepIndex] = useState(-1);
  const [showButtons, setShowButtons] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { isMobile } = useWindowSize();
  // Check if we're in the settled state (step 4 or 5)
  const isSettled =
    depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled";

  // Find current step index
  // If status is "5-Settled", treat it as step 3 (the final step, index 3)
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

      // Set slide offset to position the current step at the top
      setSlideOffset(-currentStepIndex * 86);

      setIsInitialized(true);
      setPreviousStepIndex(currentStepIndex);
    }
  }, [currentStepIndex, isInitialized, isSettled]);

  // Handle step transitions (now works for any step-to-step transition)
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
        // Mark all previous steps as completed
        const newCompletedSteps = new Set(completedSteps);
        for (let i = previousStepIndex; i < currentStepIndex; i++) {
          newCompletedSteps.add(steps[i].id);
        }
        setCompletedSteps(newCompletedSteps);

        // Animate slide to new position
        setTimeout(() => {
          setSlideOffset(-currentStepIndex * 86);

          // For settled step, mark it complete after slide animation
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
      // Handle backward progression (in case of step reversals)
      else if (stepDifference < 0) {
        // Remove completed status from steps that are now in the future
        const newCompletedSteps = new Set(completedSteps);
        for (let i = currentStepIndex + 1; i < steps.length; i++) {
          newCompletedSteps.delete(steps[i].id);
        }
        setCompletedSteps(newCompletedSteps);
        setShowButtons(false);

        // Animate slide to new position
        setSlideOffset(-currentStepIndex * 86);
      }
    }
    setPreviousStepIndex(currentStepIndex);
  }, [currentStepIndex, previousStepIndex, isInitialized, completedSteps, isSettled]);

  if (currentStepIndex === -1) return null;

  const handleViewTransaction = () => {
    const txnId = swapStatusInfo?.mm_deposit?.deposit_tx;
    if (txnId) {
      window.open(`https://mempool.space/tx/${txnId}`, "_blank");
    } else {
      window.open("https://mempool.space", "_blank");
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
        console.log("Transaction ID copied to clipboard");
      } catch (err) {
        console.error("Failed to copy transaction ID:", err);
        toastError(err, {
          title: "Copy Failed",
          description: "Unable to copy transaction ID",
        });
      }
    }
  };

  // Get shortened transaction ID for display
  const getShortTxnId = () => {
    const txnId = swapStatusInfo?.mm_deposit?.deposit_tx;
    if (!txnId) return "";
    return `${txnId.slice(0, 12)}...${txnId.slice(-12)}`;
  };

  const handleNewSwap = () => {
    // Reset to initial state for new swap
    // redirect to home page
    router.push("/");
  };

  return (
    <Box position="relative" width="100%" height="100%" overflow="hidden">
      {" "}
      {/* Increased height for larger text */}
      {/* Continuous sliding container */}
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
        {/* Render all steps statically */}
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);

          // Calculate position-based properties (not currentStepIndex-based)
          // slideOffset is negative, so we need to add it to get correct position
          const positionFromTop = index + slideOffset / 86; // Updated for new slide distance of 86px
          const isCurrent = Math.abs(positionFromTop) < 0.1; // Current is at position 0
          const isNext = Math.abs(positionFromTop - 1) < 0.1; // Next is at position 1

          // Animate opacity based on position
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
                height: "86px", // Increased for larger text
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
                  {/* Loading Spinner or Checkmark - on the left side */}
                  <Box
                    width="24px"
                    height="24px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {index === currentStepIndex && !isCompleted ? (
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
                    fontSize="13px" // Increased 1.1x from 12px
                    fontFamily="Aux"
                    mt="4px"
                    textAlign="center"
                  >
                    {step.description}
                  </Text>
                </motion.div>
              </Flex>
            </motion.div>
          );
        })}
      </motion.div>
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

            {/* Button Row */}
            <Flex gap="16px" mt="-52px" justifyContent="center">
              {/* View Transaction Button */}
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
  );
}

export function TransactionWidget({ swapId }: { swapId?: string } = {}) {
  const { isMobile } = useWindowSize();
  const depositFlowState = useStore((state) => state.depositFlowState);
  const countdownValue = useStore((state) => state.countdownValue);
  const swapResponse = useStore((state) => state.swapResponse);
  // Use provided swapId prop, fallback to store value
  const currentSwapId = swapId || swapResponse?.swap_id;
  const { data: swapStatusInfo } = useSwapStatus(currentSwapId);
  const isSettled =
    depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled";
  const showLoadingDots = countdownValue === 0 && !isSettled;

  // Find current step index
  const isSettledStatus = depositFlowState === "5-Settled";
  const currentStepIndex = isSettledStatus
    ? 3
    : steps.findIndex((step) => step.id === depositFlowState);
  const validStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  // Check if MM failed to fill (> 1 hour 20 mins on step 2 "Filling Order")
  const isMMFailed = React.useMemo(() => {
    if (validStepIndex !== 2 || !swapStatusInfo?.created_at) return false;

    const createdAt = new Date(swapStatusInfo.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    return minutesSinceCreation > 80; // 1 hour 20 minutes
  }, [validStepIndex, swapStatusInfo?.created_at]);

  const handleGoToHistory = () => {
    router.push("/history");
  };

  const handleViewUserTransaction = () => {
    const txnId = swapStatusInfo?.user_deposit?.deposit_tx;
    const chain = swapStatusInfo?.user_deposit?.chain;

    if (txnId) {
      if (chain === "ETH") {
        window.open(`https://etherscan.io/tx/${txnId}`, "_blank");
      } else if (chain === "BASE") {
        window.open(`https://basescan.org/tx/${txnId}`, "_blank");
      } else {
        window.open(`https://etherscan.io/tx/${txnId}`, "_blank");
      }
    }
  };

  // If MM failed to fill, show failed view
  if (isMMFailed) {
    return (
      <Box
        w={isMobile ? "100%" : "805px"}
        h="510px"
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
            lineHeight="1.6"
          >
            The market maker failed to fill your order. You can initiate a refund in the swap
            history page.
          </Text>

          {/* Buttons */}
          <Flex gap="16px" justifyContent="center" flexWrap="wrap">
            {/* View User Deposit Transaction Button - if we have user deposit tx */}
            {swapStatusInfo?.user_deposit?.deposit_tx && (
              <Box
                as="button"
                onClick={handleViewUserTransaction}
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

            {/* Swap History Button */}
            <Box
              as="button"
              onClick={handleGoToHistory}
              borderRadius="16px"
              width={isMobile ? "160px" : "180px"}
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
                SWAP HISTORY
              </Text>
            </Box>
          </Flex>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      w={isMobile ? "100%" : "805px"}
      h="510px"
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
        {/* Corner decorations */}
        <img
          src="/images/txns/top_left.svg"
          alt=""
          style={{
            position: "absolute",
            top: "25px", // 1.25x vertical padding: 20px * 1.25 = 25px
            left: "40px", // Doubled horizontal padding: 20px * 2 = 40px
            width: "28px", // 15% bigger: 24px * 1.15 = 27.6px ≈ 28px
            height: "28px",
            opacity: 0.5,
          }}
        />
        <img
          src="/images/txns/top_right.svg"
          alt=""
          style={{
            position: "absolute",
            top: "25px", // 1.25x vertical padding: 20px * 1.25 = 25px
            right: "40px", // Doubled horizontal padding: 20px * 2 = 40px
            width: "60px", // 2.5x bigger: 24px * 2.5 = 60px
            height: "60px",
            opacity: 0.5,
          }}
        />
        <img
          src="/images/txns/bottom_left.svg"
          alt=""
          style={{
            position: "absolute",
            bottom: "25px", // 1.25x vertical padding: 20px * 1.25 = 25px
            left: "40px", // Doubled horizontal padding: 20px * 2 = 40px
            width: "60px", // 2.5x bigger: 24px * 2.5 = 60px
            height: "60px",
            opacity: 0.5,
          }}
        />
        <img
          src="/images/txns/bottom_right.svg"
          alt=""
          style={{
            position: "absolute",
            bottom: "25px", // 1.25x vertical padding: 20px * 1.25 = 25px
            right: "40px", // Doubled horizontal padding: 20px * 2 = 40px
            width: "28px", // 15% bigger: 24px * 1.15 = 27.6px ≈ 28px
            height: "28px",
            opacity: 0.5,
          }}
        />

        <AnimatePresence mode="wait">
          {countdownValue > 0 && !isSettled ? (
            <motion.div
              key="countdown"
              initial={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <CountdownTimer
                onComplete={() => {
                  console.log("Countdown completed");
                }}
              />
            </motion.div>
          ) : showLoadingDots ? (
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
      </Box>
      <Box
        h="50%"
        bottom="0px"
        position="absolute"
        padding="20px"
        w="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <StepCarousel swapId={currentSwapId} />
      </Box>
    </Box>
  );
}
