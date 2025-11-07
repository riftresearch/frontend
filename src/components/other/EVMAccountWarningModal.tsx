import React from "react";
import { Box, Button, Flex, Text, Portal } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

interface EVMAccountWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

const EVM_WARNING_COOKIE = "evm_account_warning_acknowledged";

/**
 * Set cookie to remember user has seen the EVM account warning
 */
export function setEVMWarningAcknowledged(): void {
  if (typeof document === "undefined") return;

  // Set cookie with 1 year expiry
  const maxAge = 60 * 60 * 24 * 365; // 1 year in seconds
  document.cookie = `${EVM_WARNING_COOKIE}=true; path=/; max-age=${maxAge}; SameSite=Strict`;
}

/**
 * Check if user has already acknowledged the EVM account warning
 */
export function hasAcknowledgedEVMWarning(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === EVM_WARNING_COOKIE && value === "true") {
      return true;
    }
  }

  return false;
}

export const EVMAccountWarningModal: React.FC<EVMAccountWarningModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    setEVMWarningAcknowledged();
    onConfirm();
  };

  return (
    <Portal>
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="rgba(0, 0, 0, 0.8)"
        zIndex="modal"
        display="flex"
        alignItems="center"
        justifyContent="center"
        onClick={() => {}}
      >
        <Box
          bg="#131313"
          borderRadius="30px"
          py="32px"
          px="32px"
          maxW="520px"
          w="90%"
          border="2px solid #232323"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.offWhite}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Flex
            pb="15px"
            fontSize="20px"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            fontWeight="bold"
            justify="center"
            align="center"
          >
            <Text>How to swap BTC</Text>
          </Flex>

          {/* Body */}
          <Flex direction="column" align="center" gap="24px" pb="0px">
            <Text
              fontSize="16px"
              textAlign="center"
              lineHeight="1.6"
              color={colors.textGray}
              letterSpacing="-1.5px"
              // px="8px"
              pb="5px"
            >
              Rift uses your Ethereum address to track your swap history, even for Bitcoin swaps.
            </Text>

            <Flex direction="column" align="flex-start" gap="12px" w="full" px="8px">
              <Flex direction="column" gap="8px" w="full">
                <Text
                  fontSize="15px"
                  color={colors.textGray}
                  letterSpacing="-1.5px"
                  lineHeight="1.5"
                >
                  1. Connect your Ethereum wallet
                </Text>
                <Text
                  fontSize="15px"
                  color={colors.textGray}
                  letterSpacing="-1.5px"
                  lineHeight="1.5"
                >
                  2. Send the exact BTC amount to the QR code address
                </Text>
                <Text
                  fontSize="15px"
                  color={colors.textGray}
                  letterSpacing="-1.5px"
                  lineHeight="1.5"
                >
                  3. Receive cbBTC in ~30 minutes
                </Text>
              </Flex>
            </Flex>

            <Button
              onClick={handleConfirm}
              cursor="pointer"
              color={colors.offWhite}
              _active={{ bg: colors.swapBgColor }}
              _hover={{ bg: colors.swapHoverColor }}
              borderRadius="12px"
              border={`2.5px solid ${colors.swapBorderColor}`}
              type="button"
              height="50px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              fontSize="17px"
              paddingX="32px"
              bg={colors.swapBgColor}
              boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
              w="full"
              maxW="200px"
            >
              Got it
            </Button>
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
};
