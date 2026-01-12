import React, { useState } from "react";
import { Flex, Text, Box, Image, Spinner, Portal } from "@chakra-ui/react";
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
  FiMaximize2,
} from "react-icons/fi";
import { UserSwapHistory } from "@/components/activity/UserSwapHistory";
import { useStore } from "@/utils/store";
import { colors } from "@/utils/colors";
import { useBitcoinBalances } from "@/hooks/useBitcoinBalance";
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
  const {
    userTokensByChain,
    btcPrice,
    isSwappingForBTC,
    setIsSwappingForBTC,
    setSelectedInputAddress,
    setSelectedOutputAddress,
    setSkipAddressClearOnDirectionChange,
  } = useStore();
  const { isMobile } = useWindowSize();

  // Get all BTC wallet addresses for balance fetching
  const btcWalletAddresses = userWallets
    .filter((wallet) => {
      const chain = wallet.chain?.toLowerCase();
      return chain === "btc" || chain === "bitcoin";
    })
    .map((wallet) => wallet.address);

  // Fetch balances for all BTC wallets
  const btcBalances = useBitcoinBalances(btcWalletAddresses);
  const [activeTab, setActiveTab] = useState<"tokens" | "activity">("tokens");
  const [showWalletsOverlay, setShowWalletsOverlay] = useState(false);
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // View mode: "all" for combined view, or wallet.id for specific wallet
  const [viewMode, setViewMode] = useState<"all" | string>("all");

  // Full-screen history modal state (desktop only)
  const [showFullHistory, setShowFullHistory] = useState(false);

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

  // Find EVM wallet for token attribution
  const evmWallet = userWallets.find((w) => w.chain?.toUpperCase() === "EVM");

  // Get all tokens from all chains (for EVM wallets) - only if EVM wallet is connected
  const allTokens: TokenData[] = evmWallet ? Object.values(userTokensByChain).flat() : [];

  // Sort EVM tokens by USD value
  const sortedEvmTokens = [...allTokens].sort((a, b) => {
    const usdA = parseFloat(a.usdValue.replace("$", "").replace(",", ""));
    const usdB = parseFloat(b.usdValue.replace("$", "").replace(",", ""));
    return usdB - usdA;
  });

  // Calculate EVM total USD value - only if EVM wallet is connected
  const evmTotalUsdValue = evmWallet
    ? sortedEvmTokens.reduce((sum, token) => {
        const usd = parseFloat(token.usdValue.replace("$", "").replace(",", ""));
        return sum + (isNaN(usd) ? 0 : usd);
      }, 0)
    : 0;

  // Get currently connected BTC wallet addresses
  const connectedBtcAddresses = userWallets
    .filter((w) => {
      const chain = w.chain?.toLowerCase();
      return chain === "btc" || chain === "bitcoin";
    })
    .map((w) => w.address);

  // Calculate total BTC balance only for currently connected BTC wallets
  const allBtcTotalUsd = connectedBtcAddresses.reduce((sum, addr) => {
    const balance = btcBalances[addr];
    if (balance?.balanceBtc) {
      return sum + balance.balanceBtc * (btcPrice || 0);
    }
    return sum;
  }, 0);

  // Interface for tokens with wallet attribution (supports multiple wallets for combined view)
  interface TokenWithWallet extends TokenData {
    walletAddress: string;
    walletIconKey: string;
    walletId: string;
    // For merged tokens in "all" view
    walletIcons?: { iconKey: string; walletId: string }[];
  }

  // Build combined token list for "all" view (merging same tokens from different wallets)
  const combinedTokens: TokenWithWallet[] = React.useMemo(() => {
    // Use a map to group tokens by unique key (ticker + chainId)
    const tokenMap = new Map<
      string,
      {
        token: TokenWithWallet;
        totalBalance: number;
        totalUsdValue: number;
        walletIcons: { iconKey: string; walletId: string }[];
      }
    >();

    // Add EVM tokens with wallet attribution
    if (evmWallet) {
      sortedEvmTokens.forEach((token) => {
        const key = `${token.ticker}-${token.chainId}`;
        const balance = parseFloat(token.balance) || 0;
        const usdValue = parseFloat(token.usdValue.replace("$", "").replace(",", "")) || 0;

        if (tokenMap.has(key)) {
          const existing = tokenMap.get(key)!;
          existing.totalBalance += balance;
          existing.totalUsdValue += usdValue;
          existing.walletIcons.push({
            iconKey: getWalletIconKey(evmWallet),
            walletId: evmWallet.id,
          });
        } else {
          tokenMap.set(key, {
            token: {
              ...token,
              walletAddress: evmWallet.address,
              walletIconKey: getWalletIconKey(evmWallet),
              walletId: evmWallet.id,
            },
            totalBalance: balance,
            totalUsdValue: usdValue,
            walletIcons: [{ iconKey: getWalletIconKey(evmWallet), walletId: evmWallet.id }],
          });
        }
      });
    }

    // Add BTC tokens for each connected BTC wallet
    connectedBtcAddresses.forEach((addr) => {
      const balance = btcBalances[addr];
      const wallet = userWallets.find((w) => w.address === addr);
      if (balance?.balanceBtc > 0 && wallet) {
        const btcUsdValue = balance.balanceBtc * (btcPrice || 0);
        const key = "BTC-0"; // BTC always has chainId 0

        if (tokenMap.has(key)) {
          const existing = tokenMap.get(key)!;
          existing.totalBalance += balance.balanceBtc;
          existing.totalUsdValue += btcUsdValue;
          existing.walletIcons.push({
            iconKey: getWalletIconKey(wallet),
            walletId: wallet.id,
          });
        } else {
          tokenMap.set(key, {
            token: {
              name: "Bitcoin",
              ticker: "BTC",
              address: "btc",
              balance: balance.balanceBtc.toFixed(8),
              usdValue: `$${btcUsdValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              icon: "/images/BTC_icon.svg",
              decimals: 8,
              chainId: 0,
              walletAddress: addr,
              walletIconKey: getWalletIconKey(wallet),
              walletId: wallet.id,
            },
            totalBalance: balance.balanceBtc,
            totalUsdValue: btcUsdValue,
            walletIcons: [{ iconKey: getWalletIconKey(wallet), walletId: wallet.id }],
          });
        }
      }
    });

    // Convert map to array with updated balances and wallet icons
    const tokens: TokenWithWallet[] = [];
    tokenMap.forEach(({ token, totalBalance, totalUsdValue, walletIcons }) => {
      tokens.push({
        ...token,
        balance:
          token.chainId === 0
            ? totalBalance.toFixed(8)
            : totalBalance.toLocaleString(undefined, { maximumFractionDigits: token.decimals }),
        usdValue: `$${totalUsdValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        walletIcons: walletIcons,
      });
    });

    // Sort by USD value
    return tokens.sort((a, b) => {
      const usdA = parseFloat(a.usdValue.replace("$", "").replace(",", ""));
      const usdB = parseFloat(b.usdValue.replace("$", "").replace(",", ""));
      return usdB - usdA;
    });
  }, [sortedEvmTokens, connectedBtcAddresses, btcBalances, btcPrice, userWallets, evmWallet]);

  // Get tokens for a specific wallet
  const getTokensForWallet = (walletId: string): TokenWithWallet[] => {
    const wallet = userWallets.find((w) => w.id === walletId);
    if (!wallet) return [];

    const chainType = getWalletChainType(wallet);

    if (chainType === "EVM") {
      // Return EVM tokens
      return sortedEvmTokens.map((token) => ({
        ...token,
        walletAddress: wallet.address,
        walletIconKey: getWalletIconKey(wallet),
        walletId: wallet.id,
      }));
    } else {
      // Return BTC token for this wallet
      const balance = btcBalances[wallet.address];
      if (balance?.balanceBtc > 0) {
        const btcUsdValue = balance.balanceBtc * (btcPrice || 0);
        return [
          {
            name: "Bitcoin",
            ticker: "BTC",
            address: "btc",
            balance: balance.balanceBtc.toFixed(8),
            usdValue: `$${btcUsdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            icon: "/images/BTC_icon.svg",
            decimals: 8,
            chainId: 0,
            walletAddress: wallet.address,
            walletIconKey: getWalletIconKey(wallet),
            walletId: wallet.id,
          },
        ];
      }
      return [];
    }
  };

  // Use the appropriate tokens based on viewMode
  const displayTokens: TokenWithWallet[] =
    viewMode === "all" ? combinedTokens : getTokensForWallet(viewMode);

  // Calculate total USD value based on viewMode
  const totalUsdValue =
    viewMode === "all"
      ? evmTotalUsdValue + allBtcTotalUsd
      : (() => {
          const wallet = userWallets.find((w) => w.id === viewMode);
          if (!wallet) return 0;
          const chainType = getWalletChainType(wallet);
          if (chainType === "EVM") {
            return evmTotalUsdValue;
          } else {
            const balance = btcBalances[wallet.address];
            return balance?.balanceBtc ? balance.balanceBtc * (btcPrice || 0) : 0;
          }
        })();

  // Calculate loading state
  const isLoadingBtc = connectedBtcAddresses.some((addr) => btcBalances[addr]?.isLoading);
  const isLoadingEvm = evmWallet && Object.keys(userTokensByChain).length === 0;
  const isLoadingBalances = isLoadingBtc || isLoadingEvm;

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

  // Handle wallet selection with swap direction sync
  const handleWalletSelect = (wallet: any) => {
    const walletChainType = getWalletChainType(wallet);
    const isEvmWallet = walletChainType === "EVM";
    const isBtcWallet = walletChainType === "BVM";

    // Switch the primary wallet
    switchWallet(wallet.id);

    // Check if we need to flip swap direction
    if (isSwappingForBTC && isBtcWallet) {
      // Currently EVM→BTC, but selected BTC wallet
      // Flip to BTC→EVM and use BTC address as input
      // Set flag to skip address clearing in SwapInputAndOutput effect
      setSkipAddressClearOnDirectionChange(true);
      setSelectedInputAddress(wallet.address);
      // Find an EVM wallet for output (BTC→EVM needs EVM output)
      const outputEvmWallet = userWallets.find((w) => w.chain?.toUpperCase() === "EVM");
      setSelectedOutputAddress(outputEvmWallet?.address || null);
      setIsSwappingForBTC(false);
    } else if (!isSwappingForBTC && isEvmWallet) {
      // Currently BTC→EVM, but selected EVM wallet
      // Flip to EVM→BTC and use EVM address as input
      // Set flag to skip address clearing in SwapInputAndOutput effect
      setSkipAddressClearOnDirectionChange(true);
      setSelectedInputAddress(wallet.address);
      // Find a BTC wallet for output (EVM→BTC needs BTC output)
      const outputBtcWallet = userWallets.find((w) => {
        const chain = w.chain?.toLowerCase();
        return chain === "btc" || chain === "bitcoin";
      });
      setSelectedOutputAddress(outputBtcWallet?.address || null);
      setIsSwappingForBTC(true);
    } else {
      // Chain type matches current input type, just update address
      setSelectedInputAddress(wallet.address);
    }

    setShowWalletsOverlay(false);
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
        transform={
          isOpen ? "translateX(0)" : isMobile ? "translateX(100%)" : "translateX(calc(100% + 70px))"
        }
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
        <Flex
          flex="1"
          h={isMobile ? "100%" : "auto"}
          bg={colors.offBlack}
          border={isMobile ? "none" : `1px solid ${colors.borderGray}`}
          borderRadius={isMobile ? "0" : "16px"}
          overflow="hidden"
          position="relative"
          zIndex={1001}
          direction="column"
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
                      {viewMode === "all"
                        ? `All Wallets (${userWallets.length})`
                        : (() => {
                            const selectedWallet = userWallets.find((w) => w.id === viewMode);
                            return selectedWallet
                              ? formatAddress(selectedWallet.address)
                              : `All Wallets (${userWallets.length})`;
                          })()}
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
                <Box p="12px">
                  {userWallets.map((wallet) => (
                    <Box
                      key={wallet.id}
                      p="16px"
                      mb="8px"
                      borderRadius="12px"
                      border={`2px solid ${
                        primaryWallet?.address === wallet.address
                          ? getWalletChainType(wallet) === "EVM"
                            ? "rgba(120, 140, 255, 0.6)"
                            : "rgba(247, 170, 80, 0.6)"
                          : colors.borderGray
                      }`}
                      bg={
                        primaryWallet?.address === wallet.address
                          ? getWalletChainType(wallet) === "EVM"
                            ? "rgba(9, 36, 97, 0.3)"
                            : "#291B0D"
                          : colors.offBlack
                      }
                      cursor={primaryWallet?.address === wallet.address ? "default" : "pointer"}
                      transition="all 0.2s ease-in-out"
                      _hover={{
                        bg:
                          primaryWallet?.address === wallet.address
                            ? getWalletChainType(wallet) === "EVM"
                              ? "rgba(9, 36, 97, 0.4)"
                              : "#3a2510"
                            : "#1a1a1a",
                      }}
                      onClick={() => handleWalletSelect(wallet)}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              copyAddress(wallet.address);
                            }}
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
                            : (() => {
                                const balanceData = btcBalances[wallet.address];
                                if (!balanceData || balanceData.isLoading) return "...";
                                if (balanceData.error) return "$0.00";
                                const usdValue = balanceData.balanceBtc * (btcPrice || 0);
                                return `$${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              })()}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWalletSelect(wallet);
                              }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              disconnectWallet(wallet);
                            }}
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
                {viewMode === "all"
                  ? `All Wallets (${userWallets.length})`
                  : (() => {
                      const selectedWallet = userWallets.find((w) => w.id === viewMode);
                      return selectedWallet
                        ? formatAddress(selectedWallet.address)
                        : `All Wallets (${userWallets.length})`;
                    })()}
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
              {/* View Mode Dropdown */}
              <Box position="relative">
                <Flex
                  align="center"
                  gap="6px"
                  px="10px"
                  py="6px"
                  borderRadius="8px"
                  bg={colors.offBlackLighter}
                  cursor="pointer"
                  _hover={{ bg: colors.offBlackLighter2 }}
                  onClick={() => setShowViewModeDropdown(!showViewModeDropdown)}
                >
                  {viewMode === "all" ? (
                    <>
                      <Text
                        color={colors.offWhite}
                        fontSize="14px"
                        fontWeight="500"
                        fontFamily="Inter"
                      >
                        All
                      </Text>
                      <FiChevronDown size={14} color={colors.textGray} />
                    </>
                  ) : (
                    <>
                      {(() => {
                        const selectedWallet = userWallets.find((w) => w.id === viewMode);
                        return selectedWallet ? (
                          <Box w="20px" h="20px" borderRadius="4px" overflow="hidden">
                            <Image
                              src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(selectedWallet)}`}
                              alt="wallet"
                              w="100%"
                              h="100%"
                              objectFit="cover"
                            />
                          </Box>
                        ) : null;
                      })()}
                      <FiChevronDown size={14} color={colors.textGray} />
                    </>
                  )}
                </Flex>

                {/* View Mode Dropdown Menu */}
                {showViewModeDropdown && (
                  <Box
                    position="absolute"
                    top="calc(100% + 4px)"
                    left="0"
                    bg={colors.offBlack}
                    border={`1px solid ${colors.borderGray}`}
                    borderRadius="12px"
                    p="8px"
                    zIndex={100}
                    minW="140px"
                    boxShadow="0 4px 12px rgba(0,0,0,0.3)"
                  >
                    {/* All Wallets Option */}
                    <Flex
                      align="center"
                      justify="space-between"
                      p="10px"
                      borderRadius="8px"
                      cursor="pointer"
                      bg={viewMode === "all" ? "rgba(167, 139, 250, 0.15)" : "transparent"}
                      _hover={{
                        bg:
                          viewMode === "all" ? "rgba(167, 139, 250, 0.15)" : colors.offBlackLighter,
                      }}
                      onClick={() => {
                        setViewMode("all");
                        setShowViewModeDropdown(false);
                      }}
                    >
                      <Text
                        color={viewMode === "all" ? "#A78BFA" : colors.offWhite}
                        fontSize="14px"
                        fontWeight="500"
                        fontFamily="Inter"
                      >
                        All
                      </Text>
                      {/* Stacked wallet icons */}
                      <Flex>
                        {userWallets.slice(0, 3).map((wallet, idx) => (
                          <Box
                            key={wallet.id}
                            w="20px"
                            h="20px"
                            borderRadius="4px"
                            ml={idx > 0 ? "-6px" : "0"}
                            border={`1px solid ${colors.offBlack}`}
                            bg={colors.offBlackLighter}
                            overflow="hidden"
                            zIndex={3 - idx}
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
                    </Flex>

                    {/* Individual Wallet Options */}
                    {userWallets.map((wallet) => (
                      <Flex
                        key={wallet.id}
                        align="center"
                        gap="10px"
                        p="10px"
                        borderRadius="8px"
                        cursor="pointer"
                        bg={viewMode === wallet.id ? "rgba(167, 139, 250, 0.15)" : "transparent"}
                        _hover={{
                          bg:
                            viewMode === wallet.id
                              ? "rgba(167, 139, 250, 0.15)"
                              : colors.offBlackLighter,
                        }}
                        onClick={() => {
                          setViewMode(wallet.id);
                          setShowViewModeDropdown(false);
                        }}
                      >
                        <Box w="20px" h="20px" borderRadius="4px" overflow="hidden">
                          <Image
                            src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                            alt="wallet"
                            w="100%"
                            h="100%"
                            objectFit="cover"
                          />
                        </Box>
                        <Text
                          color={viewMode === wallet.id ? "#A78BFA" : colors.offWhite}
                          fontSize="14px"
                          fontWeight="500"
                          fontFamily="Inter"
                        >
                          {formatAddress(wallet.address)}
                        </Text>
                      </Flex>
                    ))}
                  </Box>
                )}
              </Box>
            </Flex>
          </Flex>

          {/* Tabs */}
          <Flex
            px="20px"
            borderBottom={`1px solid ${colors.borderGray}`}
            justify="space-between"
            align="center"
          >
            <Flex gap="24px">
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
                Swap Activity
              </Text>
            </Flex>
            {/* Expand button - only show on Activity tab, desktop only */}
            {activeTab === "activity" && !isMobile && (
              <Box
                cursor="pointer"
                p="6px"
                borderRadius="6px"
                bg={colors.offBlackLighter}
                _hover={{ bg: colors.offBlackLighter2 }}
                onClick={() => setShowFullHistory(true)}
                mb="8px"
              >
                <FiMaximize2 size={14} color={colors.textGray} />
              </Box>
            )}
          </Flex>

          {/* Token List */}
          {activeTab === "tokens" && (
            <Box
              p="12px"
              flex="1"
              overflow="auto"
              css={{
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#333",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "#444",
                },
                scrollbarWidth: "thin",
                scrollbarColor: "#333 transparent",
              }}
            >
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
              ) : isLoadingBalances && displayTokens.length === 0 ? (
                <Flex direction="column" align="center" justify="center" py="40px" gap="16px">
                  <Spinner size="lg" color="#A78BFA" borderWidth="3px" />
                  <Text color={colors.textGray} fontSize="14px" fontFamily="Inter">
                    Loading balances...
                  </Text>
                </Flex>
              ) : displayTokens.length === 0 ? (
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
                  {displayTokens.map((token, idx) => (
                    <Flex
                      key={`${token.address}-${token.chainId}-${token.walletAddress}-${idx}`}
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
                            src={
                              token.chainId === 0 || token.ticker === "BTC"
                                ? "/images/BTC_icon.svg"
                                : token.icon || FALLBACK_TOKEN_ICON
                            }
                            alt={token.ticker}
                            w="40px"
                            h="40px"
                            borderRadius="full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_TOKEN_ICON;
                            }}
                          />
                          {/* Wallet Badge(s) (only in combined view) */}
                          {viewMode === "all" &&
                            token.walletIcons &&
                            token.walletIcons.length > 0 && (
                              <Flex position="absolute" top="-4px" left="-4px">
                                {token.walletIcons.slice(0, 3).map((walletIcon, iconIdx) => (
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
                          {/* Chain Badge */}
                          {token.chainId === 0 ? (
                            // BTC chain badge
                            <Image
                              src="/images/assets/icons/BTC.svg"
                              alt="Bitcoin"
                              w="16px"
                              h="16px"
                              position="absolute"
                              bottom="-2px"
                              right="-2px"
                              borderRadius="full"
                              border={`2px solid ${colors.offBlack}`}
                              bg="#F7931A"
                              p="2px"
                            />
                          ) : token.chainId && CHAIN_LOGOS[token.chainId] ? (
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
                          ) : null}
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
                            {token.chainId === 0
                              ? "Bitcoin"
                              : CHAIN_NAMES[token.chainId] || "Unknown"}
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
            <Box
              flex="1"
              overflow="auto"
              pt="12px"
              css={{
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#333",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "#444",
                },
                scrollbarWidth: "thin",
                scrollbarColor: "#333 transparent",
              }}
            >
              <UserSwapHistory embedded />
            </Box>
          )}
        </Flex>
      </Box>

      {/* Full-screen history modal (desktop only) */}
      {showFullHistory && !isMobile && (
        <Portal>
          <Box
            position="fixed"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bg="rgba(0, 0, 0, 0.95)"
            zIndex={9999}
            overflow="auto"
          >
            {/* Close button */}
            <Flex justify="flex-end" p="20px">
              <Box
                cursor="pointer"
                p="12px"
                borderRadius="12px"
                bg={colors.offBlackLighter}
                _hover={{ bg: colors.offBlackLighter2 }}
                onClick={() => setShowFullHistory(false)}
              >
                <FiX size={24} color={colors.offWhite} />
              </Box>
            </Flex>
            {/* Full history view - not embedded */}
            <Flex
              direction="column"
              align="center"
              justify="center"
              w="100%"
              maxW="1400px"
              mx="auto"
              px="20px"
              pb="40px"
            >
              <UserSwapHistory embedded={false} />
            </Flex>
          </Box>
        </Portal>
      )}
    </>
  );
};
