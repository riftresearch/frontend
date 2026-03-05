import React, { useEffect, useState } from "react";
import { Button, Flex, Image, Box } from "@chakra-ui/react";
import { useStore } from "@/utils/store";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { formatUnits } from "viem";
import type { TokenData } from "@/utils/types";
import { Network } from "@/utils/types";
import { preloadImages } from "@/utils/imagePreload";
import { FALLBACK_TOKEN_ICON } from "@/utils/constants";
import useWindowSize from "@/hooks/useWindowSize";
import { WalletPanel } from "./WalletPanel";
import {
  fetchWalletTokens,
  fetchAllTokenPrices,
  fetchUserEth,
  getMetadata,
  getDefiLlamaChain,
  getChainId,
  SUPPORTED_CHAIN_NETWORKS,
} from "@/utils/userTokensClient";
// import { useWalletOptions } from "@dynamic-labs/sdk-react-core";

// Dynamic's icon sprite URL
const DYNAMIC_ICON_BASE = "https://iconic.dynamic-static-assets.com/icons/sprite.svg";

export const ConnectWalletButton: React.FC = () => {
  // Get EVM wallet state from global store (set via Dynamic's onAuthSuccess callback)
  const primaryEvmAddress = useStore((state) => state.primaryEvmAddress);
  const isEvmConnected = !!primaryEvmAddress;

  const { setUserTokensForChain, setUserTokensForWallet, setSearchResults, inputToken, setInputToken } =
    useStore();
  const { isMobile } = useWindowSize();
  const { setShowAuthFlow, primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Check if ANY wallet is connected (EVM or Bitcoin)
  const isConnected = !!primaryWallet;

  // Auto-open panel when user actively connects (not on page refresh/session restore)
  const prevIsConnectedRef = React.useRef(isConnected);
  const [isSessionRestoreWindow, setIsSessionRestoreWindow] = React.useState(true);
  useEffect(() => {
    // Give Dynamic 2 seconds to restore the session before we start tracking transitions.
    // Any connected->true change during this window is session restore, not an active connect.
    const timer = setTimeout(() => setIsSessionRestoreWindow(false), 2000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    // During session restore window, just track the state without opening
    if (isSessionRestoreWindow) {
      prevIsConnectedRef.current = isConnected;
      return;
    }
    // After window: trigger when going from disconnected to connected (active connect action)
    if (isConnected && !prevIsConnectedRef.current) {
      setIsPanelOpen(true);
    }
    prevIsConnectedRef.current = isConnected;
  }, [isConnected, isSessionRestoreWindow]);

  // Get wallet icon key for Dynamic sprite - use connector name directly
  const getWalletIconKey = (wallet: any): string => {
    const name = wallet.connector?.name?.toLowerCase() || wallet.key?.toLowerCase() || "walletconnect";
    // Remove spaces and normalize common wallet names for Dynamic sprite
    const normalized = name.replace(/\s+/g, "");
    // Handle specific wallet name mappings
    if (normalized.includes("okx")) return "okx";
    return normalized;
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get all connected EVM wallet addresses
  const evmWalletAddresses = React.useMemo(() => {
    return userWallets
      .filter((w) => w.chain?.toUpperCase() === "EVM")
      .map((w) => w.address);
  }, [userWallets]);

  // Track if we've already fetched for current wallet addresses to prevent duplicate fetches
  const fetchedWalletsRef = React.useRef<string>("");

  // Fetch user tokens and populate global store when EVM wallets connect
  useEffect(() => {
    // Create a stable key from wallet addresses to detect actual changes
    const walletsKey = evmWalletAddresses.sort().join(",");
    
    // Skip if we've already fetched for these exact wallets
    if (walletsKey === fetchedWalletsRef.current) {
      return;
    }

    const fetchTokensForWallet = async (walletAddress: string): Promise<TokenData[]> => {
      console.log("[UserTokens] Fetching tokens for wallet:", walletAddress);

      let walletTokensByChain: Awaited<ReturnType<typeof fetchWalletTokens>>;
      let ethByChain: Awaited<ReturnType<typeof fetchUserEth>>;
      
      try {
        [walletTokensByChain, ethByChain] = await Promise.all([
          fetchWalletTokens(walletAddress),
          fetchUserEth(walletAddress),
        ]);
      } catch (error) {
        console.error("[UserTokens] Failed to fetch tokens for wallet:", walletAddress, error);
        // Return empty array on fetch failure - don't clear existing data
        return [];
      }

      const addressesByChain: Partial<Record<Network, string[]>> = {};
      for (const network of SUPPORTED_CHAIN_NETWORKS) {
        const tokens = walletTokensByChain[network];
        if (tokens && tokens.length > 0) {
          const filtered = tokens.filter((t) => t.name && t.symbol && t.address);
          addressesByChain[network] = filtered.map((t) => t.address.toLowerCase());
        }
      }

      const pricesByChain = await fetchAllTokenPrices(addressesByChain);
      const walletAllTokens: TokenData[] = [];

      for (const network of SUPPORTED_CHAIN_NETWORKS) {
        const walletTokens = walletTokensByChain[network] || [];
        const ethToken = ethByChain[network];
        const prices = pricesByChain[network] || {};
        const chainIdNum = getChainId(network);
        const defillamaChain = getDefiLlamaChain(network);
        const metadata = getMetadata(network);

        if (walletTokens.length === 0 && !ethToken) {
          setUserTokensForWallet(walletAddress, chainIdNum, []);
          continue;
        }

        const filteredWalletTokens = walletTokens.filter((t) => t.name && t.symbol && t.address);

        const results: TokenData[] = await Promise.all(
          filteredWalletTokens.map(async (t) => {
            const addr = t.address.toLowerCase();
            const priceData = prices[addr];
            const decimals = priceData?.decimals ?? t.decimals ?? 18;
            let balanceStr = "0";
            try {
              balanceStr = formatUnits(BigInt(t.totalBalance), decimals);
            } catch {
              balanceStr = "0";
            }

            const price = priceData?.price ?? 0;
            const usd = Number(balanceStr) * Number(price);

            if (usd < 1) {
              return null;
            }

            let tokenData:
              | { name?: string; ticker?: string; decimals?: number; icon?: string | null }
              | undefined = metadata[addr];

            if (!tokenData && defillamaChain) {
              try {
                const response = await fetch(
                  `/api/token-metadata?network=${defillamaChain}&addresses=${addr}`,
                  { method: "GET" }
                );
                const apiResult = await response.json();
                if (apiResult.data && apiResult.data.length > 0) {
                  tokenData = apiResult.data[0];
                }
              } catch {
                // Keep tokenData undefined
              }
            }

            return {
              name: tokenData?.name || t.name,
              ticker: tokenData?.ticker || t.symbol,
              address: t.address,
              balance: balanceStr,
              usdValue: `$${usd.toFixed(2)}`,
              icon: tokenData?.icon || FALLBACK_TOKEN_ICON,
              decimals: tokenData?.decimals || decimals,
              chain: chainIdNum,
            } as TokenData;
          })
        ).then((results) => results.filter((item): item is TokenData => item !== null));

        if (ethToken) {
          results.push(ethToken);
        }

        const sorted = results.sort((a, b) => {
          const usdValueA = parseFloat(a.usdValue.replace("$", ""));
          const usdValueB = parseFloat(b.usdValue.replace("$", ""));
          return usdValueB - usdValueA;
        });

        preloadImages(sorted.map((t) => t.icon));
        console.log(`[UserTokens] Wallet ${walletAddress} Chain ${network}: ${sorted.length} tokens`);
        
        setUserTokensForWallet(walletAddress, chainIdNum, sorted);
        walletAllTokens.push(...sorted);
      }

      return walletAllTokens;
    };

    const fetchAllUserTokens = async () => {
      if (evmWalletAddresses.length === 0) return;

      // Mark these wallets as being fetched
      fetchedWalletsRef.current = walletsKey;

      console.log("[UserTokens] Fetching tokens for all EVM wallets:", evmWalletAddresses);

      try {
        const allWalletTokens = await Promise.all(
          evmWalletAddresses.map((addr) => fetchTokensForWallet(addr))
        );

        const allTokensFlat = allWalletTokens.flat();
        
        // Only update search results if we got some data
        // This prevents clearing existing data on network failures
        if (allTokensFlat.length > 0) {
          const combinedSorted = allTokensFlat.sort((a, b) => {
            const usdValueA = parseFloat(a.usdValue.replace("$", ""));
            const usdValueB = parseFloat(b.usdValue.replace("$", ""));
            return usdValueB - usdValueA;
          });

          setSearchResults(combinedSorted);
        }

        if (primaryEvmAddress) {
          const primaryWalletTokens = useStore.getState().userTokensByWallet[primaryEvmAddress.toLowerCase()] || {};
          for (const [chainIdStr, tokens] of Object.entries(primaryWalletTokens)) {
            setUserTokensForChain(Number(chainIdStr), tokens);
          }
        }

        // Update input token balance if needed (read current state directly to avoid dependency)
        const currentInputToken = useStore.getState().inputToken;
        if (currentInputToken.balance === "0" && primaryEvmAddress) {
          const inputTokenChain = currentInputToken.chain === "bitcoin" ? 1 : (currentInputToken.chain ?? 1);
          const primaryWalletTokens = useStore.getState().userTokensByWallet[primaryEvmAddress.toLowerCase()] || {};
          const userTokensForChain = primaryWalletTokens[inputTokenChain] || [];
          const matchingToken = userTokensForChain.find(
            (t) => t.address.toLowerCase() === currentInputToken.address.toLowerCase()
          );
          if (matchingToken) {
            useStore.getState().setInputToken({
              ...currentInputToken,
              balance: matchingToken.balance,
              usdValue: matchingToken.usdValue,
            });
          }
        }
      } catch (error) {
        console.error("[UserTokens] Failed to fetch all user tokens:", error);
        // Don't update state on failure - keep existing data
        // Reset the ref so we can retry on next render
        fetchedWalletsRef.current = "";
      }
    };

    fetchAllUserTokens();
  }, [
    evmWalletAddresses,
    primaryEvmAddress,
    setUserTokensForChain,
    setUserTokensForWallet,
    setSearchResults,
  ]);

  // Handler for opening the Dynamic wallet modal (used as fallback)
  const handleOpen = (): void => {
    setShowAuthFlow(true);
  };

  return (
    <>
      {!isConnected ? (
        <Button
          onClick={handleOpen}
          cursor={"pointer"}
          color={colors.offWhite}
          _active={{ bg: colors.swapBgColor }}
          _hover={{ bg: colors.swapHoverColor }}
          borderRadius="30px"
          border={`2px solid ${colors.swapBorderColor}`}
          fontFamily={FONT_FAMILIES.NOSTROMO}
          type="button"
          fontSize={isMobile ? "14px" : "17px"}
          letterSpacing="-1px"
          paddingX={isMobile ? "20px" : "28px"}
          h={isMobile ? "36px" : "42px"}
          paddingY={"10px"}
          bg={colors.swapBgColor}
          boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
        >
          Connect Wallet
        </Button>
      ) : (
        <Flex
          onClick={() => setIsPanelOpen(true)}
          cursor="pointer"
          align="center"
          gap="8px"
          bg={"#101010"}
          borderRadius="15px"
          transition="all 0.2s ease-in-out"
          border={`2px solid #404040`}
          px={isMobile ? "12px" : "16px"}
          h={isMobile ? "36px" : "42px"}
          _hover={{ bg: "#202020" }}
        >
          {/* Wallet Icons Stack */}
          <Flex>
            {userWallets.slice(0, 3).map((wallet, idx) => (
              <Box
                key={wallet.id}
                w={isMobile ? "18px" : "22px"}
                h={isMobile ? "18px" : "22px"}
                borderRadius="4px"
                ml={idx > 0 ? "-6px" : "0"}
                border={`2px solid #101010`}
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
          {/* Address or Wallet Count */}
          {!isMobile && primaryWallet && (
            <Flex
              color={colors.offWhite}
              fontSize="15px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              letterSpacing="-0.5px"
            >
              {formatAddress(primaryWallet.address)}
            </Flex>
          )}
        </Flex>
      )}

      {/* Wallet Panel Slide-out */}
      <WalletPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onConnectNewWallet={() => setShowAuthFlow(true)}
      />
    </>
  );
};
