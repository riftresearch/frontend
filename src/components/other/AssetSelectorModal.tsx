import { Flex, Text, Box, Image, Portal, Input } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { BASE_LOGO } from "./SVGs";
import { useState, useEffect, useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useStore } from "@/utils/store";
import { mainnet, base } from "@reown/appkit/networks";
import { TokenData } from "@/utils/types";
import { searchTokens } from "@/utils/tokenSearch";
import { preloadImages } from "@/utils/imagePreload";
import {
  FALLBACK_TOKEN_ICON,
  ETH_ICON,
  BASE_POPULAR_TOKENS,
  ETHEREUM_POPULAR_TOKENS,
  ZERO_USD_DISPLAY,
} from "@/utils/constants";

interface AssetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAsset: string;
}

type Network = "ethereum" | "base";

export const AssetSelectorModal: React.FC<AssetSelectorModalProps> = ({
  isOpen,
  onClose,
  currentAsset,
}) => {
  const { evmConnectWalletChainId } = useStore();

  // Initialize selectedNetwork based on current chain ID
  const getNetworkFromChainId = (chainId: number): Network => {
    return chainId === base.id ? "base" : "ethereum";
  };

  const [selectedNetwork, setSelectedNetwork] = useState<Network>(
    getNetworkFromChainId(evmConnectWalletChainId)
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  // Wagmi hooks for chain switching
  const { isConnected, address } = useAccount();
  const { switchChain } = useSwitchChain();

  // Zustand store
  const {
    searchResults,
    setSearchResults,
    setEvmConnectWalletChainId,
    setSelectedInputToken,
    isSwappingForBTC,
    setRawInputAmount,
    setOutputAmount,
    userTokensByChain,
    setErc20Price,
    setInputUsdValue,
  } = useStore();

  // Sync selectedNetwork with current chain ID when it changes
  useEffect(() => {
    setSelectedNetwork(getNetworkFromChainId(evmConnectWalletChainId));
  }, [evmConnectWalletChainId]);

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 180);
    return () => clearTimeout(h);
  }, [searchQuery]);

  // Preload popular token icons for the selected network when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const icons = (selectedNetwork === "base" ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS)
      .map((t) => t.icon)
      .filter(Boolean);
    preloadImages(icons as string[]);
  }, [isOpen, selectedNetwork]);

  // Token fetching/pricing handled globally; modal reads from store

  // Load tokens from global store when modal opens or dependencies change
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const chainId = selectedNetwork === "ethereum" ? 1 : 8453;
      // If there's an active query, use the search index top-10
      if (debouncedQuery.length > 0) {
        const results = searchTokens(selectedNetwork, debouncedQuery, 10);

        // Get user's wallet tokens for the current chain
        const chainId = selectedNetwork === "ethereum" ? 1 : 8453;
        const userTokens = userTokensByChain[chainId] || [];

        // Replace balance and usdValue in search results if token is in user's wallet
        const mergedResults = results.map((t) => {
          const walletToken = userTokens.find((token) => token.address === t.address);
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
          // Preload icons for search results
          preloadImages(mergedResults.map((t) => t.icon).filter(Boolean));
          setSearchResults(mergedResults);
        } else {
          const q = debouncedQuery.trim().toLowerCase();
          const isAddr = q.startsWith("0x") && /^0x[a-f0-9]{6,40}$/.test(q);
          const existsInCache = mergedResults.find((r) => r.address === q);
          if (isAddr && !existsInCache) {
            const networkParam = selectedNetwork === "ethereum" ? "ethereum" : "base";
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
                const built: TokenData = {
                  name: t.name,
                  ticker: t.ticker,
                  address: q,
                  balance: "0",
                  usdValue: "$0.00",
                  icon: t.icon || FALLBACK_TOKEN_ICON,
                  decimals: t.decimals,
                };
                setSearchResults([built]);
              })
              .catch(() => {
                /* ignore errors */
              });
          } else {
            setSearchResults([]);
          }
        }

        return;
      }

      // No query: show wallet tokens if connected and available; otherwise popular tokens
      if (isConnected && address) {
        const tokens = userTokensByChain[chainId] || [];
        if (tokens.length > 0) {
          setSearchResults(tokens);
        } else {
          const popularTokens = chainId === 8453 ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS;
          preloadImages(popularTokens.map((t) => t.icon).filter(Boolean));
          setSearchResults(popularTokens);
        }
      } else {
        const popularTokens = chainId === 8453 ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS;
        preloadImages(popularTokens.map((t) => t.icon).filter(Boolean));
        setSearchResults(popularTokens);
      }
    } catch (e) {
      console.error("Failed to update asset list:", e);
      setSearchResults(ETHEREUM_POPULAR_TOKENS);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, isConnected, address, selectedNetwork, userTokensByChain, debouncedQuery]);

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
      setSelectedInputToken(tokenData);
      setErc20Price(null);
    }
    if (isSwappingForBTC) {
      setRawInputAmount("");
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
    if (!isConnected) {
      // If wallet is not connected, just update the selected network
      setSelectedNetwork(network);
      return;
    }

    try {
      const targetChainId = network === "ethereum" ? mainnet.id : base.id;

      // Switch to the target chain
      await switchChain({ chainId: targetChainId });

      // Update the store with the new chain ID
      setEvmConnectWalletChainId(targetChainId);

      // Update the selected network
      setSelectedNetwork(network);
    } catch (error) {
      console.error("Failed to switch chain:", error);
      // You could add a toast notification here for better UX
    }
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
          bg="#131313"
          borderRadius="20px"
          py="24px"
          maxW="520px"
          w="90%"
          maxH="80vh"
          overflowY="auto"
          border="2px solid #232323"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Flex justify="space-between" align="center" mb="12px" mt="-2px" mx="24px">
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              fontWeight="bold"
            >
              Select a token
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

          {/* Network Selector */}
          {/* <Flex gap="12px" mb="20px">
            <Flex
              direction="column"
              align="center"
              justify="center"
              flex="1"
              h="80px"
              borderRadius="12px"
              border={`2px solid ${selectedNetwork === "ethereum" ? "#8B5CF6" : "#404040"}`}
              bg={selectedNetwork === "ethereum" ? "rgba(139, 92, 246, 0.2)" : "#2a2a2a"}
              cursor="pointer"
              onClick={() => handleNetworkSelect("ethereum")}
              _hover={{ bg: selectedNetwork === "ethereum" ? "rgba(139, 92, 246, 0.3)" : "#333" }}
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
              // border={`2px solid ${selectedNetwork === 'base' ? '#0052FF' : '#404040'}`}
              // bg={selectedNetwork === 'base' ? 'rgba(0, 82, 255, 0.2)' : '#2a2a2a'}
              // cursor="pointer"
              // onClick={() => handleNetworkSelect('base')}
              // _hover={{ bg: selectedNetwork === 'base' ? 'rgba(0, 82, 255, 0.3)' : '#333' }}
              border={`2px solid #404040`}
              bg="#2a2a2a"
              cursor="not-allowed"
              // Remove onClick to disable
              _hover={{ bg: "#2a2a2a" }}
              opacity={0.6}
              pointerEvents="none"
              position="relative"
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
                Base (Soon)
              </Text>
            </Flex>
          </Flex> */}

          {/* Search Bar */}
          <Box position="relative" mb="18px" mx="24px">
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
            <Input
              placeholder="Search tokens"
              value={searchQuery}
              onChange={handleSearchChange}
              bg="#212121"
              borderRadius="30px"
              pl="48px"
              pr="16px"
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
                  <Text fontSize="14px" fontFamily={FONT_FAMILIES.AUX_MONO} color={colors.textGray}>
                    Loading tokens...
                  </Text>
                </Flex>
              </Box>
            ) : (
              searchResults.map((token, index) => (
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
                    {/* Token Icon */}
                    <Flex
                      w="40px"
                      h="40px"
                      borderRadius="50%"
                      bg="#404040"
                      align="center"
                      justify="center"
                      mr="12px"
                      overflow="hidden"
                    >
                      <Image
                        src={token.icon}
                        w="100%"
                        h="100%"
                        alt={`${token.ticker} icon`}
                        objectFit="cover"
                        // onError={(e) => {
                        //   const target = e.target as HTMLImageElement;
                        //   target.style.display = 'none';
                        //   const fallback = target.nextElementSibling as HTMLElement;
                        //   if (fallback) fallback.style.display = 'block';
                        // }}
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
                          {token.balance}
                        </Text>
                      </Flex>
                    )}
                  </Flex>
                </Box>
              ))
            )}
          </Flex>
        </Box>
      </Box>
    </Portal>
  );
};
