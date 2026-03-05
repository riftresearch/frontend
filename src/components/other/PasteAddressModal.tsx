import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Input, Portal } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FiCheck, FiX } from "react-icons/fi";
import { FONT_FAMILIES } from "@/utils/font";

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

  // Style based on address type
  const isBTC = addressType === "BTC";
  const bgColor = isBTC ? "rgba(46, 29, 14, 0.66)" : "rgba(37, 82, 131, 0.66)";
  const borderColor = isBTC ? "#78491F" : "#255283";
  const lightTextColor = isBTC ? "#856549" : "#4A90E2";
  const accentColor = isBTC ? "#F7AA50" : "#788CFF";

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
        bg="rgba(0, 0, 0, 0.7)"
        backdropFilter="blur(4px)"
        zIndex="modal"
        display="flex"
        alignItems="center"
        justifyContent="center"
        onClick={handleBackdropClick}
      >
        <Box
          bg="#0E0E0E"
          borderRadius="20px"
          py="20px"
          px="20px"
          maxW="480px"
          w="90%"
          border={`2px solid ${borderColor}`}
          fontFamily="Inter"
          color={colors.offWhite}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Flex justify="space-between" align="center" mb="16px" ml="8px">
            <Text fontSize="15px" fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
              {addressType === "EVM" ? "Ethereum" : "Bitcoin"} Recipient Address
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

          {/* Input styled like Bitcoin Recipient Address */}
          <Flex
            px="10px"
            bg={bgColor}
            border={`2px solid ${borderColor}`}
            w="100%"
            h="60px"
            borderRadius="16px"
          >
            <Flex direction="row" py="6px" px="8px" w="100%" align="center">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                placeholder={addressType === "EVM" ? "0x..." : "bc1q5d7rjq7g6rd2d..."}
                fontFamily="Aux"
                border="none"
                bg="transparent"
                outline="none"
                mt="3.5px"
                mr="15px"
                ml="-4px"
                p="0px"
                w="100%"
                letterSpacing="-5px"
                color={colors.offWhite}
                _active={{ border: "none", boxShadow: "none", outline: "none" }}
                _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                _selected={{ border: "none", boxShadow: "none", outline: "none" }}
                fontSize="28px"
                _placeholder={{ color: lightTextColor }}
                spellCheck={false}
              />

              {isValid !== null && (
                <Flex
                  w="36px"
                  h="36px"
                  borderRadius="50%"
                  bg={isValid ? "rgba(72, 201, 77, 0.15)" : "rgba(248, 113, 113, 0.15)"}
                  border={`2px solid ${isValid ? colors.greenOutline : "#F87171"}`}
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  {isValid ? (
                    <FiCheck size={18} color={colors.greenOutline} />
                  ) : (
                    <FiX size={18} color="#F87171" />
                  )}
                </Flex>
              )}
            </Flex>
          </Flex>

          {/* Validation message */}
          {isValid === false && address && (
            <Text color="#F87171" fontSize="13px" pl="12px" mt="8px">
              Invalid {addressType === "EVM" ? "Ethereum" : "Bitcoin"} address
            </Text>
          )}

          {/* Confirm button */}
          <Flex
            justify="center"
            align="center"
            py="14px"
            mt="16px"
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
        </Box>
      </Box>
    </Portal>
  );
};
