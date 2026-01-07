import React, { useState } from "react";
import { Flex, Text, Box, Image, Spinner } from "@chakra-ui/react";
import { useAccount } from "wagmi";
import {
  useDynamicContext,
  useUserWallets,
  useDynamicModals,
  useSwitchWallet,
} from "@dynamic-labs/sdk-react-core";
import {
  FiCopy,
  FiCheck,
  FiChevronsRight,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiX,
} from "react-icons/fi";
import { useStore } from "@/utils/store";
import { colors } from "@/utils/colors";
import { FALLBACK_TOKEN_ICON } from "@/utils/constants";
import { toastSuccess } from "@/utils/toast";
import type { TokenData } from "@/utils/types";
import useWindowSize from "@/hooks/useWindowSize";

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
  1: "/images/icons/Ethereum.svg",
  8453: "/images/base_logo.svg",
  42161: "/images/arbitrum_logo.svg",
  10: "/images/optimism_logo.svg",
  137: "/images/polygon_logo.svg",
  56: "/images/bnb_logo.svg",
};

// Chain type to logo mapping (for wallet badges)
const CHAIN_TYPE_LOGOS: Record<string, string> = {
  EVM: "/images/icons/Ethereum.svg",
  BVM: "/images/assets/icons/BTC.svg",
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
  const { handleLogOut, setShowAuthFlow, primaryWallet, removeWallet } = useDynamicContext();
  // setShowLinkNewWalletModal is from useDynamicModals hook (for adding wallets when already connected)
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const userWallets = useUserWallets();
  const switchWallet = useSwitchWallet();
  const { userTokensByChain } = useStore();
  const { isMobile } = useWindowSize();
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
      // If this is the only wallet, log out entirely
      if (userWallets.length <= 1) {
        await handleLogOut();
      } else {
        await removeWallet(wallet.id);
      }
    } catch (err) {
      console.error("Failed to disconnect wallet:", err);
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobile && isOpen && (
        <Box
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="rgba(0,0,0,0.5)"
          zIndex={999}
          onClick={onClose}
        />
      )}
      <Box
        position="fixed"
        top={isMobile ? "0" : "6px"}
        right={isMobile ? "0" : "6px"}
        bottom={isMobile ? "0" : "6px"}
        height={isMobile ? "100vh" : "auto"}
        width={{ base: "100%", md: "418px" }}
        zIndex={1000}
        transform={isOpen ? "translateX(0)" : "translateX(100%)"}
        transition="transform 0.3s ease-in-out"
        display="flex"
        flexDirection="column"
        pointerEvents={isOpen ? "auto" : "none"}
      >
        {/* Left Edge Close Panel - hidden on mobile */}
        {!isMobile && (
          <Box
            position="absolute"
            left="-58px"
            top="0"
            bottom="0"
            width="74px"
            bg="transparent"
            cursor="pointer"
            display="flex"
            alignItems="flex-start"
            justifyContent="center"
            pr="16px"
            pt="18px"
            borderLeftRadius="16px"
            _hover={{ bg: "rgba(255, 255, 255, 0.08)" }}
            onClick={onClose}
            transition="background 0.15s ease"
            zIndex={999}
            pointerEvents={isOpen ? "auto" : "none"}
          >
            <FiChevronsRight size={26} color={colors.textGray} />
          </Box>
        )}

        {/* Main Panel Content */}
        <Box
          flex="1"
          h={isMobile ? "100%" : "auto"}
          bg={colors.offBlack}
          border={isMobile ? "none" : `1px solid ${colors.borderGray}`}
          borderRadius={isMobile ? "0" : "16px"}
          overflowY="auto"
          position="relative"
          zIndex={1001}
        >
          {/* Wallets Overlay */}
          {showWalletsOverlay && (
            <>
              {/* Overlay Backdrop - blurs underlying content */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="rgba(0,0,0,0.5)"
                backdropFilter="blur(8px)"
                zIndex={1001}
                borderRadius="16px"
                onClick={() => setShowWalletsOverlay(false)}
              />
              {/* Wallets Modal - slides down from top */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bg={colors.offBlack}
                zIndex={1002}
                overflow="hidden"
                borderBottomRadius="16px"
              >
                {/* Modal Header */}
                <Flex
                  p="16px"
                  align="center"
                  justify="space-between"
                  borderBottom={`1px solid ${colors.borderGray}`}
                >
                  {/* Wallets Dropdown (clickable to close) */}
                  <Flex
                    bg="#242424"
                    borderRadius="12px"
                    px="12px"
                    py="8px"
                    align="center"
                    gap="8px"
                    transition="all 0.2s ease-in-out"
                    cursor="pointer"
                    onClick={() => setShowWalletsOverlay(false)}
                    _hover={{ bg: "#2b2b2b" }}
                  >
                    {/* Wallet Icons */}
                    <Flex>
                      {userWallets.slice(0, 3).map((wallet, idx) => (
                        <Box
                          key={wallet.id}
                          w="22px"
                          h="22px"
                          borderRadius="4px"
                          ml={idx > 0 ? "-2px" : "0"}
                          border={`2px solid ${colors.offBlack}`}
                          bg={colors.offBlackLighter}
                          overflow="hidden"
                        >
                          <Image
                            src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                            alt="wallet"
                            w="100%"
                            h="100%"
                            objectFit="cover"
                          />
                        </Box>
                      ))}
                    </Flex>
                    <Text
                      color={colors.offWhite}
                      fontSize="15px"
                      fontWeight={500}
                      fontFamily="Inter"
                    >
                      {userWallets.length} Wallet{userWallets.length !== 1 ? "s" : ""}
                    </Text>
                    <FiChevronUp size={16} color={colors.textGray} />
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
                    transition="all 0.2s ease-in-out"
                    borderRadius="8px"
                    _hover={{ bg: "#202020" }}
                  >
                    <Text color={colors.offWhite} fontSize="20px">
                      ✕
                    </Text>
                  </Box>
                </Flex>

                {/* Wallet List */}
                <Box p="12px" maxH="400px" overflowY="auto">
                  {userWallets.map((wallet) => (
                    <Box
                      key={wallet.id}
                      p="16px"
                      mb="8px"
                      borderRadius="12px"
                      border={`2px solid ${colors.borderGray}`}
                      bg={primaryWallet?.address === wallet.address ? "#202020" : colors.offBlack}
                    >
                      {/* Top Row: Icon, Address, Balance */}
                      <Flex align="center" justify="space-between" mb="12px">
                        <Flex align="center" gap="12px">
                          {/* Wallet Icon - larger and not clipped */}
                          <Box
                            w="40px"
                            h="40px"
                            borderRadius="8px"
                            overflow="hidden"
                            flexShrink={0}
                          >
                            <Image
                              src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                              alt="wallet"
                              w="100%"
                              h="100%"
                              objectFit="contain"
                            />
                          </Box>
                          {/* Address with copy button */}
                          <Flex
                            align="center"
                            gap="8px"
                            cursor="pointer"
                            onClick={() => copyAddress(wallet.address)}
                            _hover={{ opacity: 0.8 }}
                          >
                            <Text
                              color={colors.offWhite}
                              fontSize="18px"
                              fontWeight="600"
                              fontFamily="Inter"
                            >
                              {formatAddress(wallet.address)}
                            </Text>
                            {copiedAddress === wallet.address ? (
                              <FiCheck size={16} color={colors.greenOutline} />
                            ) : (
                              <FiCopy size={16} color={colors.textGray} />
                            )}
                          </Flex>
                        </Flex>
                        {/* Balance */}
                        <Text
                          color={colors.offWhite}
                          fontSize="18px"
                          fontWeight="600"
                          fontFamily="Inter"
                        >
                          {getWalletChainType(wallet) === "EVM"
                            ? `$${totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "$0.00"}
                        </Text>
                      </Flex>

                      {/* Bottom Row: Chain Badge, Select Wallet, Disconnect */}
                      <Flex align="center" justify="space-between">
                        <Flex align="center" gap="8px">
                          {/* Chain Badge with Icon */}
                          <Flex
                            align="center"
                            gap="6px"
                            px="8px"
                            py="4px"
                            borderRadius="6px"
                            bg={
                              getWalletChainType(wallet) === "EVM"
                                ? "rgba(57, 74, 255, 0.15)"
                                : "rgba(247, 147, 26, 0.15)"
                            }
                          >
                            {CHAIN_TYPE_LOGOS[getWalletChainType(wallet)] && (
                              <Box
                                w="14px"
                                h="14px"
                                borderRadius="full"
                                overflow="hidden"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                bg={
                                  getWalletChainType(wallet) === "EVM" ? colors.RiftBlue : "#F7931A"
                                }
                                p="2px"
                              >
                                <Image
                                  src={CHAIN_TYPE_LOGOS[getWalletChainType(wallet)]}
                                  alt="chain"
                                  w="100%"
                                  h="100%"
                                  objectFit="contain"
                                />
                              </Box>
                            )}
                            <Text
                              color={
                                getWalletChainType(wallet) === "EVM"
                                  ? "rgba(120, 140, 255, 1)"
                                  : "rgba(247, 170, 80, 1)"
                              }
                              fontSize="12px"
                              fontWeight="600"
                              fontFamily="Inter"
                            >
                              {getWalletChainType(wallet)}
                            </Text>
                          </Flex>
                          {/* Active indicator or Select Wallet */}
                          {primaryWallet?.address === wallet.address ? (
                            <Flex align="center" gap="4px">
                              <Box w="6px" h="6px" borderRadius="full" bg={colors.greenOutline} />
                              <Text
                                color={colors.greenOutline}
                                fontSize="12px"
                                fontWeight="500"
                                fontFamily="Inter"
                              >
                                Active
                              </Text>
                            </Flex>
                          ) : (
                            <Text
                              color="#A78BFA"
                              fontSize="14px"
                              fontWeight="500"
                              cursor="pointer"
                              fontFamily="Inter"
                              _hover={{ color: "#C4B5FD" }}
                              onClick={() => switchWallet(wallet.id)}
                            >
                              Select Wallet
                            </Text>
                          )}
                        </Flex>
                        {/* Action Buttons */}
                        <Flex align="center" gap="16px">
                          {/* Disconnect */}
                          <Text
                            color="#F87171"
                            fontSize="14px"
                            fontWeight="500"
                            cursor="pointer"
                            fontFamily="Inter"
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
                <Box px="12px" pt="0px" pb="21px">
                  <Flex
                    justify="center"
                    align="center"
                    py="12px"
                    borderRadius="12px"
                    bg="rgba(167, 139, 250, 0.06)"
                    transition="all 0.2s ease-in-out"
                    border="2px solid #A78BFA"
                    cursor="pointer"
                    _hover={{ bg: "rgba(167, 139, 250, 0.10)" }}
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
                    <Text color="#A78BFA" fontSize="16px" fontWeight="600" fontFamily="Inter">
                      Connect New Wallet
                    </Text>
                  </Flex>
                </Box>
              </Box>
            </>
          )}

          {/* Header */}
          <Flex
            p="16px"
            // borderBottom={`1px solid ${colors.borderGray}`}
            align="center"
            justify="space-between"
          >
            {/* Connected Wallets Dropdown */}
            <Flex
              bg={"#242424"}
              borderRadius="12px"
              px="12px"
              py="8px"
              align="center"
              gap="8px"
              cursor="pointer"
              transition="all 0.2s ease-in-out"
              onClick={() => setShowWalletsOverlay(true)}
              _hover={{ bg: "#2b2b2b" }}
            >
              {/* Wallet Icons */}
              <Flex>
                {userWallets.slice(0, 3).map((wallet, idx) => (
                  <Box
                    key={wallet.id}
                    w="22px"
                    h="22px"
                    borderRadius="4px"
                    ml={idx > 0 ? "-2px" : "0"}
                    border={`2px solid ${colors.offBlack}`}
                    bg={colors.offBlackLighter}
                    overflow="hidden"
                  >
                    <Image
                      src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                      alt="wallet"
                      w="100%"
                      h="100%"
                      objectFit="cover"
                    />
                  </Box>
                ))}
              </Flex>
              <Text color={colors.offWhite} fontSize="15px" fontWeight={500} fontFamily="Inter">
                {userWallets.length} Wallet{userWallets.length !== 1 ? "s" : ""}
              </Text>
              <FiChevronDown size={16} color={colors.textGray} />
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
              transition="all 0.2s ease-in-out"
              borderRadius="8px"
              _hover={{ bg: "#242424" }}
            >
              <Text color={colors.offerWhite} fontSize="20px">
                ✕
              </Text>
            </Box>
          </Flex>

          {/* Total Value */}
          <Flex px="20px" pb="16px" direction="column" gap="4px">
            <Flex align="center" gap="8px">
              <Text
                color={colors.offWhite}
                fontSize="34px"
                fontWeight="600"
                fontFamily="Inter"
                letterSpacing="-1px"
              >
                $
                {totalUsdValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Box
                cursor="pointer"
                w="32px"
                h="32px"
                borderRadius="full"
                bg={colors.offBlackLighter}
                display="flex"
                alignItems="center"
                justifyContent="center"
                _hover={{ bg: colors.offBlackLighter2 }}
              >
                <FiRefreshCw size={16} color={colors.textGray} />
              </Box>
            </Flex>
          </Flex>

          {/* Tabs */}
          <Flex px="20px" gap="24px" borderBottom={`1px solid ${colors.borderGray}`}>
            <Text
              color={activeTab === "tokens" ? colors.offWhite : colors.textGray}
              fontSize="15px"
              fontWeight={600}
              fontFamily="Inter"
              pb="12px"
              borderBottom={activeTab === "tokens" ? `2px solid ${colors.offWhite}` : "none"}
              cursor="pointer"
              onClick={() => setActiveTab("tokens")}
            >
              Tokens
            </Text>
            <Text
              color={activeTab === "activity" ? colors.offWhite : colors.textGray}
              fontSize="15px"
              fontWeight={600}
              fontFamily="Inter"
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
              {userWallets.length === 0 ? (
                <Flex direction="column" align="center" justify="center" py="40px" gap="20px">
                  <Text
                    color={colors.textGray}
                    fontSize="15px"
                    fontFamily="Inter"
                    textAlign="center"
                  >
                    You don't have any wallets connected yet
                  </Text>
                  <Flex
                    justify="center"
                    align="center"
                    py="12px"
                    px="24px"
                    borderRadius="12px"
                    bg="rgba(167, 139, 250, 0.08)"
                    border="2px solid #A78BFA"
                    cursor="pointer"
                    _hover={{ bg: "rgba(167, 139, 250, 0.18)" }}
                    onClick={() => setShowAuthFlow(true)}
                  >
                    <Text color="#A78BFA" fontSize="15px" fontWeight="600" fontFamily="Inter">
                      Connect Wallet
                    </Text>
                  </Flex>
                </Flex>
              ) : sortedTokens.length === 0 ? (
                <Flex direction="column" justify="center" align="center" py="40px" gap="8px">
                  <Text color={colors.textGray} fontSize="15px" fontFamily="Inter">
                    No tokens found
                  </Text>
                  <Text color={colors.textGray} fontSize="13px" fontFamily="Inter" opacity={0.7}>
                    This wallet doesn't have any token balances
                  </Text>
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
                            fontFamily="Inter"
                          >
                            {token.ticker}
                          </Text>
                          <Text color={colors.textGray} fontSize="12px" fontFamily="Inter">
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
                          fontFamily="Inter"
                          letterSpacing="0.5px"
                        >
                          {token.usdValue}
                        </Text>
                        <Text color={colors.textGray} fontSize="12px" fontFamily="Inter">
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
            <Flex direction="column" justify="center" align="center" py="60px" gap="20px">
              {userWallets.length === 0 ? (
                <>
                  <Text
                    color={colors.textGray}
                    fontSize="15px"
                    fontFamily="Inter"
                    textAlign="center"
                  >
                    You don't have any wallets connected yet
                  </Text>
                  <Flex
                    justify="center"
                    align="center"
                    py="12px"
                    px="24px"
                    borderRadius="12px"
                    bg="rgba(167, 139, 250, 0.08)"
                    border="2px solid #A78BFA"
                    cursor="pointer"
                    _hover={{ bg: "rgba(167, 139, 250, 0.18)" }}
                    onClick={() => setShowAuthFlow(true)}
                  >
                    <Text color="#A78BFA" fontSize="15px" fontWeight="600" fontFamily="Inter">
                      Connect Wallet
                    </Text>
                  </Flex>
                </>
              ) : (
                <Text color={colors.textGray} fontSize="15px" fontFamily="Inter">
                  No recent activity
                </Text>
              )}
            </Flex>
          )}
        </Box>
      </Box>
    </>
  );
};
