import { Flex, Text, Box, Image, Portal, Input } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { BASE_LOGO } from "./SVGs";
import { NetworkBadge } from "./NetworkBadge";
import { useState, useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { useStore } from "@/utils/store";
import { mainnet, base } from "viem/chains";
import { TokenData, Network } from "@/utils/types";
import { searchTokens } from "@/utils/tokenSearch";
import { preloadImages } from "@/utils/imagePreload";
import useWindowSize from "@/hooks/useWindowSize";
import {
  FALLBACK_TOKEN_ICON,
  BASE_POPULAR_TOKENS,
  ETHEREUM_POPULAR_TOKENS,
  ALL_POPULAR_TOKENS,
  ZERO_USD_DISPLAY,
  ETH_TOKEN,
  ETH_TOKEN_BASE,
} from "@/utils/constants";

interface AssetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAsset: string;
}

export const AssetSelectorModal: React.FC<AssetSelectorModalProps> = ({
  isOpen,
  onClose,
  currentAsset,
}) => {
  const { evmConnectWalletChainId } = useStore();
  const { isMobile } = useWindowSize();

  const [selectedNetwork, setSelectedNetwork] = useState<Network>(Network.ALL);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [popularTokens, setPopularTokens] = useState<TokenData[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Wagmi hooks for chain switching
  const { isConnected: isWagmiConnected, address: wagmiAddress } = useAccount();
  const { switchChain } = useSwitchChain();

  // Dynamic hooks for wallet detection
  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();

  // Find any EVM wallet from Dynamic's connected wallets
  const evmWallet = userWallets.find(
    (w) =>
      w.chain === "EVM" ||
      w.chain === "evm" ||
      w.connector?.name?.toLowerCase()?.includes("metamask") ||
      w.connector?.name?.toLowerCase()?.includes("coinbase")
  );

  // Use wagmi address if available, otherwise try Dynamic's EVM wallet
  const address = wagmiAddress || evmWallet?.address;
  const isConnected = isWagmiConnected || !!evmWallet;

  // Zustand store
  const {
    searchResults,
    setSearchResults,
    setEvmConnectWalletChainId,
    selectedInputToken,
    setSelectedInputToken,
    selectedOutputToken,
    setSelectedOutputToken,
    isSwappingForBTC,
    setDisplayedInputAmount,
    setOutputAmount,
    userTokensByChain,
    setErc20Price,
    setInputUsdValue,
  } = useStore();

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset selectedNetwork to ALL when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedNetwork(Network.ALL);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Auto-switch chain when wallet connects or address changes
  useEffect(() => {
    if (!isConnected) return;

    const targetChainId = isSwappingForBTC
      ? selectedInputToken?.chainId
      : selectedOutputToken?.chainId;

    if (!targetChainId) return;

    const switchToChain = async () => {
      try {
        const chainId = targetChainId === 1 ? mainnet.id : base.id;
        await switchChain({ chainId });
        setEvmConnectWalletChainId(chainId);
      } catch (error) {
        console.error("Failed to auto-switch chain:", error);
      }
    };

    switchToChain();
  }, [isConnected, address]);

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 180);
    return () => clearTimeout(h);
  }, [searchQuery]);

  // Preload popular token icons for the selected network when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const tokens =
      selectedNetwork === Network.ALL
        ? ALL_POPULAR_TOKENS
        : selectedNetwork === Network.BASE
          ? BASE_POPULAR_TOKENS
          : ETHEREUM_POPULAR_TOKENS;
    const icons = tokens.map((t) => t.icon).filter(Boolean);
    preloadImages(icons as string[]);
  }, [isOpen, selectedNetwork]);

  // Token fetching/pricing handled globally; modal reads from store

  // Helper to filter tokens to cbBTC only
  const filterToCbBTCOnly = (tokens: TokenData[]): TokenData[] => {
    return tokens.filter((t) => t.ticker === "cbBTC");
  };

  // Load tokens from global store when modal opens or dependencies change
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      // When swapping FROM BTC (not for BTC), only show cbBTC options
      if (!isSwappingForBTC) {
        // Get cbBTC from both chains with user balances if available
        const ethTokens = (userTokensByChain[1] || []).map((t) => ({ ...t, chainId: 1 }));
        const baseTokens = (userTokensByChain[8453] || []).map((t) => ({ ...t, chainId: 8453 }));
        const allUserTokens = [...ethTokens, ...baseTokens];

        // Filter to only cbBTC tokens from user's wallet
        let cbBTCTokens = filterToCbBTCOnly(allUserTokens);

        // If user doesn't have cbBTC in wallet, show from popular tokens
        if (cbBTCTokens.length === 0) {
          cbBTCTokens = filterToCbBTCOnly(ALL_POPULAR_TOKENS);
        } else {
          // Merge with popular tokens to ensure both chains are shown
          const userCbBTCChains = new Set(cbBTCTokens.map((t) => t.chainId));
          const missingChainCbBTC = filterToCbBTCOnly(ALL_POPULAR_TOKENS).filter(
            (t) => !userCbBTCChains.has(t.chainId)
          );
          cbBTCTokens = [...cbBTCTokens, ...missingChainCbBTC];
        }

        // Deduplicate by chainId + address (user tokens come first, so they're preserved)
        const seen = new Set<string>();
        cbBTCTokens = cbBTCTokens.filter((t) => {
          const key = `${t.chainId}-${t.address.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort by USD value (descending) so chain with balance appears first
        cbBTCTokens.sort((a, b) => {
          const aValue = parseFloat(a.usdValue.replace("$", "").replace(",", "")) || 0;
          const bValue = parseFloat(b.usdValue.replace("$", "").replace(",", "")) || 0;
          return bValue - aValue;
        });

        preloadImages(cbBTCTokens.map((t) => t.icon).filter(Boolean));
        setSearchResults(cbBTCTokens);
        setPopularTokens([]);
        setIsLoading(false);
        return;
      }

      // If there's an active query, use the search index top-10
      if (debouncedQuery.length > 0) {
        // Search tokens using the Network enum directly
        const results = searchTokens(selectedNetwork, debouncedQuery, 10);

        // Get user's wallet tokens
        let userTokens: TokenData[] = [];
        if (selectedNetwork === Network.ALL) {
          // Combine tokens from both chains
          const ethTokens = userTokensByChain[1] || [];
          const baseTokens = userTokensByChain[8453] || [];
          userTokens = [...ethTokens, ...baseTokens];
        } else {
          const chainId = selectedNetwork === Network.ETHEREUM ? 1 : 8453;
          userTokens = userTokensByChain[chainId] || [];
        }

        // Replace balance and usdValue in search results if token is in user's wallet
        const mergedResults = results.map((t) => {
          // Use canonical ETH token for native ETH (zero address)
          const isNativeEth = t.address === "0x0000000000000000000000000000000000000000";
          if (isNativeEth) {
            const baseToken = t.chainId === 8453 ? ETH_TOKEN_BASE : ETH_TOKEN;
            // Still merge wallet balance if available
            const walletToken = userTokens.find(
              (token) => token.address === t.address && token.chainId === t.chainId
            );
            if (walletToken && parseFloat(walletToken.usdValue.replace("$", "")) > 1) {
              return { ...baseToken, balance: walletToken.balance, usdValue: walletToken.usdValue };
            }
            return baseToken;
          }

          const walletToken = userTokens.find(
            (token) => token.address === t.address && token.chainId === t.chainId
          );
          if (walletToken && parseFloat(walletToken.usdValue.replace("$", "")) > 1) {
            // Only populate the balance if its USD value is > 1
            return {
              ...t,
              balance: walletToken.balance,
              usdValue: walletToken.usdValue,
            };
          }
          return t;
        });

        if (mergedResults.length > 0) {
          // Sort by USD value (descending)
          mergedResults.sort((a, b) => {
            const aValue = parseFloat(a.usdValue.replace("$", "").replace(",", "")) || 0;
            const bValue = parseFloat(b.usdValue.replace("$", "").replace(",", "")) || 0;
            return bValue - aValue;
          });
          // Preload icons for search results
          preloadImages(mergedResults.map((t) => t.icon).filter(Boolean));
          setSearchResults(mergedResults);
          setPopularTokens([]);
        } else {
          const q = debouncedQuery.trim().toLowerCase();
          const isAddr = q.startsWith("0x") && /^0x[a-f0-9]{6,40}$/.test(q);
          const existsInCache = mergedResults.find((r) => r.address === q);
          if (isAddr && !existsInCache && selectedNetwork !== Network.ALL) {
            const networkParam = selectedNetwork === Network.ETHEREUM ? "ethereum" : "base";
            fetch(`/api/token-metadata?network=${networkParam}&addresses=${q}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!data || !Array.isArray(data.data) || data.data.length === 0) return;
                const t = data.data[0] as {
                  name: string;
                  ticker: string;
                  icon: string | null;
                  price: number;
                  decimals: number;
                };
                const chainId = selectedNetwork === Network.ETHEREUM ? 1 : 8453;
                const built: TokenData = {
                  name: t.name,
                  ticker: t.ticker,
                  address: q,
                  balance: "0",
                  usdValue: "$0.00",
                  icon: t.icon || FALLBACK_TOKEN_ICON,
                  decimals: t.decimals,
                  chainId,
                };
                setSearchResults([built]);
                setPopularTokens([]);
              })
              .catch(() => {
                /* ignore errors */
              });
          } else {
            setSearchResults([]);
            setPopularTokens([]);
          }
        }

        return;
      }

      // No query: show wallet tokens if connected and available; otherwise popular tokens
      if (isConnected && address) {
        let tokens: TokenData[] = [];
        if (selectedNetwork === Network.ALL) {
          // Combine tokens from both chains
          const ethTokens = (userTokensByChain[1] || []).map((t) => ({ ...t, chainId: 1 }));
          const baseTokens = (userTokensByChain[8453] || []).map((t) => ({ ...t, chainId: 8453 }));
          tokens = [...ethTokens, ...baseTokens];
        } else {
          const chainId = selectedNetwork === Network.ETHEREUM ? 1 : 8453;
          tokens = (userTokensByChain[chainId] || []).map((t) => ({ ...t, chainId }));
        }

        // Deduplicate by chainId + address (user tokens come first, so they're preserved)
        const seenTokens = new Set<string>();
        tokens = tokens.filter((t) => {
          const key = `${t.chainId}-${t.address.toLowerCase()}`;
          if (seenTokens.has(key)) return false;
          seenTokens.add(key);
          return true;
        });

        // Sort tokens by USD value (descending)
        tokens.sort((a, b) => {
          const aValue = parseFloat(a.usdValue.replace("$", "").replace(",", "")) || 0;
          const bValue = parseFloat(b.usdValue.replace("$", "").replace(",", "")) || 0;
          return bValue - aValue;
        });

        // Get popular tokens for the selected network
        let networkPopularTokens: TokenData[] = [];
        if (selectedNetwork === Network.ALL) {
          networkPopularTokens = ALL_POPULAR_TOKENS;
        } else {
          const chainId = selectedNetwork === Network.ETHEREUM ? 1 : 8453;
          networkPopularTokens = (
            chainId === 8453 ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS
          ).map((t) => ({ ...t, chainId }));
        }

        // Filter popular tokens to exclude tokens user already has
        const userTokenAddresses = new Set(
          tokens.map((t) => `${t.chainId}-${t.address.toLowerCase()}`)
        );
        const filteredPopularTokens = networkPopularTokens.filter(
          (t) => !userTokenAddresses.has(`${t.chainId}-${t.address.toLowerCase()}`)
        );

        // Set user tokens
        setSearchResults(tokens);

        // Set filtered popular tokens
        preloadImages(filteredPopularTokens.map((t) => t.icon).filter(Boolean));
        setPopularTokens(filteredPopularTokens);
      } else {
        let networkPopularTokens: TokenData[] = [];
        if (selectedNetwork === Network.ALL) {
          networkPopularTokens = ALL_POPULAR_TOKENS;
        } else {
          const chainId = selectedNetwork === Network.ETHEREUM ? 1 : 8453;
          networkPopularTokens = (
            chainId === 8453 ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS
          ).map((t) => ({ ...t, chainId }));
        }
        preloadImages(networkPopularTokens.map((t) => t.icon).filter(Boolean));
        setSearchResults(networkPopularTokens);
        setPopularTokens([]);
      }
    } catch (e) {
      console.error("Failed to update asset list:", e);
      setSearchResults(ALL_POPULAR_TOKENS);
    } finally {
      setIsLoading(false);
    }
  }, [
    isOpen,
    isConnected,
    address,
    selectedNetwork,
    userTokensByChain,
    debouncedQuery,
    isSwappingForBTC,
  ]);

  if (!isOpen) return null;

  const formatUsdValue = (usdValue: string): string => {
    // Remove $ and any existing commas
    const numStr = usdValue.replace(/[$,]/g, "");
    const num = parseFloat(numStr);

    if (isNaN(num)) return usdValue;

    // Format with commas
    return (
      "$" +
      num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const handleAssetSelect = async (asset: string, tokenData?: TokenData) => {
    console.log("handleAssetSelect", asset, tokenData);
    if (tokenData) {
      // When swapping FOR BTC, set input token; when swapping FROM BTC, set output token
      if (isSwappingForBTC) {
        setSelectedInputToken(tokenData);
        setErc20Price(null);
      } else {
        setSelectedOutputToken(tokenData);
      }

      // Switch network to the selected token's chainId
      if (tokenData.chainId && isConnected) {
        const targetNetwork = tokenData.chainId === 1 ? Network.ETHEREUM : Network.BASE;
        setSelectedNetwork(targetNetwork);

        // Switch wallet chain if needed
        try {
          const targetChainId = tokenData.chainId === 1 ? mainnet.id : base.id;
          await switchChain({ chainId: targetChainId });
          setEvmConnectWalletChainId(targetChainId);
        } catch (error) {
          console.error("Failed to switch chain:", error);
        }
      }
    }
    if (isSwappingForBTC) {
      setDisplayedInputAmount("");
      setOutputAmount("");
      setInputUsdValue(ZERO_USD_DISPLAY);
    } else {
      // recalculate output based on input btc
    }
    onClose();
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
  };

  const handleNetworkSelect = async (network: Network) => {
    // Update selected network (no wallet switching for "all")
    setSelectedNetwork(network);

    // If "all" is selected or wallet not connected, just update the filter
    if (network === Network.ALL || !isConnected) {
      return;
    }

    // Switch wallet to the selected network
    // try {
    //   const targetChainId = network === Network.ETHEREUM ? mainnet.id : base.id;
    //   await switchChain({ chainId: targetChainId });
    //   setEvmConnectWalletChainId(targetChainId);
    // } catch (error) {
    //   console.error("Failed to switch chain:", error);
    // }
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
        <Flex gap="20px" align="stretch">
          {/* Chain Selector Panel - only show when swapping FOR BTC */}
          {isSwappingForBTC && !isMobile && (
            <Box
              bg="#131313"
              borderRadius="30px"
              py="24px"
              w="232px"
              maxH="670px"
              border="2px solid #232323"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Chain Selector Header */}
              <Box mx="20px" mb="16px">
                <Text
                  fontSize="14px"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  color={colors.textGray}
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="0.5px"
                >
                  Network
                </Text>
              </Box>

              {/* Chain Options */}
              <Flex direction="column" gap="4px" mx="12px">
                {/* All Networks */}
                <Flex
                  align="center"
                  gap="12px"
                  px="12px"
                  py="12px"
                  cursor="pointer"
                  borderRadius="12px"
                  bg={selectedNetwork === Network.ALL ? "#1f1f1f" : "transparent"}
                  _hover={{ bg: "#1f1f1f" }}
                  onClick={() => handleNetworkSelect(Network.ALL)}
                  transition="background 0.15s ease"
                >
                  {/* 4-circle network icon grid */}
                  <Box position="relative" w="28px" h="28px">
                    {/* Top-left: Ethereum */}
                    <Box
                      position="absolute"
                      top="0"
                      left="0"
                      w="16px"
                      h="16px"
                      borderRadius="50%"
                      bg="#1a1a2e"
                      border="1.5px solid #131313"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      overflow="hidden"
                      zIndex={4}
                    >
                      <Image
                        src="/images/assets/icons/ETH.svg"
                        w="10px"
                        h="10px"
                        alt="Ethereum"
                        objectFit="contain"
                      />
                    </Box>
                    {/* Top-right: Base */}
                    <Box
                      position="absolute"
                      top="0"
                      right="0"
                      w="16px"
                      h="16px"
                      borderRadius="50%"
                      bg="white"
                      border="1.5px solid #131313"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      overflow="hidden"
                      zIndex={3}
                    >
                      <BASE_LOGO width="10" height="10" />
                    </Box>
                    {/* Bottom-left: Placeholder A */}
                    <Box
                      position="absolute"
                      bottom="0"
                      left="0"
                      w="16px"
                      h="16px"
                      borderRadius="50%"
                      bg="#2a2a2a"
                      border="1.5px solid #131313"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      zIndex={2}
                    >
                      <Text fontSize="8px" color={colors.textGray} fontWeight="bold">
                        A
                      </Text>
                    </Box>
                    {/* Bottom-right: Placeholder S */}
                    <Box
                      position="absolute"
                      bottom="0"
                      right="0"
                      w="16px"
                      h="16px"
                      borderRadius="50%"
                      bg="#2a2a2a"
                      border="1.5px solid #131313"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      zIndex={1}
                    >
                      <Text fontSize="8px" color={colors.textGray} fontWeight="bold">
                        S
                      </Text>
                    </Box>
                  </Box>
                  <Text
                    fontSize="14px"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    color={colors.offWhite}
                    fontWeight="bold"
                  >
                    All Networks
                  </Text>
                </Flex>

                {/* Ethereum */}
                <Flex
                  align="center"
                  gap="12px"
                  px="12px"
                  py="12px"
                  cursor="pointer"
                  borderRadius="12px"
                  bg={selectedNetwork === Network.ETHEREUM ? "#1f1f1f" : "transparent"}
                  _hover={{ bg: "#1f1f1f" }}
                  onClick={() => handleNetworkSelect(Network.ETHEREUM)}
                  transition="background 0.15s ease"
                >
                  <Box
                    w="24px"
                    h="24px"
                    borderRadius="50%"
                    bg="#1a1a2e"
                    border="2px solid #131313"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    <Image
                      src="/images/assets/icons/ETH.svg"
                      w="14px"
                      h="14px"
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

                {/* Base */}
                <Flex
                  align="center"
                  gap="12px"
                  px="12px"
                  py="12px"
                  cursor="pointer"
                  borderRadius="12px"
                  bg={selectedNetwork === Network.BASE ? "#1f1f1f" : "transparent"}
                  _hover={{ bg: "#1f1f1f" }}
                  onClick={() => handleNetworkSelect(Network.BASE)}
                  transition="background 0.15s ease"
                >
                  <Box
                    w="24px"
                    h="24px"
                    borderRadius="50%"
                    bg="white"
                    border="2px solid #131313"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    <BASE_LOGO width="14" height="14" />
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
            </Box>
          )}

          {/* Main Asset Selector Modal */}
          <Box
            bg="#131313"
            borderRadius="30px"
            maxW="520px"
            w={isMobile ? "90vw" : "520px"}
            maxH="670px"
            border="2px solid #232323"
            onClick={(e) => e.stopPropagation()}
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            {/* Sticky Header Section */}
            <Box
              bg="#131313"
              pt="24px"
              pb={isSwappingForBTC ? "0" : "12px"}
              flexShrink={0}
              borderTopRadius="28px"
            >
              {/* Header */}
              <Flex justify="space-between" align="center" mb="12px" mt="-2px" mx="24px">
                <Text
                  fontSize="16px"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  color={colors.offWhite}
                  fontWeight="bold"
                >
                  {isSwappingForBTC ? "Select token to send" : "Select token to receive"}
                </Text>
                <Box
                  cursor="pointer"
                  onClick={onClose}
                  mt="-2px"
                  fontSize="24px"
                  color={colors.textGray}
                  _hover={{ color: colors.offWhite }}
                >
                  ×
                </Box>
              </Flex>

              {/* Search Bar - only show when swapping FOR BTC */}
              {isSwappingForBTC && (
                <Box position="relative" mb="18px" mx="24px">
                  {/* Search Icon */}
                  <Box
                    position="absolute"
                    left="18px"
                    top="50%"
                    transform="translateY(-50%)"
                    pointerEvents="none"
                    zIndex={1}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="11" cy="11" r="6" stroke={colors.textGray} strokeWidth="2" />
                      <path
                        d="M20 20L17 17"
                        stroke={colors.textGray}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Box>

                  {/* Search Input */}
                  <Input
                    ref={searchInputRef}
                    placeholder="Search tokens"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    bg="#212121"
                    borderRadius="30px"
                    pl="48px"
                    pr="20px"
                    py="12px"
                    letterSpacing="-0.9px"
                    border="none"
                    h="50px"
                    fontSize="16px"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color={colors.offWhite}
                    _placeholder={{ color: colors.textGray }}
                    _focus={{
                      border: "none",
                      boxShadow: "none",
                      outline: "none",
                    }}
                    _hover={{
                      border: "none",
                      boxShadow: "none",
                      outline: "none",
                    }}
                  />
                </Box>
              )}

              {/* Mobile Network Selector - horizontal scrollable list */}
              {isSwappingForBTC && isMobile && (
                <Flex
                  mx="24px"
                  mb="16px"
                  gap="8px"
                  overflowX="auto"
                  css={{
                    "&::-webkit-scrollbar": {
                      display: "none",
                    },
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {/* All Networks */}
                  <Flex
                    align="center"
                    gap="6px"
                    px="12px"
                    py="8px"
                    cursor="pointer"
                    borderRadius="20px"
                    bg={selectedNetwork === Network.ALL ? "#2a2a2a" : "#1a1a1a"}
                    border={
                      selectedNetwork === Network.ALL ? "1px solid #3a3a3a" : "1px solid #232323"
                    }
                    onClick={() => handleNetworkSelect(Network.ALL)}
                    transition="background 0.15s ease"
                    flexShrink={0}
                  >
                    {/* Mini 4-circle grid */}
                    <Box position="relative" w="18px" h="18px">
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        w="10px"
                        h="10px"
                        borderRadius="50%"
                        bg="#1a1a2e"
                        border="1px solid #131313"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        overflow="hidden"
                        zIndex={4}
                      >
                        <Image
                          src="/images/assets/icons/ETH.svg"
                          w="6px"
                          h="6px"
                          alt="ETH"
                          objectFit="contain"
                        />
                      </Box>
                      <Box
                        position="absolute"
                        top="0"
                        right="0"
                        w="10px"
                        h="10px"
                        borderRadius="50%"
                        bg="white"
                        border="1px solid #131313"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        overflow="hidden"
                        zIndex={3}
                      >
                        <BASE_LOGO width="6" height="6" />
                      </Box>
                      <Box
                        position="absolute"
                        bottom="0"
                        left="0"
                        w="10px"
                        h="10px"
                        borderRadius="50%"
                        bg="#2a2a2a"
                        border="1px solid #131313"
                        zIndex={2}
                      />
                      <Box
                        position="absolute"
                        bottom="0"
                        right="0"
                        w="10px"
                        h="10px"
                        borderRadius="50%"
                        bg="#2a2a2a"
                        border="1px solid #131313"
                        zIndex={1}
                      />
                    </Box>
                    <Text
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      color={colors.offWhite}
                      fontWeight="bold"
                      whiteSpace="nowrap"
                    >
                      All Networks
                    </Text>
                  </Flex>

                  {/* Ethereum */}
                  <Flex
                    align="center"
                    gap="6px"
                    px="12px"
                    py="8px"
                    cursor="pointer"
                    borderRadius="20px"
                    bg={selectedNetwork === Network.ETHEREUM ? "#2a2a2a" : "#1a1a1a"}
                    border={
                      selectedNetwork === Network.ETHEREUM
                        ? "1px solid #3a3a3a"
                        : "1px solid #232323"
                    }
                    onClick={() => handleNetworkSelect(Network.ETHEREUM)}
                    transition="background 0.15s ease"
                    flexShrink={0}
                  >
                    <Box
                      w="18px"
                      h="18px"
                      borderRadius="50%"
                      bg="#1a1a2e"
                      border="1.5px solid #131313"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      overflow="hidden"
                    >
                      <Image
                        src="/images/assets/icons/ETH.svg"
                        w="12px"
                        h="12px"
                        alt="Ethereum"
                        objectFit="contain"
                      />
                    </Box>
                    <Text
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      color={colors.offWhite}
                      fontWeight="bold"
                      whiteSpace="nowrap"
                    >
                      Ethereum
                    </Text>
                  </Flex>

                  {/* Base */}
                  <Flex
                    align="center"
                    gap="6px"
                    px="12px"
                    py="8px"
                    cursor="pointer"
                    borderRadius="20px"
                    bg={selectedNetwork === Network.BASE ? "#2a2a2a" : "#1a1a1a"}
                    border={
                      selectedNetwork === Network.BASE ? "1px solid #3a3a3a" : "1px solid #232323"
                    }
                    onClick={() => handleNetworkSelect(Network.BASE)}
                    transition="background 0.15s ease"
                    flexShrink={0}
                  >
                    <Box
                      w="18px"
                      h="18px"
                      borderRadius="50%"
                      bg="white"
                      border="1.5px solid #131313"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      overflow="hidden"
                    >
                      <BASE_LOGO width="12" height="12" />
                    </Box>
                    <Text
                      fontSize="12px"
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      color={colors.offWhite}
                      fontWeight="bold"
                      whiteSpace="nowrap"
                    >
                      Base
                    </Text>
                  </Flex>
                </Flex>
              )}
            </Box>

            {/* Scrollable Token List */}
            <Box
              flex="1"
              overflowY="auto"
              pb="24px"
              css={{
                "&::-webkit-scrollbar": {
                  display: "none",
                },
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <Flex direction="column" gap="4px" mb="20px">
                {/* Loading state */}
                {isLoading ? (
                  <Box mx="12px">
                    <Flex
                      align="center"
                      justify="center"
                      h="60px"
                      borderRadius="12px"
                      bg="#131313"
                      px="12px"
                    >
                      <Text
                        fontSize="14px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.textGray}
                      >
                        Loading tokens...
                      </Text>
                    </Flex>
                  </Box>
                ) : searchResults.length === 0 && debouncedQuery.length > 0 ? (
                  <Box mx="12px">
                    <Flex
                      direction="column"
                      align="center"
                      justify="center"
                      h="120px"
                      borderRadius="12px"
                      bg="#131313"
                      px="20px"
                      gap="8px"
                    >
                      <Text
                        fontSize="16px"
                        fontFamily={FONT_FAMILIES.NOSTROMO}
                        color={colors.offWhite}
                        fontWeight="bold"
                        textAlign="center"
                      >
                        No results found
                      </Text>
                      <Text
                        fontSize="14px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={colors.textGray}
                        textAlign="center"
                        lineHeight="1.5"
                      >
                        Try searching by token name or paste a contract address
                      </Text>
                    </Flex>
                  </Box>
                ) : (
                  <>
                    {/* Your Tokens Section - only show if wallet connected and has tokens */}
                    {isConnected && searchResults.length > 0 && (
                      <>
                        <Box mx="24px" mb="8px" mt="4px">
                          <Text
                            fontSize="13px"
                            fontFamily={FONT_FAMILIES.NOSTROMO}
                            color={colors.textGray}
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.5px"
                          >
                            {debouncedQuery.length > 0 ? "Search Results" : "Your Tokens"}
                          </Text>
                        </Box>
                        {searchResults.map((token, index) => (
                          <Box
                            key={`user-${token.address || token.ticker}-${index}`}
                            mx="12px"
                            cursor="pointer"
                            onClick={() => handleAssetSelect(token.ticker, token)}
                          >
                            <Flex
                              align="center"
                              py="12px"
                              px="12px"
                              letterSpacing="-0.6px"
                              borderRadius="12px"
                              bg="#131313"
                              transition="background 0.15s ease"
                              _hover={{ bg: "#1f1f1f" }}
                            >
                              {/* Token Icon with Network Badge */}
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
                                  <Text
                                    fontSize="12px"
                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                    color={colors.offWhite}
                                    display="none"
                                  >
                                    {token.ticker}
                                  </Text>
                                </Flex>

                                {/* Network Badge */}
                                {token.chainId && (
                                  <Box
                                    position="absolute"
                                    bottom="-2px"
                                    right="-2px"
                                    w="20px"
                                    h="20px"
                                    borderRadius="50%"
                                    bg={token.chainId === 8453 ? "white" : "#1a1a2e"}
                                    border="2px solid #131313"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    overflow="hidden"
                                  >
                                    <NetworkBadge chainId={token.chainId} />
                                  </Box>
                                )}
                              </Box>

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
                                  {!isMobile && token.address && (
                                    <Text
                                      fontSize="14px"
                                      fontFamily={FONT_FAMILIES.AUX_MONO}
                                      color={colors.darkerGray}
                                    >
                                      {`${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
                                    </Text>
                                  )}
                                </Flex>
                              </Flex>

                              {/* Balance Info - show for wallet tokens with balance > 0 */}
                              {isConnected && token.balance !== "0" && (
                                <Flex direction="column" align="flex-end">
                                  <Text
                                    fontSize="16px"
                                    fontFamily={FONT_FAMILIES.NOSTROMO}
                                    color={colors.offWhite}
                                    fontWeight="bold"
                                  >
                                    {formatUsdValue(token.usdValue)}
                                  </Text>
                                  <Text
                                    fontSize="14px"
                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                    color={colors.textGray}
                                  >
                                    {token.balance.slice(0, 9)}
                                  </Text>
                                </Flex>
                              )}
                            </Flex>
                          </Box>
                        ))}
                      </>
                    )}

                    {/* Popular Section - show if wallet connected and there are popular tokens to display */}
                    {isConnected && popularTokens.length > 0 && (
                      <>
                        <Box mx="24px" mb="8px" mt={searchResults.length > 0 ? "16px" : "4px"}>
                          <Text
                            fontSize="13px"
                            fontFamily={FONT_FAMILIES.NOSTROMO}
                            color={colors.textGray}
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.5px"
                          >
                            Popular
                          </Text>
                        </Box>
                        {popularTokens.map((token, index) => (
                          <Box
                            key={`popular-${token.address || token.ticker}-${index}`}
                            mx="12px"
                            cursor="pointer"
                            onClick={() => handleAssetSelect(token.ticker, token)}
                          >
                            <Flex
                              align="center"
                              py="12px"
                              px="12px"
                              letterSpacing="-0.6px"
                              borderRadius="12px"
                              bg="#131313"
                              transition="background 0.15s ease"
                              _hover={{ bg: "#1f1f1f" }}
                            >
                              {/* Token Icon with Network Badge */}
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
                                  <Text
                                    fontSize="12px"
                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                    color={colors.offWhite}
                                    display="none"
                                  >
                                    {token.ticker}
                                  </Text>
                                </Flex>

                                {/* Network Badge */}
                                {token.chainId && (
                                  <Box
                                    position="absolute"
                                    bottom="-2px"
                                    right="-2px"
                                    w="20px"
                                    h="20px"
                                    borderRadius="50%"
                                    bg={token.chainId === 8453 ? "white" : "#1a1a2e"}
                                    border="2px solid #131313"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    overflow="hidden"
                                  >
                                    <NetworkBadge chainId={token.chainId} />
                                  </Box>
                                )}
                              </Box>

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
                                  {!isMobile && token.address && (
                                    <Text
                                      fontSize="14px"
                                      fontFamily={FONT_FAMILIES.AUX_MONO}
                                      color={colors.darkerGray}
                                    >
                                      {`${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
                                    </Text>
                                  )}
                                </Flex>
                              </Flex>
                            </Flex>
                          </Box>
                        ))}
                      </>
                    )}

                    {/* When not connected, show popular tokens with section header */}
                    {!isConnected && searchResults.length > 0 && (
                      <>
                        <Box mx="24px" mb="8px" mt="4px">
                          <Text
                            fontSize="13px"
                            fontFamily={FONT_FAMILIES.NOSTROMO}
                            color={colors.textGray}
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.5px"
                          >
                            Popular
                          </Text>
                        </Box>
                        {searchResults.map((token, index) => (
                          <Box
                            key={`${token.address || token.ticker}-${index}`}
                            mx="12px"
                            cursor="pointer"
                            onClick={() => handleAssetSelect(token.ticker, token)}
                          >
                            <Flex
                              align="center"
                              py="12px"
                              px="12px"
                              letterSpacing="-0.6px"
                              borderRadius="12px"
                              bg="#131313"
                              transition="background 0.15s ease"
                              _hover={{ bg: "#1f1f1f" }}
                            >
                              {/* Token Icon with Network Badge */}
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
                                  <Text
                                    fontSize="12px"
                                    fontFamily={FONT_FAMILIES.AUX_MONO}
                                    color={colors.offWhite}
                                    display="none"
                                  >
                                    {token.ticker}
                                  </Text>
                                </Flex>

                                {/* Network Badge */}
                                {token.chainId && (
                                  <Box
                                    position="absolute"
                                    bottom="-2px"
                                    right="-2px"
                                    w="20px"
                                    h="20px"
                                    borderRadius="50%"
                                    bg={token.chainId === 8453 ? "white" : "#1a1a2e"}
                                    border="2px solid #131313"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    overflow="hidden"
                                  >
                                    <NetworkBadge chainId={token.chainId} />
                                  </Box>
                                )}
                              </Box>

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
                                  {!isMobile && token.address && (
                                    <Text
                                      fontSize="14px"
                                      fontFamily={FONT_FAMILIES.AUX_MONO}
                                      color={colors.darkerGray}
                                    >
                                      {`${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
                                    </Text>
                                  )}
                                </Flex>
                              </Flex>
                            </Flex>
                          </Box>
                        ))}
                      </>
                    )}
                  </>
                )}
              </Flex>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Portal>
  );
};
