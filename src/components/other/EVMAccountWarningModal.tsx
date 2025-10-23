import React from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
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
    >
      <Box
        bg="#1a1a1a"
        borderWidth={2}
        w="550px"
        maxWidth="90%"
        borderColor={colors.borderGray}
        borderRadius="30px"
        fontFamily={FONT_FAMILIES.AUX_MONO}
        color={colors.offWhite}
        position="relative"
        p="32px"
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
          <Text>Sign in with your wallet</Text>
        </Flex>

        {/* Body */}
        <Flex direction="column" align="center" gap="24px" pb="0px">
          <Text
            fontSize="16px"
            textAlign="center"
            lineHeight="1.6"
            // fontFamily={FONT_FAMILIES.SF_PRO}
            color={colors.textGray}
            letterSpacing="-1.5px"
            px="8px"
            pb="5px"
          >
            Sign in with your wallet to see your swap history, even for native Bitcoin swaps.
          </Text>

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
    </Flex>
  );
};
