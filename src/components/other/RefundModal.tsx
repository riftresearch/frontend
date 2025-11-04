import React, { useMemo } from "react";
import { Box, Flex, Text, Button, Spinner, Input, Portal } from "@chakra-ui/react";
import { FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { AdminSwapItem } from "@/utils/types";
import { validateRefundAddress } from "@/utils/refundHelpers";

interface RefundModalProps {
  isOpen: boolean;
  selectedSwap: AdminSwapItem | null;
  refundAddress: string;
  setRefundAddress: (address: string) => void;
  isClaimingRefund: boolean;
  refundStatus: "idle" | "loading" | "success" | "error";
  currentBitcoinFee: number | null;
  fetchingFee: boolean;
  onClose: () => void;
  onClaimRefund: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  isOpen,
  selectedSwap,
  refundAddress,
  setRefundAddress,
  isClaimingRefund,
  refundStatus,
  currentBitcoinFee,
  fetchingFee,
  onClose,
  onClaimRefund,
}) => {
  if (!isOpen || !selectedSwap) return null;

  // Determine address type based on swap direction
  const addressType = selectedSwap.direction === "BTC_TO_EVM" ? "bitcoin" : "ethereum";
  const isBitcoinRefund = addressType === "bitcoin";

  // Validate address in real-time
  const addressValidation = useMemo(() => {
    if (!refundAddress || refundAddress.trim() === "") {
      return { isValid: false, error: null };
    }

    const isValid = validateRefundAddress(refundAddress, addressType);
    return {
      isValid,
      error: isValid
        ? null
        : `Invalid ${addressType === "bitcoin" ? "Bitcoin" : "Ethereum"} address format`,
    };
  }, [refundAddress, addressType]);

  // Disable claim button if address is invalid or empty
  const isClaimDisabled = isClaimingRefund || !refundAddress.trim() || !addressValidation.isValid;

  return (
    <Portal>
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
        onClick={onClose}
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
              onClick={onClose}
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
              The market maker failed to fill your order. Please paste your refund address to claim
              your funds.
            </Text>

            {/* Address Input */}
            <Flex direction="column" gap="8px">
              <Text
                fontSize="13px"
                color={colors.textGray}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                mb="4px"
              >
                {selectedSwap.direction === "BTC_TO_EVM" ? "Bitcoin" : "Ethereum"} Address
              </Text>
              <Input
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value)}
                placeholder={
                  selectedSwap.direction === "BTC_TO_EVM"
                    ? "Enter Bitcoin address"
                    : "Enter Ethereum address"
                }
                w="100%"
                p="12px 16px"
                borderRadius="12px"
                border={`2px solid ${
                  refundAddress.trim() && !addressValidation.isValid
                    ? "rgba(239, 68, 68, 0.6)"
                    : refundAddress.trim() && addressValidation.isValid
                      ? "rgba(34, 197, 94, 0.6)"
                      : colors.borderGray
                }`}
                bg={colors.offBlack}
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                fontSize="14px"
                _focus={{
                  borderColor:
                    refundAddress.trim() && !addressValidation.isValid
                      ? "rgba(239, 68, 68, 0.8)"
                      : refundAddress.trim() && addressValidation.isValid
                        ? "rgba(34, 197, 94, 0.8)"
                        : "rgba(102, 81, 179, 0.6)",
                  outline: "none",
                }}
              />

              {/* Validation feedback */}
              {refundAddress.trim() && !addressValidation.isValid && (
                <Flex align="center" gap="6px" mt="4px">
                  <FiAlertCircle size={14} color="#ef4444" />
                  <Text fontSize="12px" color="#ef4444" fontFamily={FONT_FAMILIES.AUX_MONO}>
                    {addressValidation.error}
                  </Text>
                </Flex>
              )}
              {refundAddress.trim() && addressValidation.isValid && (
                <Flex align="center" gap="6px" mt="4px">
                  <FiCheck size={14} color="#22c55e" />
                  <Text fontSize="12px" color="#22c55e" fontFamily={FONT_FAMILIES.AUX_MONO}>
                    Valid {addressType === "bitcoin" ? "Bitcoin" : "Ethereum"} address
                  </Text>
                </Flex>
              )}
            </Flex>

            {/* Bitcoin Fee Information */}
            {isBitcoinRefund && (
              <Flex
                direction="column"
                gap="8px"
                p="12px"
                borderRadius="12px"
                bg="rgba(255, 255, 255, 0.05)"
                border="1px solid rgba(255, 255, 255, 0.1)"
              >
                <Text
                  fontSize="12px"
                  color={colors.textGray}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontWeight="600"
                >
                  Transaction Fee
                </Text>
                {fetchingFee ? (
                  <Flex align="center" gap="8px">
                    <Spinner size="xs" color={colors.offWhite} />
                    <Text
                      fontSize="12px"
                      color={colors.textGray}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                    >
                      Fetching current network fee...
                    </Text>
                  </Flex>
                ) : currentBitcoinFee !== null ? (
                  <Flex justify="space-between" align="center">
                    <Text
                      fontSize="12px"
                      color={colors.textGray}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                    >
                      Network fee (3 blocks ~30 min):
                    </Text>
                    <Text
                      fontSize="13px"
                      color={colors.offWhite}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      fontWeight="500"
                    >
                      {currentBitcoinFee.toLocaleString()} sats
                    </Text>
                  </Flex>
                ) : (
                  <Text fontSize="11px" color="#fbbf24" fontFamily={FONT_FAMILIES.AUX_MONO}>
                    ⚠️ Could not fetch fee, using 0 sats (transaction may be slow)
                  </Text>
                )}
              </Flex>
            )}

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
                onClick={onClaimRefund}
                cursor={isClaimDisabled ? "not-allowed" : "pointer"}
                color={colors.offWhite}
                _active={{ bg: colors.swapBgColor }}
                _hover={{
                  bg: isClaimDisabled ? colors.swapBgColor : colors.swapHoverColor,
                }}
                borderRadius="12px"
                border={`2.5px solid ${colors.swapBorderColor}`}
                type="button"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="15px"
                paddingX="32px"
                paddingY="10px"
                bg={colors.swapBgColor}
                disabled={isClaimDisabled}
                opacity={isClaimDisabled ? 0.6 : 1}
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
    </Portal>
  );
};
