import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Input, Portal } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FiCheck, FiX } from "react-icons/fi";

interface PasteAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressType: "EVM" | "BTC";
  onConfirm: (address: string) => void;
}

// EVM validation
const isValidEvmAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// BTC validation (supports legacy, segwit, native segwit, taproot)
const isValidBtcAddress = (address: string): boolean => {
  // P2PKH (legacy) - starts with 1
  // P2SH - starts with 3
  // Bech32 (native segwit) - starts with bc1q
  // Taproot - starts with bc1p
  return /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/.test(
    address
  );
};

export const PasteAddressModal: React.FC<PasteAddressModalProps> = ({
  isOpen,
  onClose,
  addressType,
  onConfirm,
}) => {
  const [address, setAddress] = useState("");
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!address) {
      setIsValid(null);
      return;
    }

    if (addressType === "EVM") {
      setIsValid(isValidEvmAddress(address));
    } else {
      setIsValid(isValidBtcAddress(address));
    }
  }, [address, addressType]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAddress("");
      setIsValid(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(address);
      onClose();
    }
  };

  const handleBackdropClick = () => {
    onClose();
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
        onClick={handleBackdropClick}
      >
        <Box
          bg="#131313"
          borderRadius="20px"
          py="24px"
          px="24px"
          maxW="420px"
          w="90%"
          border="2px solid #232323"
          fontFamily="Inter"
          color={colors.offWhite}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Flex justify="space-between" align="center" mb="20px">
            <Text fontSize="18px" fontWeight="600">
              Paste {addressType === "EVM" ? "Ethereum" : "Bitcoin"} Address
            </Text>
            <Box
              cursor="pointer"
              onClick={onClose}
              p="4px"
              borderRadius="6px"
              _hover={{ bg: "#242424" }}
            >
              <FiX size={20} color={colors.textGray} />
            </Box>
          </Flex>

          {/* Input */}
          <Flex direction="column" gap="12px">
            <Flex
              align="center"
              bg="#1a1a1a"
              borderRadius="12px"
              border={`2px solid ${
                isValid === null ? "#333" : isValid ? colors.greenOutline : "#F87171"
              }`}
              px="14px"
              py="12px"
              transition="border-color 0.2s ease"
            >
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                placeholder={addressType === "EVM" ? "0x..." : "bc1... or 1... or 3..."}
                bg="transparent"
                border="none"
                outline="none"
                color={colors.offWhite}
                fontSize="15px"
                fontFamily="Inter"
                _focus={{ border: "none", boxShadow: "none" }}
                _placeholder={{ color: colors.textGray }}
                flex="1"
              />
              {isValid !== null && (
                <Box ml="10px">
                  {isValid ? (
                    <FiCheck size={20} color={colors.greenOutline} />
                  ) : (
                    <FiX size={20} color="#F87171" />
                  )}
                </Box>
              )}
            </Flex>

            {/* Validation message */}
            {isValid === false && address && (
              <Text color="#F87171" fontSize="13px" pl="4px">
                Invalid {addressType === "EVM" ? "Ethereum" : "Bitcoin"} address
              </Text>
            )}

            {/* Confirm button */}
            <Flex
              justify="center"
              align="center"
              py="14px"
              mt="8px"
              borderRadius="12px"
              bg={isValid ? "rgba(72, 201, 77, 0.15)" : "rgba(100, 100, 100, 0.15)"}
              border={`2px solid ${isValid ? colors.greenOutline : "#444"}`}
              cursor={isValid ? "pointer" : "not-allowed"}
              opacity={isValid ? 1 : 0.5}
              transition="all 0.2s ease"
              _hover={isValid ? { bg: "rgba(72, 201, 77, 0.25)" } : {}}
              onClick={handleConfirm}
            >
              <Text
                color={isValid ? colors.greenOutline : colors.textGray}
                fontSize="15px"
                fontWeight="600"
                fontFamily="Inter"
              >
                Confirm Address
              </Text>
            </Flex>
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
};

