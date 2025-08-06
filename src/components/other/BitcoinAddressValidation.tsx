import { Flex } from "@chakra-ui/react";

interface BitcoinAddressValidationProps {
  address: string;
  validation?: {
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  };
}

const BitcoinAddressValidation = ({
  address,
  validation,
}: BitcoinAddressValidationProps) => {
  const isValid = validation?.isValid ?? false;
  const isNetworkMismatch = validation?.networkMismatch ?? false;

  const getBackgroundColor = () => {
    if (isValid) return "#4CAF50"; // Green for valid
    if (isNetworkMismatch) return "#FF9800"; // Orange for network mismatch
    return "#f44336"; // Red for invalid
  };

  const getIcon = () => {
    if (isValid) {
      // Checkmark
      return <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />;
    }
    if (isNetworkMismatch) {
      // Warning triangle
      return <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />;
    }
    // X mark
    return (
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    );
  };

  return (
    <Flex
      w="24px"
      h="24px"
      borderRadius="50%"
      align="center"
      justify="center"
      bg={getBackgroundColor()}
      alignSelf="center"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
        {getIcon()}
      </svg>
    </Flex>
  );
};

export default BitcoinAddressValidation;
