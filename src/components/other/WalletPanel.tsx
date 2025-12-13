import React, { useState } from "react";
import { Flex, Text, Box, Image, Spinner } from "@chakra-ui/react";
import { useAccount } from "wagmi";
import { useDynamicContext, useUserWallets, useDynamicModals } from "@dynamic-labs/sdk-react-core";
import { FiCopy, FiCheck } from "react-icons/fi";
import { useStore } from "@/utils/store";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { FALLBACK_TOKEN_ICON } from "@/utils/constants";
import { toastSuccess } from "@/utils/toast";
import type { TokenData } from "@/utils/types";

// Chain ID to network name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
  56: "BNB",
};

// Chain ID to logo mapping
const CHAIN_LOGOS: Record<number, string> = {
  1: "/images/eth_logo.png",
  8453: "/images/base_logo.svg",
  42161: "/images/arbitrum_logo.svg",
  10: "/images/optimism_logo.svg",
  137: "/images/polygon_logo.svg",
  56: "/images/bnb_logo.svg",
};

// Dynamic's icon sprite URL
const DYNAMIC_ICON_BASE = "https://iconic.dynamic-static-assets.com/icons/sprite.svg";

interface WalletPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectNewWallet?: () => void;
}

export const WalletPanel: React.FC<WalletPanelProps> = ({
  isOpen,
  onClose,
  onConnectNewWallet,
}) => {
  const { address: evmAddress } = useAccount();
  const { handleLogOut, setShowAuthFlow, primaryWallet } = useDynamicContext();
  // setShowLinkNewWalletModal is from useDynamicModals hook (for adding wallets when already connected)
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const userWallets = useUserWallets();
  const { userTokensByChain } = useStore();
  const [activeTab, setActiveTab] = useState<"tokens" | "activity">("tokens");
  const [showWalletsOverlay, setShowWalletsOverlay] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Get all tokens from all chains
  const allTokens: TokenData[] = Object.values(userTokensByChain).flat();

  // Sort by USD value
  const sortedTokens = [...allTokens].sort((a, b) => {
    const usdA = parseFloat(a.usdValue.replace("$", "").replace(",", ""));
    const usdB = parseFloat(b.usdValue.replace("$", "").replace(",", ""));
    return usdB - usdA;
  });

  // Calculate total USD value
  const totalUsdValue = sortedTokens.reduce((sum, token) => {
    const usd = parseFloat(token.usdValue.replace("$", "").replace(",", ""));
    return sum + (isNaN(usd) ? 0 : usd);
  }, 0);

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get wallet icon key for Dynamic sprite - use connector name directly
  const getWalletIconKey = (wallet: any): string => {
    return wallet.connector?.name?.toLowerCase() || wallet.key?.toLowerCase() || "walletconnect";
  };

  // Get wallet chain type
  const getWalletChainType = (wallet: any): string => {
    if (wallet.chain === "EVM" || wallet.chain === "evm") return "EVM";
    if (wallet.chain === "BTC" || wallet.chain === "bitcoin") return "BVM";
    return wallet.chain || "Unknown";
  };

  // Copy address to clipboard
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      toastSuccess({ title: "Address Copied", description: address });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  // Disconnect a specific wallet
  const disconnectWallet = async (wallet: any) => {
    try {
      await wallet.disconnect();
    } catch (err) {
      console.error("Failed to disconnect wallet:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top="0"
      right="0"
      bottom="0"
      width={{ base: "100%", md: "380px" }}
      bg={colors.offBlack}
      borderLeft={`1px solid ${colors.borderGray}`}
      zIndex={1000}
      overflowY="auto"
    >
      {/* Wallets Overlay */}
      {showWalletsOverlay && (
        <>
          {/* Overlay Backdrop */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bg="rgba(0,0,0,0.7)"
            zIndex={1001}
            onClick={() => setShowWalletsOverlay(false)}
          />
          {/* Wallets Modal */}
          <Box position="absolute" w="100%" bg={colors.offBlack} zIndex={1002} overflow="hidden">
            {/* Modal Header */}
            <Flex
              p="16px"
              align="center"
              justify="space-between"
              borderBottom={`1px solid ${colors.borderGray}`}
            >
              {/* Wallets Dropdown (clickable to close) */}
              <Flex
                bg={colors.offBlackLighter}
                borderRadius="20px"
                px="12px"
                py="6px"
                align="center"
                gap="8px"
                cursor="pointer"
                onClick={() => setShowWalletsOverlay(false)}
                _hover={{ bg: "#2b2b2b" }}
              >
                {/* Wallet Icons */}
                <Flex>
                  {userWallets.slice(0, 3).map((wallet, idx) => (
                    <Box
                      key={wallet.id}
                      w="20px"
                      h="20px"
                      borderRadius="full"
                      ml={idx > 0 ? "-6px" : "0"}
                      border={`2px solid ${colors.offBlack}`}
                      bg={colors.offBlackLighter}
                      overflow="hidden"
                    >
                      <Image
                        src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                        alt="wallet"
                        w="20px"
                        h="20px"
                      />
                    </Box>
                  ))}
                </Flex>
                <Text
                  color={colors.offWhite}
                  fontSize="14px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  letterSpacing="-0.5px"
                >
                  {userWallets.length} Wallet{userWallets.length !== 1 ? "s" : ""}
                </Text>
                <Text color={colors.textGray} fontSize="12px">
                  ▲
                </Text>
              </Flex>
              <Box
                cursor="pointer"
                onClick={() => setShowWalletsOverlay(false)}
                p="8px"
                w="40px"
                h="40px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="8px"
                _hover={{ bg: "#2b2b2b" }}
              >
                <Text color={colors.offWhite} fontSize="20px">
                  ✕
                </Text>
              </Box>
            </Flex>

            {/* Wallet List */}
            <Box p="12px" maxH="400px" overflowY="auto" bg="rgba(0, 0, 0, 0.25)">
              {userWallets.map((wallet) => (
                <Box
                  key={wallet.id}
                  p="16px"
                  mb="8px"
                  borderRadius="12px"
                  border={`1px solid ${colors.borderGray}`}
                  bg={primaryWallet?.address === wallet.address ? "#202020" : colors.offBlack}
                >
                  {/* Wallet Info Row */}
                  <Flex align="center" justify="space-between" mb="12px">
                    <Flex align="center" gap="10px">
                      <Image
                        src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                        alt="wallet"
                        w="28px"
                        h="28px"
                        borderRadius="full"
                      />
                      <Flex direction="column">
                        {/* Address as clickable copy button */}
                        <Flex
                          align="center"
                          gap="6px"
                          cursor="pointer"
                          onClick={() => copyAddress(wallet.address)}
                          bg={colors.offBlackLighter}
                          px="10px"
                          py="6px"
                          borderRadius="8px"
                          _hover={{ bg: colors.offBlackLighter2 }}
                        >
                          <Text
                            color={colors.offWhite}
                            fontSize="14px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            letterSpacing="-0.5px"
                          >
                            {formatAddress(wallet.address)}
                          </Text>
                          {copiedAddress === wallet.address ? (
                            <FiCheck size={14} color={colors.greenOutline} />
                          ) : (
                            <FiCopy size={14} color={colors.textGray} />
                          )}
                        </Flex>
                        <Flex align="center" gap="6px" mt="6px">
                          <Box px="6px" py="2px" borderRadius="4px" bg={colors.offBlackLighter2}>
                            <Text color={colors.textGray} fontSize="10px" fontWeight="500">
                              {getWalletChainType(wallet)}
                            </Text>
                          </Box>
                          {primaryWallet?.address === wallet.address && (
                            <Flex align="center" gap="4px">
                              <Box w="6px" h="6px" borderRadius="full" bg={colors.greenOutline} />
                              <Text color={colors.greenOutline} fontSize="10px">
                                Active
                              </Text>
                            </Flex>
                          )}
                        </Flex>
                      </Flex>
                    </Flex>
                    {/* Right side: Balance + Disconnect */}
                    <Flex direction="column" align="flex-end" gap="4px">
                      {/* Wallet Balance */}
                      <Text
                        color={colors.textGray}
                        fontSize="14px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        letterSpacing="-0.5px"
                      >
                        {getWalletChainType(wallet) === "EVM"
                          ? `$${totalUsdValue.toFixed(2)}`
                          : "$0.00"}
                      </Text>
                      {/* Disconnect text link */}
                      <Text
                        color="#F87171"
                        fontSize="12px"
                        fontWeight="500"
                        cursor="pointer"
                        _hover={{ color: "#FCA5A5" }}
                        onClick={() => disconnectWallet(wallet)}
                      >
                        Disconnect
                      </Text>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Box>

            {/* Connect New Wallet Button */}
            <Box p="12px" borderTop={`1px solid ${colors.borderGray}`}>
              <Flex
                justify="center"
                align="center"
                py="12px"
                borderRadius="14px"
                bg="rgba(28, 97, 253, 0.06)"
                border={`2px solid rgb(76, 126, 201)`}
                cursor="pointer"
                _hover={{ bg: "rgba(28, 97, 253, 0.2)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log(
                    "[WalletPanel] Connect New Wallet clicked - using setShowLinkNewWalletModal"
                  );
                  setShowWalletsOverlay(false);
                  // Use setShowLinkNewWalletModal from useDynamicModals hook
                  setShowLinkNewWalletModal(true);
                }}
              >
                <Text color="rgb(76, 126, 201)" fontSize="14px" fontWeight="600">
                  Connect a New Wallet
                </Text>
              </Flex>
            </Box>
          </Box>
        </>
      )}

      {/* Header */}
      <Flex
        p="16px"
        borderBottom={`1px solid ${colors.borderGray}`}
        align="center"
        justify="space-between"
      >
        {/* Connected Wallets Dropdown */}
        <Flex
          bg={colors.offBlackLighter}
          borderRadius="20px"
          px="12px"
          py="6px"
          align="center"
          gap="8px"
          cursor="pointer"
          onClick={() => setShowWalletsOverlay(true)}
          _hover={{ bg: "#2b2b2b" }}
        >
          {/* Wallet Icons */}
          <Flex>
            {userWallets.slice(0, 3).map((wallet, idx) => (
              <Box
                key={wallet.id}
                w="20px"
                h="20px"
                borderRadius="full"
                ml={idx > 0 ? "-6px" : "0"}
                border={`2px solid ${colors.offBlack}`}
                bg={colors.offBlackLighter}
                overflow="hidden"
              >
                <Image
                  src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                  alt="wallet"
                  w="20px"
                  h="20px"
                />
              </Box>
            ))}
          </Flex>
          <Text
            color={colors.offWhite}
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            letterSpacing="-0.5px"
          >
            {userWallets.length} Wallet{userWallets.length !== 1 ? "s" : ""}
          </Text>
          <Text color={colors.textGray} fontSize="12px">
            ▼
          </Text>
        </Flex>

        {/* Close Button */}
        <Box
          cursor="pointer"
          onClick={onClose}
          p="8px"
          w="40px"
          h="40px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="8px"
          _hover={{ bg: "#2b2b2b" }}
        >
          <Text color={colors.offWhite} fontSize="20px">
            ✕
          </Text>
        </Box>
      </Flex>

      {/* Total Value */}
      <Flex p="20px" direction="column" gap="4px">
        <Flex align="center" gap="8px">
          <Text
            color={colors.offWhite}
            fontSize="32px"
            fontWeight="bold"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            letterSpacing="-4px"
          >
            $
            {totalUsdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
          <Box cursor="pointer" p="4px" borderRadius="full" _hover={{ bg: "#2b2b2b" }}>
            <Text color={colors.textGray} fontSize="16px">
              ↻
            </Text>
          </Box>
        </Flex>
      </Flex>

      {/* Tabs */}
      <Flex px="20px" gap="24px" borderBottom={`1px solid ${colors.borderGray}`}>
        <Text
          color={activeTab === "tokens" ? colors.offWhite : colors.textGray}
          fontSize="14px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
          pb="12px"
          borderBottom={activeTab === "tokens" ? `2px solid ${colors.offWhite}` : "none"}
          cursor="pointer"
          onClick={() => setActiveTab("tokens")}
        >
          Tokens
        </Text>
        <Text
          color={activeTab === "activity" ? colors.offWhite : colors.textGray}
          fontSize="14px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          letterSpacing="-0.5px"
          pb="12px"
          borderBottom={activeTab === "activity" ? `2px solid ${colors.offWhite}` : "none"}
          cursor="pointer"
          onClick={() => setActiveTab("activity")}
        >
          Activity
        </Text>
      </Flex>

      {/* Token List */}
      {activeTab === "tokens" && (
        <Box p="12px">
          {sortedTokens.length === 0 ? (
            <Flex justify="center" align="center" py="40px">
              <Spinner color={colors.offWhite} size="lg" />
            </Flex>
          ) : (
            <Flex direction="column" gap="4px">
              {sortedTokens.map((token, idx) => (
                <Flex
                  key={`${token.address}-${token.chainId}-${idx}`}
                  p="12px"
                  borderRadius="12px"
                  align="center"
                  justify="space-between"
                  cursor="pointer"
                  _hover={{ bg: colors.offBlackLighter }}
                >
                  {/* Token Icon & Info */}
                  <Flex align="center" gap="12px">
                    <Box position="relative">
                      <Image
                        src={token.icon || FALLBACK_TOKEN_ICON}
                        alt={token.ticker}
                        w="40px"
                        h="40px"
                        borderRadius="full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_TOKEN_ICON;
                        }}
                      />
                      {/* Chain Badge */}
                      {token.chainId && CHAIN_LOGOS[token.chainId] && (
                        <Image
                          src={CHAIN_LOGOS[token.chainId]}
                          alt={CHAIN_NAMES[token.chainId]}
                          w="16px"
                          h="16px"
                          position="absolute"
                          bottom="-2px"
                          right="-2px"
                          borderRadius="full"
                          border={`2px solid ${colors.offBlack}`}
                          bg={colors.offBlack}
                        />
                      )}
                    </Box>
                    <Flex direction="column">
                      <Text
                        color={colors.offWhite}
                        fontSize="16px"
                        fontWeight="500"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        letterSpacing="-0.5px"
                      >
                        {token.ticker}
                      </Text>
                      <Text
                        color={colors.textGray}
                        fontSize="12px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        letterSpacing="-0.5px"
                      >
                        {CHAIN_NAMES[token.chainId] || "Unknown"}
                      </Text>
                    </Flex>
                  </Flex>

                  {/* Token Value */}
                  <Flex direction="column" align="flex-end">
                    <Text
                      color={colors.offWhite}
                      fontSize="16px"
                      fontWeight="500"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      letterSpacing="-0.5px"
                    >
                      {token.usdValue}
                    </Text>
                    <Text
                      color={colors.textGray}
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      letterSpacing="-0.5px"
                    >
                      {parseFloat(token.balance).toFixed(4)} {token.ticker}
                    </Text>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <Flex justify="center" align="center" py="60px">
          <Text color={colors.textGray} fontSize="14px">
            No recent activity
          </Text>
        </Flex>
      )}
    </Box>
  );
};
