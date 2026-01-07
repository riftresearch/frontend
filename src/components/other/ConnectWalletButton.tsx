import React, { useEffect, useState } from "react";
import { Button, Flex, Image, Box } from "@chakra-ui/react";
import { useAccount } from "wagmi";
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

// Dynamic's icon sprite URL
const DYNAMIC_ICON_BASE = "https://iconic.dynamic-static-assets.com/icons/sprite.svg";

export const ConnectWalletButton: React.FC = () => {
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const { setUserTokensForChain, setSearchResults, selectedInputToken, setSelectedInputToken } =
    useStore();
  const { isMobile } = useWindowSize();
  const { setShowAuthFlow, primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Check if ANY wallet is connected (EVM or Bitcoin)
  const isConnected = !!primaryWallet;

  // Find any EVM wallet from Dynamic's connected wallets
  const evmWallet = userWallets.find(
    (w) =>
      w.chain === "EVM" ||
      w.chain === "evm" ||
      w.connector?.name?.toLowerCase()?.includes("metamask") ||
      w.connector?.name?.toLowerCase()?.includes("coinbase")
  );

  // Use wagmi address if available, otherwise try to get from Dynamic's EVM wallet
  const evmAddress = wagmiAddress || evmWallet?.address;
  const isEvmConnected = isWagmiConnected || !!evmWallet;

  // Get wallet icon key for Dynamic sprite - use connector name directly
  const getWalletIconKey = (wallet: any): string => {
    return wallet.connector?.name?.toLowerCase() || wallet.key?.toLowerCase() || "walletconnect";
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Fetch user tokens and populate global store when EVM wallet connects
  useEffect(() => {
    const fetchAllUserTokens = async () => {
      if (!isEvmConnected || !evmAddress) return;

      console.log("[UserTokens] Fetching tokens for all chains...", evmAddress);

      // Fetch all ERC20 tokens and ETH balances across all chains in parallel
      const [walletTokensByChain, ethByChain] = await Promise.all([
        fetchWalletTokens(evmAddress),
        fetchUserEth(evmAddress),
      ]);
      console.log("[UserTokens] walletTokensByChain", walletTokensByChain);

      // Build addresses by chain for price fetching
      const addressesByChain: Partial<Record<Network, string[]>> = {};
      for (const network of SUPPORTED_CHAIN_NETWORKS) {
        const tokens = walletTokensByChain[network];
        if (tokens && tokens.length > 0) {
          const filtered = tokens.filter((t) => t.name && t.symbol && t.address);
          addressesByChain[network] = filtered.map((t) => t.address.toLowerCase());
        }
      }

      // Fetch prices for all tokens across all chains
      const pricesByChain = await fetchAllTokenPrices(addressesByChain);

      // Process tokens for each chain
      const allSortedTokens: TokenData[] = [];

      for (const network of SUPPORTED_CHAIN_NETWORKS) {
        const walletTokens = walletTokensByChain[network] || [];
        const ethToken = ethByChain[network];
        const prices = pricesByChain[network] || {};
        const chainIdNum = getChainId(network);
        const defillamaChain = getDefiLlamaChain(network);
        const metadata = getMetadata(network);

        // If no tokens and no ETH for this chain, set empty array
        if (walletTokens.length === 0 && !ethToken) {
          setUserTokensForChain(chainIdNum, []);
          continue;
        }

        const filteredWalletTokens = walletTokens.filter((t) => t.name && t.symbol && t.address);

        // Process each token
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

            // Filter out tokens with USD value less than $1
            if (usd < 1) {
              return null;
            }

            let tokenData:
              | { name?: string; ticker?: string; decimals?: number; icon?: string | null }
              | undefined = metadata[addr];

            if (!tokenData && defillamaChain) {
              // fetch metadata from our API
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
              chainId: chainIdNum,
            } as TokenData;
          })
        ).then((results) => results.filter((item): item is TokenData => item !== null));

        // Add ETH token to results if it exists
        if (ethToken) {
          results.push(ethToken);
        }

        // Sort by highest USD value first
        const sorted = results.sort((a, b) => {
          const usdValueA = parseFloat(a.usdValue.replace("$", ""));
          const usdValueB = parseFloat(b.usdValue.replace("$", ""));
          return usdValueB - usdValueA;
        });

        console.log("[UserTokens] sorted", sorted);

        // Preload token icons
        preloadImages(sorted.map((t) => t.icon));

        console.log(`[UserTokens] Chain ${network}: ${sorted.length} tokens`);
        setUserTokensForChain(chainIdNum, sorted);

        // Collect all tokens for combined search results
        allSortedTokens.push(...sorted);
      }

      // Sort all tokens combined by USD value and set as search results
      const combinedSorted = allSortedTokens.sort((a, b) => {
        const usdValueA = parseFloat(a.usdValue.replace("$", ""));
        const usdValueB = parseFloat(b.usdValue.replace("$", ""));
        return usdValueB - usdValueA;
      });

      setSearchResults(combinedSorted);

      // If selectedInputToken has 0 balance, update it from fetched data if available
      if (selectedInputToken.balance === "0") {
        const userTokensForChain =
          useStore.getState().userTokensByChain[selectedInputToken.chainId] || [];
        const matchingToken = userTokensForChain.find(
          (t) => t.address.toLowerCase() === selectedInputToken.address.toLowerCase()
        );
        if (matchingToken) {
          setSelectedInputToken({
            ...selectedInputToken,
            balance: matchingToken.balance,
            usdValue: matchingToken.usdValue,
          });
        }
      }
    };

    fetchAllUserTokens();
  }, [
    isEvmConnected,
    evmAddress,
    setUserTokensForChain,
    setSearchResults,
    selectedInputToken,
    setSelectedInputToken,
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
            {userWallets.slice(0, 2).map((wallet, idx) => (
              <Box
                key={wallet.id}
                w={isMobile ? "18px" : "22px"}
                h={isMobile ? "18px" : "22px"}
                borderRadius="full"
                ml={idx > 0 ? "-8px" : "0"}
                border={`2px solid ${colors.swapBgColor}`}
                bg={colors.offBlackLighter}
                overflow="hidden"
              >
                <Image
                  src={`${DYNAMIC_ICON_BASE}#${getWalletIconKey(wallet)}`}
                  alt="wallet"
                  w="100%"
                  h="100%"
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
