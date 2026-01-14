import { Box, Image } from "@chakra-ui/react";
import { BASE_LOGO } from "./SVGs";

interface NetworkBadgeProps {
  chainId: number;
  size?: string;
}

/** Network badge component displaying chain icon */
export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ chainId, size = "14px" }) => {
  // Bitcoin
  if (chainId === 0) {
    return (
      <Image
        src="/images/assets/icons/BTC.svg"
        w={size}
        h={size}
        alt="Bitcoin"
        objectFit="contain"
      />
    );
  }
  // Ethereum
  if (chainId === 1) {
    return (
      <Image
        src="/images/assets/icons/ETH.svg"
        w={size}
        h={size}
        alt="Ethereum"
        objectFit="contain"
      />
    );
  }
  // Base
  if (chainId === 8453) {
    return (
      <Box w={size} h={size} display="flex" alignItems="center" justifyContent="center">
        <BASE_LOGO width={size.replace("px", "")} height={size.replace("px", "")} />
      </Box>
    );
  }
  return null;
};
