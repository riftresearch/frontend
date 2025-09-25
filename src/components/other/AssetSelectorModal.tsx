import {
  Flex,
  Text,
  Box,
  Image,
  Portal,
} from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { BASE_LOGO } from "./SVGs";
import { useState } from "react";

interface AssetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: string) => void;
  currentAsset: string;
}

type Network = 'ethereum' | 'base';

const POPULAR_TOKENS = [
  { symbol: "ETH", name: "Ethereum", icon: "ETH" },
  { symbol: "USDC", name: "USD Coin", icon: "USDC" },
  { symbol: "USDT", name: "Tether USD", icon: "USDT" },
  { symbol: "WBTC", name: "Wrapped Bitcoin", icon: "WBTC" },
  { symbol: "WETH", name: "Wrapped Ethereum", icon: "WETH" },
  { symbol: "CBBTC", name: "Coinbase Bitcoin", icon: "BTC" },
];

interface UserToken {
  name: string;
  ticker: string;
  address: string | null;
  balance: string;
  usdValue: string;
  icon: string;
}

export const AssetSelectorModal: React.FC<AssetSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectAsset,
  currentAsset,
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum');
  
  // Hard-coded user tokens for now - can be replaced with actual wallet data
  const [userTokens] = useState<UserToken[]>([
    {
      name: "Succinct",
      ticker: "PROVE",
      address: "0x6BEF...ad29",
      balance: "2,444",
      usdValue: "$1,894.16",
      icon: "PROVE"
    },
    {
      name: "Ethereum",
      ticker: "ETH",
      address: null,
      balance: "0.26148",
      usdValue: "$1,071.89",
      icon: "ETH"
    },
    {
      name: "USD Coin",
      ticker: "USDC",
      address: "0xA0b8...eB48",
      balance: "189.815",
      usdValue: "$189.72",
      icon: "USDC"
    },
    {
      name: "Coinbase Wrapped BTC",
      ticker: "cbBTC",
      address: "0xcbB7...33Bf",
      balance: "0.00009",
      usdValue: "$10.65",
      icon: "BTC"
    }
  ]);
  
  if (!isOpen) return null;

  const handleAssetSelect = (asset: string) => {
    onSelectAsset(asset);
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
        onClick={onClose}
      >
        <Box
          bg="#1a1a1a"
          borderRadius="20px"
          p="24px"
          maxW="520px"
          w="90%"
          maxH="80vh"
          overflowY="auto"
          border="2px solid #323232"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Flex justify="space-between" align="center" mb="20px">
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              fontWeight="bold"
            >
              Select a network
            </Text>
            <Box
              cursor="pointer"
              onClick={onClose}
              fontSize="24px"
              color={colors.textGray}
              _hover={{ color: colors.offWhite }}
            >
              ×
            </Box>
          </Flex>

          {/* Network Selector */}
          <Flex gap="12px" mb="20px">
            <Flex
              direction="column"
              align="center"
              justify="center"
              flex="1"
              h="80px"
              borderRadius="12px"
              border={`2px solid ${selectedNetwork === 'ethereum' ? '#8B5CF6' : '#404040'}`}
              bg={selectedNetwork === 'ethereum' ? 'rgba(139, 92, 246, 0.2)' : '#2a2a2a'}
              cursor="pointer"
              onClick={() => setSelectedNetwork('ethereum')}
              _hover={{ bg: selectedNetwork === 'ethereum' ? 'rgba(139, 92, 246, 0.3)' : '#333' }}
            >
              <Box mb="8px" display="flex" alignItems="center" justifyContent="center">
                <Image
                  src="/images/assets/icons/ETH.svg"
                  w="24px"
                  h="24px"
                  alt="Ethereum"
                  objectFit="contain"
                />
              </Box>
              <Text
                fontSize="14px"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                color={colors.offWhite}
                fontWeight="bold"
              >
                Ethereum
              </Text>
            </Flex>
            <Flex
              direction="column"
              align="center"
              justify="center"
              flex="1"
              h="80px"
              borderRadius="12px"
              border={`2px solid ${selectedNetwork === 'base' ? '#0052FF' : '#404040'}`}
              bg={selectedNetwork === 'base' ? 'rgba(0, 82, 255, 0.2)' : '#2a2a2a'}
              cursor="pointer"
              onClick={() => setSelectedNetwork('base')}
              _hover={{ bg: selectedNetwork === 'base' ? 'rgba(0, 82, 255, 0.3)' : '#333' }}
            >
              <Box mb="8px">
                <BASE_LOGO width="24" height="24" />
              </Box>
              <Text
                fontSize="14px"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                color={colors.offWhite}
                fontWeight="bold"
              >
                Base
              </Text>
            </Flex>
          </Flex>

          {/* Your Tokens Section */}
          <Text
            fontSize="16px"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colors.offWhite}
            fontWeight="bold"
            mb="12px"
          >
            Your tokens
          </Text>
          
          <Flex direction="column" gap="8px" mb="20px">
            {/* User wallet tokens */}
            {userTokens.length === 0 ? (
              <Flex
                align="center"
                justify="center"
                h="60px"
                borderRadius="12px"
                bg="#2a2a2a"
                border="1px solid #404040"
              >
                <Text
                  fontSize="14px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.textGray}
                >
                  None
                </Text>
              </Flex>
            ) : (
              userTokens.map((token, index) => (
              <Flex
                key={index}
                align="center"
                p="12px 16px"
                borderRadius="12px"
                bg="#2a2a2a"
                border="1px solid #404040"
                cursor="pointer"
                _hover={{ bg: "#333" }}
                onClick={() => handleAssetSelect(token.ticker)}
              >
                {/* Token Icon */}
                <Flex
                  w="40px"
                  h="40px"
                  borderRadius="50%"
                  bg="#4A90E2"
                  align="center"
                  justify="center"
                  mr="12px"
                >
                  <Image
                    src={`/images/assets/icons/${token.icon}.svg`}
                    w="24px"
                    h="24px"
                    alt={`${token.ticker} icon`}
                    objectFit="contain"
                  />
                </Flex>

                {/* Token Info */}
                <Flex direction="column" flex="1">
                  <Text
                    fontSize="16px"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    color={colors.offWhite}
                    fontWeight="bold"
                  >
                    {token.name}
                  </Text>
                  <Flex align="center" gap="8px">
                    <Text
                      fontSize="14px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                    >
                      {token.ticker}
                    </Text>
                    {token.address && (
                      <Text
                        fontSize="14px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.textGray}
                      >
                        {token.address}
                      </Text>
                    )}
                  </Flex>
                </Flex>

                {/* Balance Info */}
                <Flex direction="column" align="flex-end">
                  <Text
                    fontSize="16px"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    color={colors.offWhite}
                    fontWeight="bold"
                  >
                    {token.usdValue}
                  </Text>
                  <Text
                    fontSize="14px"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color={colors.textGray}
                  >
                    {token.balance}
                  </Text>
                </Flex>
              </Flex>
              ))
            )}
          </Flex>

          {/* Search Bar */}
          <Flex
            bg="#2a2a2a"
            borderRadius="12px"
            p="12px 16px"
            mb="20px"
            align="center"
            border="1px solid #404040"
          >
            <Box mr="12px" color={colors.textGray}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </Box>
            <Text
              color={colors.textGray}
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
            >
              Search tokens
            </Text>
          </Flex>

          {/* Popular Label */}
          <Text
            fontSize="16px"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colors.offWhite}
            fontWeight="bold"
            mb="12px"
          >
            Popular
          </Text>

          {/* Token Grid - Square Boxes */}
          <Flex gap="8px" flexWrap="nowrap" justify="space-between">
            {POPULAR_TOKENS.map((token) => {
              const isSelected = token.symbol === currentAsset;
              const colorKey = token.symbol === "WBTC" ? "btc" : token.symbol.toLowerCase();
              const bgColor = colors.assetTag[colorKey as keyof typeof colors.assetTag]?.background || "#255283";
              const borderColor = colors.assetTag[colorKey as keyof typeof colors.assetTag]?.border || "#4A90E2";

              return (
                <Flex
                  key={token.symbol}
                  direction="column"
                  align="center"
                  p="12px"
                  w="70px"
                  h="70px"
                  borderRadius="12px"
                  cursor="pointer"
                  bg={isSelected ? "rgba(68, 91, 203, 0.2)" : "#2a2a2a"}
                  border={isSelected ? "2px solid #445BCB" : "1px solid #404040"}
                  _hover={{
                    bg: isSelected ? "rgba(68, 91, 203, 0.3)" : "rgba(255, 255, 255, 0.05)",
                    border: isSelected ? "2px solid #445BCB" : "1px solid #666",
                  }}
                  onClick={() => handleAssetSelect(token.symbol)}
                >
                  {/* Token Icon */}
                  <Flex
                    w="28px"
                    h="28px"
                    borderRadius="50%"
                    align="center"
                    justify="center"
                    mb="6px"
                    overflow="hidden"
                  >
                    <Image
                      src={`/images/assets/icons/${token.icon}.svg`}
                      w="28px"
                      h="28px"
                      alt={`${token.symbol} icon`}
                      objectFit="cover"
                    />
                  </Flex>

                  {/* Token Symbol */}
                  <Text
                    fontSize="11px"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    color={colors.offWhite}
                    fontWeight="bold"
                    textAlign="center"
                  >
                    {token.symbol}
                  </Text>
                </Flex>
              );
            })}
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
};
