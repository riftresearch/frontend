import { Box, Image } from "@chakra-ui/react";
import { BASE_LOGO } from "./SVGs";
import { Chain } from "@/utils/types";

interface NetworkBadgeProps {
  chain: Chain;
  size?: string;
}

/** Network badge component displaying chain icon */
export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ chain, size = "14px" }) => {
  // Bitcoin
  if (chain === Chain.Bitcoin) {
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
  if (chain === Chain.Ethereum) {
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
  if (chain === Chain.Base) {
    return (
      <Box w={size} h={size} display="flex" alignItems="center" justifyContent="center">
        <BASE_LOGO width={size.replace("px", "")} height={size.replace("px", "")} />
      </Box>
    );
  }
  return null;
};
