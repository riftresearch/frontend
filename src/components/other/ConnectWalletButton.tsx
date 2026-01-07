import React, { useEffect } from "react";
import { Button, Flex } from "@chakra-ui/react";
import { useAccount, useChains } from "wagmi";
import { useStore } from "@/utils/store";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { reownModal } from "@/utils/wallet";
import { NetworkIcon } from "@/components/other/NetworkIcon";
import { formatUnits } from "viem";
import type { TokenData } from "@/utils/types";
import { Network } from "@/utils/types";
import { preloadImages } from "@/utils/imagePreload";
import { FALLBACK_TOKEN_ICON } from "@/utils/constants";
import useWindowSize from "@/hooks/useWindowSize";
import {
  fetchWalletTokens,
  fetchAllTokenPrices,
  fetchUserEth,
  getMetadata,
  getDefiLlamaChain,
  getChainId,
  SUPPORTED_CHAIN_NETWORKS,
} from "@/utils/userTokensClient";

const getCustomChainName = (chainId: number): string => {
  if (chainId === 1337) return "Rift Devnet";
  return `Chain ${chainId}`;
};

export const ConnectWalletButton: React.FC = () => {
  const { address, isConnected } = useAccount();

  const {
    evmConnectWalletChainId: chainId,
    setUserTokensForChain,
    setSearchResults,
    selectedInputToken,
    setSelectedInputToken,
  } = useStore();
  const chains = useChains();
  const { isMobile } = useWindowSize();

  // Fetch user tokens and populate global store when wallet connects
  useEffect(() => {
    const fetchAllUserTokens = async () => {
      if (!isConnected || !address) return;

      console.log("[UserTokens] Fetching tokens for all chains...");

      // Fetch all ERC20 tokens and ETH balances across all chains in parallel
      const [walletTokensByChain, ethByChain] = await Promise.all([
        fetchWalletTokens(address),
        fetchUserEth(address),
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
    isConnected,
    address,
    setUserTokensForChain,
    setSearchResults,
    selectedInputToken,
    setSelectedInputToken,
  ]);

  // Format the user's address for display
  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  // Handler for opening the Reown AppKit modal
  const handleOpen = async (): Promise<void> => {
    await reownModal.open();
  };

  // Function to open the account modal
  const openAccountModal = async (): Promise<void> => {
    await reownModal.open({
      view: "Account",
    });
  };

  // Function to open the chain modal
  const openChainModal = async (): Promise<void> => {
    await reownModal.open({
      view: "Networks",
    });
  };

  // Get the chain name from wagmi if available, otherwise use custom name
  const getChainName = (): string => {
    const currentChain = chains.find((chain) => chain.id === chainId);
    return currentChain?.name || getCustomChainName(chainId);
  };

  return (
    <div>
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
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            onClick={openChainModal}
            type="button"
            _hover={{ bg: colors.swapHoverColor }}
            _active={{ bg: colors.swapBgColor }}
            bg={colors.swapBgColor}
            borderRadius="30px"
            fontFamily={"aux"}
            fontSize={isMobile ? "14px" : "17px"}
            paddingLeft={isMobile ? "10px" : "16px"}
            paddingRight={isMobile ? "10px" : "22px"}
            color={colors.offWhite}
            letterSpacing="-1px"
            h={isMobile ? "36px" : "42px"}
            border={`2px solid ${colors.swapBorderColor}`}
            style={{ display: "flex", alignItems: "center" }}
          >
            <Flex alignItems="center" gap="8px">
              <NetworkIcon />
              {!isMobile && getChainName()}
            </Flex>
          </Button>
          <Button
            onClick={openAccountModal}
            type="button"
            _hover={{ bg: colors.swapHoverColor }}
            _active={{ bg: colors.swapBgColor }}
            bg={colors.swapBgColor}
            borderRadius="30px"
            fontFamily="aux"
            fontSize={isMobile ? "14px" : "17px"}
            letterSpacing="-1px"
            px={isMobile ? "10px" : "18px"}
            color={colors.offWhite}
            h={isMobile ? "36px" : "42px"}
            border={`2px solid ${colors.swapBorderColor}`}
          >
            {displayAddress}
          </Button>
        </div>
      )}
    </div>
  );
};
