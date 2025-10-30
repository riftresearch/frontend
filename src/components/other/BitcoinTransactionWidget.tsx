import { Box, Text, Flex } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy } from "react-icons/lu";
import { FiExternalLink } from "react-icons/fi";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import useWindowSize from "@/hooks/useWindowSize";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { toastSuccess, toastError } from "@/utils/toast";
import WebAssetTag from "./WebAssetTag";
import { useStore } from "@/utils/store";

interface BitcoinTransactionWidgetProps {
  address: string;
  amount: number;
  bitcoinUri: string;
  depositTx?: string;
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
    description: "Bitcoin has been sent to your wallet!",
  },
];

function StepCarousel({
  isMobile,
  currentStepIndex,
  completedSteps,
}: {
  isMobile: boolean;
  currentStepIndex: number;
  completedSteps: Set<string>;
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
    </Box>
  );
}

export function BitcoinTransactionWidget({
  address,
  amount,
  bitcoinUri,
  depositTx,
}: BitcoinTransactionWidgetProps) {
  const { isMobile } = useWindowSize();
  const depositFlowState = useStore((state) => state.depositFlowState);

  // Track completed steps
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Map deposit flow state to step index
  const currentStepIndex = steps.findIndex((step) => step.id === depositFlowState);
  const validStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  // Update completed steps when moving forward
  useEffect(() => {
    if (validStepIndex > 0) {
      const newCompletedSteps = new Set(completedSteps);
      for (let i = 0; i < validStepIndex; i++) {
        newCompletedSteps.add(steps[i].id);
      }
      setCompletedSteps(newCompletedSteps);
    }
  }, [validStepIndex]);

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
          h={isMobile ? "65%" : "59%"}
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

          {/* QR Code and Details - Horizontal Layout */}
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
        </Box>

        {/* Bottom Half - Steps */}
        <Box
          h="41%"
          bottom="0px"
          position="absolute"
          padding="30px 20px 20px 20px"
          w="100%"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="flex-start"
          overflow="hidden"
          borderRadius="0 0 40px 40px"
        >
          {/* View Transaction Button - Only show if past step 1 and we have a deposit tx */}
          {validStepIndex > 0 && depositTx && (
            <Flex
              as="button"
              onClick={handleViewTransaction}
              alignItems="center"
              justifyContent="center"
              gap="8px"
              px="18px"
              py="7px"
              mt="-10px"
              mb="-17px"
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
                fontSize="10px"
                color="rgba(255, 255, 255, 0.9)"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                letterSpacing="0.5px"
              >
                VIEW TXN IN MEMPOOL
              </Text>
              <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
            </Flex>
          )}

          {/* Step Carousel */}
          <Box
            width="100%"
            height="auto"
            flex="1"
            display="flex"
            alignItems="flex-start"
            pt="10px"
            overflow="hidden"
          >
            <StepCarousel
              isMobile={isMobile}
              currentStepIndex={validStepIndex}
              completedSteps={completedSteps}
            />
          </Box>
        </Box>
      </Box>

      {/* Warning/Status Text - Outside the main container */}
      {validStepIndex === 0 && (
        <Text
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
          fontSize={"12px"}
          color="rgba(255, 255, 255, 0.5)"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          textAlign="center"
          px={isMobile ? "20px" : "0"}
        >
          Estimated time remaining: ~10 minutes
        </Text>
      )}
    </Flex>
  );
}
