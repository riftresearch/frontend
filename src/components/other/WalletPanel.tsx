import React, { useState } from "react";
import { Flex, Text, Box, Image, Spinner, Portal } from "@chakra-ui/react";
import {
  useDynamicContext,
  useUserWallets,
  useDynamicModals,
  useSwitchWallet,
} from "@dynamic-labs/sdk-react-core";
import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
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
import { getPaymentAddress, getAllBtcAddresses, getAllBtcAddressesWithInfo, type BtcAddressInfo } from "@/hooks/useBitcoinTransaction";
import { FALLBACK_TOKEN_ICON } from "@/utils/constants";
import { toastSuccess } from "@/utils/toast";
import type { TokenData } from "@/utils/types";
import useWindowSize from "@/hooks/useWindowSize";
import { TokenDisplay } from "./TokenDisplay";

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
  // Get wallet addresses from global store (set via Dynamic's onWalletAdded callback)
  const primaryEvmAddress = useStore((state) => state.primaryEvmAddress);
  const btcAddress = useStore((state) => state.btcAddress);
  const setPrimaryEvmAddress = useStore((state) => state.setPrimaryEvmAddress);
  const setBtcAddress = useStore((state) => state.setBtcAddress);

  const { handleLogOut, setShowAuthFlow, primaryWallet, removeWallet } = useDynamicContext();
  // setShowLinkNewWalletModal is from useDynamicModals hook (for adding wallets when already connected)
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const userWallets = useUserWallets();
  const switchWallet = useSwitchWallet();
  const {
    userTokensByChain,
    userTokensByWallet,
    btcPrice,
    inputToken,
    outputToken,
  } = useStore();

  // Derive swap direction from token chains
  const isSwappingForBTC = outputToken.chain === "bitcoin";
  const { isMobile } = useWindowSize();

  // Get all BTC wallets
  const btcWallets = userWallets.filter((wallet) => {
    const chain = wallet.chain?.toLowerCase();
    return chain === "btc" || chain === "bitcoin";
  });

  // Expanded BTC wallet entry - each address type becomes its own entry
  interface ExpandedBtcWallet {
    id: string; // unique ID: walletId-addressType
    originalWallet: any; // reference to the Dynamic wallet for signing
    address: string;
    addressType: string; // "payment", "ordinal", etc.
    addressLabel: string; // "Taproot", "Native Segwit", etc.
    connectorName: string;
  }

  // Create expanded BTC wallet entries - each address type is shown separately
  const expandedBtcWallets: ExpandedBtcWallet[] = React.useMemo(() => {
    const expanded: ExpandedBtcWallet[] = [];
    
    for (const wallet of btcWallets) {
      if (isBitcoinWallet(wallet)) {
        const addressInfos = getAllBtcAddressesWithInfo(wallet);
        for (const info of addressInfos) {
          expanded.push({
            id: `${wallet.id}-${info.type}`,
            originalWallet: wallet,
            address: info.address,
            addressType: info.type,
            addressLabel: info.label,
            connectorName: wallet.connector?.name || "Bitcoin",
          });
        }
      } else {
        // Fallback for non-standard BTC wallets
        expanded.push({
          id: wallet.id,
          originalWallet: wallet,
          address: wallet.address,
          addressType: "default",
          addressLabel: "Bitcoin",
          connectorName: wallet.connector?.name || "Bitcoin",
        });
      }
    }
    
    return expanded;
  }, [btcWallets]);

  // Get ALL BTC addresses for balance fetching (includes Taproot, Native Segwit, etc.)
  const btcWalletAddresses = expandedBtcWallets.map((w) => w.address);

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

  // Get the correct address to use for a wallet (payment address for BTC, default for EVM)
  const getWalletDisplayAddress = (wallet: any): string => {
    const chainType = getWalletChainType(wallet);
    console.log(
      "[WalletPanel:getWalletDisplayAddress] chainType:",
      chainType,
      "isBitcoinWallet:",
      isBitcoinWallet(wallet)
    );
    if (chainType === "BVM" && isBitcoinWallet(wallet)) {
      const addr = getPaymentAddress(wallet);
      console.log("[WalletPanel:getWalletDisplayAddress] returning payment address:", addr);
      return addr;
    }
    console.log("[WalletPanel:getWalletDisplayAddress] returning default address:", wallet.address);
    return wallet.address;
  };

  // Get all connected EVM wallets
  const connectedEvmWallets = userWallets.filter(
    (w) => w.chain?.toUpperCase() === "EVM"
  );

  // Calculate total EVM USD value across ALL connected EVM wallets
  const allEvmTotalUsdValue = React.useMemo(() => {
    let total = 0;
    for (const wallet of connectedEvmWallets) {
      const walletTokens = userTokensByWallet[wallet.address.toLowerCase()];
      if (walletTokens) {
        const allTokens = Object.values(walletTokens).flat();
        for (const token of allTokens) {
          const usd = parseFloat(token.usdValue.replace("$", "").replace(",", ""));
          if (!isNaN(usd)) {
            total += usd;
          }
        }
      }
    }
    return total;
  }, [connectedEvmWallets, userTokensByWallet]);

  // Get USD value for a specific EVM wallet (only counts EVM tokens, not BTC)
  const getEvmWalletUsdValue = (walletAddress: string): number => {
    // Ensure this wallet is actually an EVM wallet
    const wallet = connectedEvmWallets.find(
      (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    if (!wallet) return 0;
    
    const walletTokens = userTokensByWallet[walletAddress.toLowerCase()];
    if (!walletTokens) return 0;
    const allTokens = Object.values(walletTokens).flat();
    return allTokens.reduce((sum, token) => {
      const usd = parseFloat(token.usdValue.replace("$", "").replace(",", ""));
      return sum + (isNaN(usd) ? 0 : usd);
    }, 0);
  };

  // Calculate total BTC balance across ALL expanded BTC wallet addresses
  const allBtcTotalUsd = expandedBtcWallets.reduce((sum, expandedWallet) => {
    const balance = btcBalances[expandedWallet.address];
    if (balance?.balanceBtc) {
      return sum + balance.balanceBtc * (btcPrice || 0);
    }
    return sum;
  }, 0);

  // Get USD value for a specific BTC address
  const getBtcAddressUsdValue = (address: string): number => {
    const balance = btcBalances[address];
    if (balance?.balanceBtc) {
      return balance.balanceBtc * (btcPrice || 0);
    }
    return 0;
  };

  // Get BTC balance for a specific address
  const getBtcAddressBalance = (address: string): number => {
    const balance = btcBalances[address];
    return balance?.balanceBtc || 0;
  };

  // Interface for tokens with wallet attribution (supports multiple wallets for combined view)
  interface TokenWithWallet extends TokenData {
    walletAddress: string;
    walletIconKey: string;
    walletId: string;
    // For merged tokens in "all" view
    walletIcons?: { iconKey: string; walletId: string }[];
    // For BTC tokens: "Taproot", "Native Segwit", etc.
    addressLabel?: string;
  }

  // Build combined token list for "all" view (merging same tokens from different wallets)
  const combinedTokens: TokenWithWallet[] = React.useMemo(() => {
    // Use a map to group tokens by unique key (ticker + chain)
    const tokenMap = new Map<
      string,
      {
        token: TokenWithWallet;
        totalBalance: number;
        totalUsdValue: number;
        walletIcons: { iconKey: string; walletId: string }[];
      }
    >();

    // Add EVM tokens from ALL connected EVM wallets
    for (const wallet of connectedEvmWallets) {
      const walletTokens = userTokensByWallet[wallet.address.toLowerCase()];
      if (!walletTokens) continue;
      
      const allTokens = Object.values(walletTokens).flat();
      for (const token of allTokens) {
        const key = `${token.ticker}-${token.chain}`;
        const balance = parseFloat(token.balance) || 0;
        const usdValue = parseFloat(token.usdValue.replace("$", "").replace(",", "")) || 0;

        if (tokenMap.has(key)) {
          const existing = tokenMap.get(key)!;
          existing.totalBalance += balance;
          existing.totalUsdValue += usdValue;
          if (!existing.walletIcons.some(icon => icon.walletId === wallet.id)) {
            existing.walletIcons.push({
              iconKey: getWalletIconKey(wallet),
              walletId: wallet.id,
            });
          }
        } else {
          tokenMap.set(key, {
            token: {
              ...token,
              walletAddress: wallet.address,
              walletIconKey: getWalletIconKey(wallet),
              walletId: wallet.id,
            },
            totalBalance: balance,
            totalUsdValue: usdValue,
            walletIcons: [{ iconKey: getWalletIconKey(wallet), walletId: wallet.id }],
          });
        }
      }
    }

    // Add BTC tokens for each expanded BTC wallet address (each address type is its own entry)
    for (const expandedWallet of expandedBtcWallets) {
      const addressBalance = getBtcAddressBalance(expandedWallet.address);
      if (addressBalance <= 0) continue;
      
      const btcUsdValue = addressBalance * (btcPrice || 0);
      // Each address type gets its own unique key
      const key = `BTC-${expandedWallet.id}`;

      tokenMap.set(key, {
        token: {
          name: "Bitcoin",
          ticker: "BTC",
          address: expandedWallet.address,
          balance: addressBalance.toFixed(8),
          usdValue: `$${btcUsdValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          icon: "/images/BTC_icon.svg",
          decimals: 8,
          chain: "bitcoin" as const,
          walletAddress: expandedWallet.address,
          walletIconKey: getWalletIconKey(expandedWallet.originalWallet),
          walletId: expandedWallet.id,
          addressLabel: expandedWallet.addressLabel,
        } as TokenWithWallet,
        totalBalance: addressBalance,
        totalUsdValue: btcUsdValue,
        walletIcons: [{ 
          iconKey: getWalletIconKey(expandedWallet.originalWallet), 
          walletId: expandedWallet.id 
        }],
      });
    }

    // Convert map to array with updated balances and wallet icons
    const tokens: TokenWithWallet[] = [];
    tokenMap.forEach(({ token, totalBalance, totalUsdValue, walletIcons }) => {
      tokens.push({
        ...token,
        balance:
          token.chain === "bitcoin"
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
  }, [connectedEvmWallets, userTokensByWallet, expandedBtcWallets, btcBalances, btcPrice, userWallets]);

  // Get tokens for a specific wallet (handles both EVM and expanded BTC wallets)
  const getTokensForWallet = (walletId: string): TokenWithWallet[] => {
    // First check if it's an expanded BTC wallet
    const expandedBtcWallet = expandedBtcWallets.find((w) => w.id === walletId);
    if (expandedBtcWallet) {
      const addressBalance = getBtcAddressBalance(expandedBtcWallet.address);
      if (addressBalance > 0) {
        const btcUsdValue = addressBalance * (btcPrice || 0);
        return [
          {
            name: "Bitcoin",
            ticker: "BTC",
            address: expandedBtcWallet.address,
            balance: addressBalance.toFixed(8),
            usdValue: `$${btcUsdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            icon: "/images/BTC_icon.svg",
            decimals: 8,
            chain: "bitcoin" as const,
            walletAddress: expandedBtcWallet.address,
            walletIconKey: getWalletIconKey(expandedBtcWallet.originalWallet),
            walletId: expandedBtcWallet.id,
            addressLabel: expandedBtcWallet.addressLabel,
          },
        ];
      }
      return [];
    }

    // Check if it's an EVM wallet
    const wallet = userWallets.find((w) => w.id === walletId);
    if (!wallet) return [];

    const chainType = getWalletChainType(wallet);

    if (chainType === "EVM") {
      // Return tokens from userTokensByWallet for this specific wallet
      const walletTokens = userTokensByWallet[wallet.address.toLowerCase()];
      if (!walletTokens) return [];
      
      const allTokens = Object.values(walletTokens).flat();
      const sortedTokens = [...allTokens].sort((a, b) => {
        const usdA = parseFloat(a.usdValue.replace("$", "").replace(",", ""));
        const usdB = parseFloat(b.usdValue.replace("$", "").replace(",", ""));
        return usdB - usdA;
      });
      
      return sortedTokens.map((token) => ({
        ...token,
        walletAddress: wallet.address,
        walletIconKey: getWalletIconKey(wallet),
        walletId: wallet.id,
      }));
    }
    
    return [];
  };

  // Use the appropriate tokens based on viewMode
  const displayTokens: TokenWithWallet[] =
    viewMode === "all" ? combinedTokens : getTokensForWallet(viewMode);

  // Calculate total USD value based on viewMode
  const totalUsdValue =
    viewMode === "all"
      ? allEvmTotalUsdValue + allBtcTotalUsd
      : (() => {
          // Check if it's an expanded BTC wallet
          const expandedBtcWallet = expandedBtcWallets.find((w) => w.id === viewMode);
          if (expandedBtcWallet) {
            return getBtcAddressUsdValue(expandedBtcWallet.address);
          }
          
          // Check if it's an EVM wallet
          const wallet = userWallets.find((w) => w.id === viewMode);
          if (!wallet) return 0;
          const chainType = getWalletChainType(wallet);
          if (chainType === "EVM") {
            return getEvmWalletUsdValue(wallet.address);
          }
          return 0;
        })();

  // Calculate loading state
  const isLoadingBtc = btcWalletAddresses.some((addr) => btcBalances[addr]?.isLoading);
  const isLoadingEvm = connectedEvmWallets.length > 0 && Object.keys(userTokensByWallet).length === 0;
  const isLoadingBalances = isLoadingBtc || isLoadingEvm;

  // Display wallet entry - unified type for EVM and expanded BTC wallets
  interface DisplayWallet {
    id: string;
    address: string;
    chainType: "EVM" | "BVM";
    iconKey: string;
    addressLabel?: string; // For BTC: "Taproot", "Native Segwit", etc.
    originalWallet: any; // Reference to Dynamic wallet for actions
    usdValue: number;
    isLoading: boolean;
  }

  // Create unified display wallet list (EVM wallets + expanded BTC wallets)
  const displayWallets: DisplayWallet[] = React.useMemo(() => {
    const wallets: DisplayWallet[] = [];

    // Add EVM wallets
    for (const wallet of connectedEvmWallets) {
      wallets.push({
        id: wallet.id,
        address: wallet.address,
        chainType: "EVM",
        iconKey: getWalletIconKey(wallet),
        originalWallet: wallet,
        usdValue: getEvmWalletUsdValue(wallet.address),
        isLoading: false,
      });
    }

    // Add expanded BTC wallets (each address type separately)
    for (const expandedWallet of expandedBtcWallets) {
      const balance = btcBalances[expandedWallet.address];
      wallets.push({
        id: expandedWallet.id,
        address: expandedWallet.address,
        chainType: "BVM",
        iconKey: getWalletIconKey(expandedWallet.originalWallet),
        addressLabel: expandedWallet.addressLabel,
        originalWallet: expandedWallet.originalWallet,
        usdValue: getBtcAddressUsdValue(expandedWallet.address),
        isLoading: balance?.isLoading || false,
      });
    }

    return wallets;
  }, [connectedEvmWallets, expandedBtcWallets, btcBalances, userTokensByWallet, btcPrice]);

  // Total wallet count for display
  const totalWalletCount = displayWallets.length;

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

  // Handle wallet selection - update the store address and walletClient for the wallet type
  const handleWalletSelect = async (wallet: any) => {
    const walletChainType = getWalletChainType(wallet);
    const walletAddress = getWalletDisplayAddress(wallet);

    if (walletChainType === "EVM") {
      try {
        await switchWallet(wallet.id);
        setPrimaryEvmAddress(walletAddress);
      } catch (error) {
        console.error("handleWalletSelect: Failed to switch primary wallet:", error);
      }
    } else if (walletChainType === "BVM") {
      setBtcAddress(walletAddress);
    }
  };

  // Handle display wallet selection (works with both EVM and expanded BTC wallets)
  const handleDisplayWalletSelect = async (displayWallet: DisplayWallet) => {
    if (displayWallet.chainType === "EVM") {
      try {
        await switchWallet(displayWallet.originalWallet.id);
        setPrimaryEvmAddress(displayWallet.address);
      } catch (error) {
        console.error("handleDisplayWalletSelect: Failed to switch primary wallet:", error);
      }
    } else if (displayWallet.chainType === "BVM") {
      // Set the specific BTC address (Taproot or Native Segwit)
      setBtcAddress(displayWallet.address);
    }
  };

  // Check if a display wallet is the active/selected wallet
  const isDisplayWalletSelected = (displayWallet: DisplayWallet): boolean => {
    if (displayWallet.chainType === "EVM") {
      return primaryEvmAddress?.toLowerCase() === displayWallet.address.toLowerCase();
    } else if (displayWallet.chainType === "BVM") {
      return btcAddress === displayWallet.address;
    }
    return false;
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

  // Disconnect a display wallet (uses the original wallet reference)
  const disconnectDisplayWallet = async (displayWallet: DisplayWallet) => {
    try {
      // Count unique original wallets
      const uniqueOriginalWallets = new Set(displayWallets.map((w) => w.originalWallet.id));
      if (uniqueOriginalWallets.size <= 1) {
        await handleLogOut();
      } else {
        await removeWallet(displayWallet.originalWallet.id);
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
                        ? `All Wallets (${totalWalletCount})`
                        : (() => {
                            const selectedWallet = displayWallets.find((w) => w.id === viewMode);
                            return selectedWallet
                              ? formatAddress(selectedWallet.address)
                              : `All Wallets (${totalWalletCount})`;
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

                {/* Wallet List - uses displayWallets to show EVM and expanded BTC wallets separately */}
                <Box p="12px">
                  {displayWallets.map((displayWallet) => (
                    <Box
                      key={displayWallet.id}
                      p="16px"
                      mb="8px"
                      borderRadius="12px"
                      border={`2px solid ${
                        isDisplayWalletSelected(displayWallet)
                          ? displayWallet.chainType === "EVM"
                            ? "rgba(120, 140, 255, 0.6)"
                            : "rgba(247, 170, 80, 0.6)"
                          : colors.borderGray
                      }`}
                      bg={
                        isDisplayWalletSelected(displayWallet)
                          ? displayWallet.chainType === "EVM"
                            ? "rgba(9, 36, 97, 0.3)"
                            : "#291B0D"
                          : colors.offBlack
                      }
                      cursor={isDisplayWalletSelected(displayWallet) ? "default" : "pointer"}
                      transition="all 0.2s ease-in-out"
                      _hover={{
                        bg: isDisplayWalletSelected(displayWallet)
                          ? displayWallet.chainType === "EVM"
                            ? "rgba(9, 36, 97, 0.4)"
                            : "#3a2510"
                          : "#1a1a1a",
                      }}
                      onClick={() => handleDisplayWalletSelect(displayWallet)}
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
                              src={`${DYNAMIC_ICON_BASE}#${displayWallet.iconKey}`}
                              alt="wallet"
                              w="100%"
                              h="100%"
                              objectFit="contain"
                            />
                          </Box>
                          {/* Address with copy button and optional label */}
                          <Flex
                            direction="column"
                            gap="2px"
                          >
                            <Flex
                              align="center"
                              gap="8px"
                              cursor="pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyAddress(displayWallet.address);
                              }}
                              _hover={{ opacity: 0.8 }}
                            >
                              <Text
                                color={colors.offWhite}
                                fontSize="18px"
                                fontWeight="600"
                                fontFamily="Inter"
                              >
                                {formatAddress(displayWallet.address)}
                              </Text>
                              {copiedAddress === displayWallet.address ? (
                                <FiCheck size={16} color={colors.greenOutline} />
                              ) : (
                                <FiCopy size={16} color={colors.textGray} />
                              )}
                            </Flex>
                            {/* Show address type label for BTC wallets */}
                            {displayWallet.addressLabel && displayWallet.chainType === "BVM" && (
                              <Text
                                color={colors.textGray}
                                fontSize="12px"
                                fontFamily="Inter"
                              >
                                {displayWallet.addressLabel}
                              </Text>
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
                          {displayWallet.isLoading
                            ? "..."
                            : `$${displayWallet.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </Text>
                      </Flex>

                      {/* Bottom Row: Chain Badge, Select Wallet, Disconnect */}
                      <Flex align="center" justify="space-between">
                        <Flex align="center" gap="8px">
                          {/* Chain Badge with Icon and optional address type */}
                          <Flex
                            align="center"
                            gap="6px"
                            px="8px"
                            py="4px"
                            borderRadius="6px"
                            bg={
                              displayWallet.chainType === "EVM"
                                ? "rgba(57, 74, 255, 0.15)"
                                : "rgba(247, 147, 26, 0.15)"
                            }
                          >
                            {CHAIN_TYPE_LOGOS[displayWallet.chainType] && (
                              <Box
                                w="14px"
                                h="14px"
                                borderRadius="full"
                                overflow="hidden"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                bg={
                                  displayWallet.chainType === "EVM" ? colors.RiftBlue : "#F7931A"
                                }
                                p="2px"
                              >
                                <Image
                                  src={CHAIN_TYPE_LOGOS[displayWallet.chainType]}
                                  alt="chain"
                                  w="100%"
                                  h="100%"
                                  objectFit="contain"
                                />
                              </Box>
                            )}
                            <Text
                              color={
                                displayWallet.chainType === "EVM"
                                  ? "rgba(120, 140, 255, 1)"
                                  : "rgba(247, 170, 80, 1)"
                              }
                              fontSize="12px"
                              fontWeight="600"
                              fontFamily="Inter"
                            >
                              {displayWallet.chainType === "BVM" && displayWallet.addressLabel
                                ? displayWallet.addressLabel
                                : displayWallet.chainType}
                            </Text>
                          </Flex>
                          {/* Active indicator or Select Wallet */}
                          {isDisplayWalletSelected(displayWallet) ? (
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
                                handleDisplayWalletSelect(displayWallet);
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
                              disconnectDisplayWallet(displayWallet);
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
                  ? `All Wallets (${totalWalletCount})`
                  : (() => {
                      const selectedWallet = displayWallets.find((w) => w.id === viewMode);
                      return selectedWallet
                        ? formatAddress(selectedWallet.address)
                        : `All Wallets (${totalWalletCount})`;
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
                          {formatAddress(getWalletDisplayAddress(wallet))}
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
                    <TokenDisplay
                      key={`${token.address}-${token.chain}-${token.walletAddress}-${idx}`}
                      token={token}
                      showBalance
                      isMobile={isMobile}
                      walletIcons={viewMode === "all" ? token.walletIcons : undefined}
                      addressLabel={token.addressLabel}
                    />
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
              <UserSwapHistory embedded onSwapClick={onClose} />
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
