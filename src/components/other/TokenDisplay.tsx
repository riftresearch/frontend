import { Flex, Text, Box, Image } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { CHAIN_NAMES } from "@/utils/constants";
import { NetworkBadge } from "./NetworkBadge";
import { TokenData } from "@/utils/types";

// Dynamic's icon sprite URL for wallet badges
const DYNAMIC_ICON_BASE = "https://iconic.dynamic-static-assets.com/icons/sprite.svg";

export interface WalletIcon {
  iconKey: string;
  walletId: string;
}

export interface TokenDisplayProps {
  token: TokenData;
  onClick?: () => void;
  showBalance?: boolean;
  isMobile?: boolean;
  formatUsdValue?: (usdValue: string) => string;
  walletIcons?: WalletIcon[];
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  token,
  onClick,
  showBalance = false,
  isMobile = false,
  formatUsdValue,
  walletIcons,
}) => {
  return (
    <Box mx="12px" cursor={onClick ? "pointer" : "default"} onClick={onClick}>
      <Flex
        align="center"
        py="12px"
        px="12px"
        letterSpacing="-0.6px"
        borderRadius="12px"
        bg="#131313"
        transition="background 0.15s ease"
        _hover={{ bg: onClick ? "#1f1f1f" : "#131313" }}
      >
        {/* Token Icon with Network Badge and Wallet Badges */}
        <Box position="relative" mr="12px">
          <Flex
            w="40px"
            h="40px"
            borderRadius="50%"
            bg="#404040"
            align="center"
            justify="center"
            overflow="hidden"
          >
            <Image
              src={token.icon}
              w="100%"
              h="100%"
              alt={`${token.ticker} icon`}
              objectFit="cover"
            />
          </Flex>

          {/* Wallet Badges (optional, shown in combined wallet view) */}
          {walletIcons && walletIcons.length > 0 && (
            <Flex position="absolute" top="-4px" left="-4px">
              {walletIcons.slice(0, 3).map((walletIcon, iconIdx) => (
                <Box
                  key={walletIcon.walletId}
                  w="16px"
                  h="16px"
                  borderRadius="4px"
                  ml={iconIdx > 0 ? "-6px" : "0"}
                  border={`2px solid ${colors.offBlack}`}
                  bg={colors.offBlackLighter}
                  overflow="hidden"
                  zIndex={3 - iconIdx}
                >
                  <Image
                    src={`${DYNAMIC_ICON_BASE}#${walletIcon.iconKey}`}
                    alt="wallet"
                    w="100%"
                    h="100%"
                    objectFit="cover"
                  />
                </Box>
              ))}
            </Flex>
          )}

          {/* Network Badge */}
          {token.chainId !== undefined && (
            <Box
              position="absolute"
              bottom="-2px"
              right="-2px"
              w="20px"
              h="20px"
              borderRadius="50%"
              bg={token.chainId === 0 ? "#F7931A" : token.chainId === 8453 ? "white" : "#1a1a2e"}
              border="2px solid #131313"
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              p={token.chainId === 0 ? "2px" : "0"}
            >
              <NetworkBadge chainId={token.chainId} />
            </Box>
          )}
        </Box>

        {/* Token Info */}
        <Flex direction="column" flex="1">
          <Text fontSize="16px" fontFamily="Inter" color={colors.offWhite} fontWeight="500">
            {token.ticker}
          </Text>
          <Flex align="center" gap="8px">
            <Text fontSize="12px" fontFamily="Inter" color={colors.textGray}>
              {CHAIN_NAMES[token.chainId] || "Unknown"}
            </Text>
            {!isMobile && token.address && token.ticker !== "BTC" && token.ticker !== "ETH" && (
              <Text fontSize="12px" fontFamily="Inter" color={colors.darkerGray}>
                {`${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
              </Text>
            )}
          </Flex>
        </Flex>

        {/* Balance Info - show when showBalance is true and balance > 0 */}
        {showBalance && token.balance !== "0" && (
          <Flex direction="column" align="flex-end">
            <Text
              fontSize="16px"
              fontFamily="Inter"
              color={colors.offWhite}
              fontWeight="500"
              letterSpacing="0.5px"
            >
              {formatUsdValue ? formatUsdValue(token.usdValue) : token.usdValue}
            </Text>
            <Text fontSize="12px" fontFamily="Inter" color={colors.textGray}>
              {parseFloat(token.balance).toFixed(4)} {token.ticker}
            </Text>
          </Flex>
        )}
      </Flex>
    </Box>
  );
};
