import { Box, Text, Flex } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy } from "react-icons/lu";
import { useState } from "react";
import { motion } from "framer-motion";
import useWindowSize from "@/hooks/useWindowSize";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { toastSuccess, toastError } from "@/utils/toast";
import WebAssetTag from "./WebAssetTag";

interface BitcoinTransactionWidgetProps {
  address: string;
  amount: number;
  bitcoinUri: string;
}

// Step configuration for Bitcoin deposit flow
const steps = [
  {
    id: "1-AwaitingBitcoinDeposit",
    label: "AWAITING BITCOIN DEPOSIT",
    description: "Waiting for your Bitcoin deposit...",
  },
  {
    id: "2-ConfirmingBitcoinDeposit",
    label: "CONFIRMING DEPOSIT",
    description: "Waiting for Bitcoin confirmations...",
  },
  {
    id: "3-FillingOrder",
    label: "FILLING ORDER",
    description: "A market maker is filling your order...",
  },
  {
    id: "4-SwapComplete",
    label: "SWAP COMPLETE",
    description: "Your swap has been completed!",
  },
];

function StepCarousel() {
  // Default to step 0 (Awaiting Bitcoin Deposit)
  const [currentStepIndex] = useState(0);
  const [completedSteps] = useState<Set<string>>(new Set());
  const [slideOffset] = useState(0); // Start at 0 for first step

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
                    fontSize="13px"
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
}: BitcoinTransactionWidgetProps) {
  const { isMobile } = useWindowSize();

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
      {/* Top Half - QR Code and Details Section */}
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
            top: "25px",
            left: "40px",
            width: "28px",
            height: "28px",
            opacity: 0.6,
          }}
        />
        <img
          src="/images/txns/top_right.svg"
          alt=""
          style={{
            position: "absolute",
            top: "25px",
            right: "40px",
            width: "60px",
            height: "60px",
            opacity: 0.6,
          }}
        />
        <img
          src="/images/txns/bottom_left.svg"
          alt=""
          style={{
            position: "absolute",
            bottom: "25px",
            left: "40px",
            width: "60px",
            height: "60px",
            opacity: 0.6,
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
            opacity: 0.6,
          }}
        />

        {/* QR Code and Details - Horizontal Layout */}
        <Flex direction="row" align="center" justify="center" gap="40px" zIndex={1} px="60px">
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
            <QRCodeSVG value={bitcoinUri} size={180} />
          </Flex>

          {/* Address and Amount Details on Right - Stacked Vertically */}
          <Flex direction="column" gap="20px" flex="1" maxW="450px">
            {/* Bitcoin Address Section */}
            <Flex direction="column" w="100%">
              <Text
                fontSize="12px"
                color="rgba(255,255,255,0.6)"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                letterSpacing="1px"
                mb="6px"
              >
                BITCOIN ADDRESS
              </Text>
              <Flex
                alignItems="center"
                gap="10px"
                bg="rgba(255, 255, 255, 0.08)"
                borderRadius="10px"
                padding="10px 14px"
                border="1px solid rgba(255, 255, 255, 0.15)"
                cursor="pointer"
                onClick={() => copyToClipboard(address, "Bitcoin Address")}
                _hover={{
                  bg: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.25)",
                }}
                transition="all 0.2s"
              >
                <Text
                  color={colors.offWhite}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontSize="13px"
                  letterSpacing="-0.3px"
                  fontWeight="500"
                  flex="1"
                >
                  {address}
                </Text>
                <LuCopy
                  color="rgba(255, 255, 255, 0.6)"
                  size={16}
                  style={{
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                />
              </Flex>
            </Flex>

            {/* Amount Section */}
            <Flex direction="column" w="100%">
              <Text
                fontSize="12px"
                color="rgba(255,255,255,0.6)"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                letterSpacing="1px"
                mb="6px"
              >
                DEPOSIT AMOUNT
              </Text>
              <Flex
                alignItems="center"
                gap="10px"
                bg="rgba(255, 255, 255, 0.08)"
                borderRadius="10px"
                padding="10px 14px"
                border="1px solid rgba(255, 255, 255, 0.15)"
                cursor="pointer"
                onClick={() => copyToClipboard(amount.toFixed(8), "Bitcoin Amount")}
                _hover={{
                  bg: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.25)",
                }}
                transition="all 0.2s"
              >
                <Text
                  color={colors.offWhite}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontSize="16px"
                  letterSpacing="-0.3px"
                  fontWeight="600"
                >
                  {amount.toFixed(8)}
                </Text>
                <LuCopy
                  color="rgba(255, 255, 255, 0.6)"
                  size={16}
                  style={{
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                />
                <WebAssetTag asset="BTC" />
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Box>

      {/* Bottom Half - Steps and Warning */}
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
      >
        {/* Step Carousel */}
        <Box width="100%" height="auto" mb="20px">
          <StepCarousel />
        </Box>

        {/* Warning Text */}
        <Text
          fontSize="11px"
          color="rgba(255, 255, 255, 0.5)"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          textAlign="center"
          mt="auto"
        >
          WARNING: Send the exact amount shown above to complete the swap.
        </Text>
      </Box>
    </Box>
  );
}
