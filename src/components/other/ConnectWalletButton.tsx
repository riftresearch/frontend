import React, { useState, useEffect } from "react";
import { Button, Flex } from "@chakra-ui/react";
import { useAccount, useChains, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useStore } from "@/utils/store";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { reownModal } from "@/utils/wallet";
import { NetworkIcon } from "@/components/other/NetworkIcon";
import { formatUnits } from "viem";
import ETHEREUM_ADDRESS_METADATA from "@/utils/tokenData/1/address_to_metadata.json";
import BASE_ADDRESS_METADATA from "@/utils/tokenData/8453/address_to_metadata.json";
import type { TokenData, TokenBalance, TokenPrice } from "@/utils/types";
import { Network } from "@/utils/types";
import { preloadImages } from "@/utils/imagePreload";
import { FALLBACK_TOKEN_ICON, ETH_ICON } from "@/utils/constants";
import useWindowSize from "@/hooks/useWindowSize";
import { fetchTokenPrices as fetchDefiLlamaPrices } from "@/utils/defiLlamaClient";

const getCustomChainName = (chainId: number): string => {
  if (chainId === 1337) return "Rift Devnet";
  return `Chain ${chainId}`;
};

export const ConnectWalletButton: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const {
    selectedInputToken,
    setSelectedInputToken,
    evmConnectWalletChainId: chainId,
    setUserTokensForChain,
    setSearchResults,
  } = useStore();
  const chains = useChains();
  const { isMobile } = useWindowSize();

  // Get chain-specific colors
  const isEthereum = chainId === 1;
  const chainColors = isEthereum
    ? { background: colors.purpleBackground, border: colors.assetTag.eth.border }
    : { background: colors.assetTag.cbbtc.background, border: colors.assetTag.cbbtc.border };
  const chainHoverColor = isEthereum ? "rgba(46, 64, 183, 0.65)" : "rgba(9, 36, 97, 0.65)";

  // Fetch user tokens and populate global store when connected or chain changes
  useEffect(() => {
    const fetchWalletTokens = async (
      walletAddress: string,
      chain: Network
    ): Promise<TokenBalance[]> => {
      try {
        console.log(
          "[Balance Check] Fetching token balance for address:",
          walletAddress,
          "chain:",
          chain
        );

        const allTokens: TokenBalance[] = [];
        let page = 1;
        let hasMorePages = true;

        // Fetch all pages of tokens
        while (hasMorePages) {
          const response = await fetch(
            `/api/token-balance?wallet=${walletAddress}&chainId=${chain}&page=${page}`,
            { method: "GET" }
          );
          const data = await response.json();

          if (data.result?.result && Array.isArray(data.result.result)) {
            const tokens = data.result.result as TokenBalance[];
            allTokens.push(...tokens);

            console.log(
              `[Balance Check] Fetched page ${page}: ${tokens.length} tokens (total: ${allTokens.length})`
            );

            // Check if there are more pages

            hasMorePages = tokens.length >= 50;
            page++;
          } else {
            hasMorePages = false;
          }
        }

        console.log("[Balance Check] Total tokens fetched:", allTokens.length);
        console.log("[Balance Check] All tokens:", allTokens);

        // Enrich tokens with empty names using metadata from address_to_metadata.json
        const enrichedTokens = allTokens.map((token) => {
          if (token.name === "" && token.chainId === 8453) {
            // Look up metadata for Base tokens
            const addressLower = token.address.toLowerCase();
            const metadata = (
              BASE_ADDRESS_METADATA as Record<
                string,
                { name: string; ticker: string; decimals?: number }
              >
            )[addressLower];
            if (metadata) {
              return {
                ...token,
                name: metadata.name || token.name,
                symbol: metadata.ticker || token.symbol,
                decimals: metadata.decimals ?? token.decimals,
              };
            }
          }
          return token;
        });

        return enrichedTokens;
      } catch (e) {
        console.error("Failed to fetch wallet tokens:", e);
        return [];
      }
    };

    const fetchTokenPrices = async (
      addresses: string[],
      chain: "ethereum" | "base"
    ): Promise<Record<string, TokenPrice & { decimals?: number }>> => {
      try {
        // Batch addresses into chunks of 30 to avoid URL length limits and API rate limits
        const BATCH_SIZE = 30;
        const batches: string[][] = [];

        for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
          batches.push(addresses.slice(i, i + BATCH_SIZE));
        }

        console.log(
          `[Price Check] Fetching prices for ${addresses.length} tokens in ${batches.length} batches`
        );

        // Fetch all batches in parallel
        const batchPromises = batches.map(async (batch, index) => {
          console.log(
            `[Price Check] Fetching batch ${index + 1}/${batches.length} (${batch.length} tokens)`
          );

          try {
            const data = await fetchDefiLlamaPrices(chain, batch);
            return data.coins || {};
          } catch (error) {
            console.error(`Failed to fetch prices for batch ${index + 1}:`, error);
            return {};
          }
        });

        // Wait for all batches to complete
        const batchResults = await Promise.all(batchPromises);

        // Merge all batch results into a single prices object
        const prices: Record<string, TokenPrice & { decimals?: number }> = {};
        for (const batchData of batchResults) {
          for (const [key, coinData] of Object.entries<any>(batchData)) {
            const address = key.split(":")[1]?.toLowerCase();
            if (address) {
              prices[address] = coinData as TokenPrice & { decimals?: number };
            }
          }
        }

        console.log(
          `[Price Check] Successfully fetched prices for ${Object.keys(prices).length} tokens`
        );
        return prices;
      } catch (e) {
        console.error("Failed to fetch token prices:", e);
        return {};
      }
    };

    const fetchUserEth = async (walletAddress: string, cid: number): Promise<TokenData | null> => {
      try {
        console.log(
          "[Balance Check] Fetching ETH balance for address:",
          walletAddress,
          "chainId:",
          cid
        );
        const response = await fetch(`/api/eth-balance?wallet=${walletAddress}&chainId=${cid}`, {
          method: "GET",
        });
        const data = await response.json();

        if (data.error) {
          console.error("Failed to fetch ETH balance:", data.error);
          return null;
        }

        const balanceEth = Number(formatUnits(BigInt(data.balance), 18));
        const ethPrice = data.price;
        const usdValue = balanceEth * ethPrice;

        // Only include ETH if it has meaningful value (> $1)
        if (usdValue <= 1) {
          return null;
        }

        const ethTokenData: TokenData = {
          name: "Ethereum",
          ticker: "ETH",
          address: "0x0000000000000000000000000000000000000000", // ETH native token address
          balance: balanceEth.toString(),
          usdValue: `$${usdValue.toFixed(2)}`,
          icon: ETH_ICON,
          decimals: 18,
        };

        return ethTokenData;
      } catch (e) {
        console.error("Failed to fetch ETH balance:", e);
        return null;
      }
    };

    const loadAndStore = async () => {
      if (!isConnected || !address || !chainId) return;
      const chainName: "ethereum" | "base" = chainId === 8453 ? "base" : "ethereum";
      const metadata = chainId === 8453 ? BASE_ADDRESS_METADATA : ETHEREUM_ADDRESS_METADATA;
      const networkEnum = chainId === 8453 ? Network.BASE : Network.ETHEREUM;

      // Fetch both ERC20 tokens and ETH balance in parallel
      const [walletTokens, ethToken] = await Promise.all([
        fetchWalletTokens(address, networkEnum),
        fetchUserEth(address, chainId),
      ]);

      // console.log("walletTokens", walletTokens);
      // If no tokens and no ETH, set empty array
      if (walletTokens.length === 0 && !ethToken) {
        setUserTokensForChain(chainId, []);
        return;
      }

      const filteredWalletTokens = walletTokens.filter((t) => t.name && t.symbol && t.address);
      const addresses = filteredWalletTokens.map((t) => t.address.toLowerCase());
      const prices = await fetchTokenPrices(addresses, chainName);
      // console.log("[Prices] fetched token prices", prices);

      const results: TokenData[] = await Promise.all(
        filteredWalletTokens.map(async (t) => {
          const address = t.address.toLowerCase();
          const priceData = prices[address];
          const decimals = priceData?.decimals ?? t.decimals ?? 18;
          let balanceStr = "0";
          try {
            balanceStr = formatUnits(BigInt(t.totalBalance), decimals);
          } catch {
            // fallback: use as-is string if BigInt fails
            balanceStr = "0";
          }

          const price = priceData?.price ?? 0;
          const usd = Number(balanceStr) * Number(price);

          // If USD value is less than 1, return null to filter out later
          if (usd < 1) {
            return null;
          }

          let tokenData = (metadata as any)[address];

          if (!tokenData) {
            // fetch metadata from our API (which returns { data: TokenMetadata[], count: number })
            const response = await fetch(
              `/api/token-metadata?network=${chainName}&addresses=${address}`,
              { method: "GET" }
            );
            const apiResult = await response.json();
            // Since we're only querying one address, extract the first element from the data array
            tokenData = apiResult.data && apiResult.data.length > 0 ? apiResult.data[0] : {};
            // console.log("fetched metadata from API", tokenData);
          }

          const built = {
            name: tokenData.name,
            ticker: tokenData.ticker,
            address: t.address,
            balance: balanceStr,
            usdValue: `$${usd.toFixed(2)}`,
            icon: tokenData.icon || FALLBACK_TOKEN_ICON,
            decimals: tokenData.decimals || decimals,
          } as TokenData;
          // console.log("[UserToken] built asset entry", built);
          return built;
        })
      ).then((results) => results.filter((item): item is TokenData => item !== null));

      // Add ETH token to results if it exists
      if (ethToken) {
        results.push(ethToken);
      }

      console.log("pre sorted token results", results);
      // Filter tokens with USD value above $1 and sort by highest USD value first
      const sorted = results.sort((a, b) => {
        const usdValueA = parseFloat(a.usdValue.replace("$", ""));
        const usdValueB = parseFloat(b.usdValue.replace("$", ""));
        return usdValueB - usdValueA; // Sort descending (highest first)
      });

      // Preload token icons to reduce white flash on first render
      preloadImages(sorted.map((t) => t.icon));
      // console.log("[UserTokens] final array for chain", {
      //   chainId,
      //   count: sorted.length,
      //   results: sorted,
      // });
      setUserTokensForChain(chainId, sorted);
      // Also populate global search results so the modal shows wallet tokens instantly
      setSearchResults(sorted);
      if (
        selectedInputToken?.ticker === "ETH" &&
        selectedInputToken.balance !== ethToken?.balance &&
        ethToken
      ) {
        setSelectedInputToken(ethToken);
      }
    };

    loadAndStore();
  }, [
    isConnected,
    address,
    chainId,
    setUserTokensForChain,
    selectedInputToken,
    setSelectedInputToken,
    setSearchResults,
  ]);

  // Format the user's address for display
  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  // signInWithEthereum is defined above for helper access

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
            pt={isMobile ? "0px" : "2px"}
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
            pt={isMobile ? "0px" : "2px"}
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
