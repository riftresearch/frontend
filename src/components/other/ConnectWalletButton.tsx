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
import { preloadImages } from "@/utils/imagePreload";
import { FALLBACK_TOKEN_ICON, ETH_ICON } from "@/utils/constants";

const getCustomChainName = (chainId: number): string => {
  if (chainId === 1337) return "Rift Devnet";
  return `Chain ${chainId}`;
};

export const ConnectWalletButton: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useStore((state) => state.evmConnectWalletChainId);
  const setUserTokensForChain = useStore((state) => state.setUserTokensForChain);
  const setSearchResults = useStore((state) => state.setSearchResults);
  const chains = useChains();

  // Get chain-specific colors
  const isEthereum = chainId === 1;
  const chainColors = isEthereum
    ? { background: colors.purpleBackground, border: colors.assetTag.eth.border }
    : { background: colors.assetTag.cbbtc.background, border: colors.assetTag.cbbtc.border };
  const chainHoverColor = isEthereum ? "rgba(46, 64, 183, 0.65)" : "rgba(9, 36, 97, 0.65)";

  // SIWE authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // SIWE sign-in function
  const signInWithEthereum = async (): Promise<void> => {
    if (!address || !signMessageAsync) return;

    setIsSigningIn(true);
    try {
      // Get nonce from server
      const nonceResponse = await fetch("/api/siwe/nonce");
      const { nonce } = await nonceResponse.json();

      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Rift",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      // Sign the message
      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      });

      // Verify with server
      const verifyResponse = await fetch("/api/siwe/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: message.prepareMessage(),
          signature,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error("SIWE verification failed");
      }

      setIsAuthenticated(true);
    } catch (error) {
      console.error("SIWE sign-in failed:", error);
      // You might want to show a toast notification here
    } finally {
      setIsSigningIn(false);
    }
  };

  // Helper: fetch with 401 refresh + SIWE fallback, then retry
  const fetchWithAuthRetry = async (input: string, init?: RequestInit): Promise<Response> => {
    const doFetch = () => fetch(input, init);
    let res: Response;
    try {
      res = await doFetch();
    } catch (e) {
      // Network error; propagate
      throw e;
    }

    if (res.status !== 401) return res;

    // Try to refresh
    try {
      const refreshRes = await fetch("/api/siwe/refresh", { method: "POST" });
      if (refreshRes.ok) {
        const retry = await doFetch();
        if (retry.status !== 401) return retry;
      }
    } catch {
      // ignore and continue to SIWE
    }

    // Final fallback: SIWE, then retry
    try {
      await signInWithEthereum();
      return await doFetch();
    } catch (e) {
      // Return original 401 response if SIWE failed or retry still 401
      return res;
    }
  };

  // Check authentication status and auto-trigger SIWE when wallet connects
  useEffect(() => {
    const checkAuthStatusAndSignIn = async () => {
      if (!address) {
        setIsAuthenticated(false);
        return;
      }
      try {
        const verifyRes = await fetchWithAuthRetry("/api/siwe/verify", {
          method: "GET",
        });
        if (verifyRes.ok) {
          const data = await verifyRes.json();
          setIsAuthenticated(Boolean(data?.authenticated));
          return;
        }
        // If not OK after retries, consider unauthenticated
        setIsAuthenticated(false);
      } catch {
        setIsAuthenticated(false);
      }
    };

    checkAuthStatusAndSignIn();
  }, [address]);

  // Fetch user tokens and populate global store when connected or chain changes
  useEffect(() => {
    const fetchWalletTokens = async (
      walletAddress: string,
      cid: number
    ): Promise<TokenBalance[]> => {
      try {
        const response = await fetchWithAuthRetry(
          `/api/token-balance?wallet=${walletAddress}&chainId=${cid}`,
          { method: "GET" }
        );
        const data = await response.json();
        if (data.result?.result) {
          return data.result.result as TokenBalance[];
        }
        return [];
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
        const addrParam = addresses.join(",");
        const response = await fetchWithAuthRetry(
          `/api/token-price?chain=${chain}&addresses=${addrParam}`,
          { method: "GET" }
        );
        const data = await response.json();
        if (data.coins) {
          const prices: Record<string, TokenPrice & { decimals?: number }> = {};
          for (const [key, coinData] of Object.entries<any>(data.coins)) {
            const address = key.split(":")[1]?.toLowerCase();
            prices[address] = coinData as TokenPrice & { decimals?: number };
          }
          return prices;
        }
        return {};
      } catch (e) {
        console.error("Failed to fetch token prices:", e);
        return {};
      }
    };

    const fetchUserEth = async (walletAddress: string, cid: number): Promise<TokenData | null> => {
      try {
        const response = await fetchWithAuthRetry(
          `/api/eth-balance?wallet=${walletAddress}&chainId=${cid}`,
          { method: "GET" }
        );
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
          address: null, // ETH native token address
          balance: balanceEth.toFixed(6),
          usdValue: `$${usdValue.toFixed(2)}`,
          icon: ETH_ICON,
          decimals: 18,
        };

        console.log("[UserETH] built ETH asset entry", {
          chainId: cid,
          address: walletAddress,
          balanceEth,
          price: ethPrice,
          usdValue,
        });

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

      // Fetch both ERC20 tokens and ETH balance in parallel
      const [walletTokens, ethToken] = await Promise.all([
        fetchWalletTokens(address, chainId),
        fetchUserEth(address, chainId),
      ]);

      console.log("[Wallet] fetched token balances", {
        chainId,
        address,
        count: walletTokens.length,
        tokens: walletTokens,
        ethToken: ethToken ? "ETH included" : "ETH excluded (low value)",
      });

      // If no tokens and no ETH, set empty array
      if (walletTokens.length === 0 && !ethToken) {
        setUserTokensForChain(chainId, []);
        return;
      }

      const filteredWalletTokens = walletTokens.filter((t) => t.name && t.symbol && t.address);
      const addresses = filteredWalletTokens.map((t) => t.address.toLowerCase());
      const prices = await fetchTokenPrices(addresses, chainName);
      console.log("[Prices] fetched token prices", prices);

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
            const response = await fetchWithAuthRetry(
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
            balance: Number(balanceStr).toFixed(6),
            usdValue: `$${usd.toFixed(2)}`,
            icon: tokenData.icon || FALLBACK_TOKEN_ICON,
            decimals: tokenData.decimals || decimals,
          } as TokenData;
          console.log("[UserToken] built asset entry", built);
          return built;
        })
      ).then((results) => results.filter((item): item is TokenData => item !== null));

      // Add ETH token to results if it exists
      if (ethToken) {
        results.push(ethToken);
      }

      // Filter tokens with USD value above $1 and sort by highest USD value first
      const sorted = results.sort((a, b) => {
        const usdValueA = parseFloat(a.usdValue.replace("$", ""));
        const usdValueB = parseFloat(b.usdValue.replace("$", ""));
        return usdValueB - usdValueA; // Sort descending (highest first)
      });

      // Preload token icons to reduce white flash on first render
      preloadImages(sorted.map((t) => t.icon));
      console.log("[UserTokens] final array for chain", {
        chainId,
        count: sorted.length,
        results: sorted,
      });
      setUserTokensForChain(chainId, sorted);
      // Also populate global search results so the modal shows wallet tokens instantly
      setSearchResults(sorted);
    };

    loadAndStore();
  }, [isConnected, address, chainId, setUserTokensForChain]);

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
          borderRadius={"12px"}
          border={`2.5px solid ${colors.swapBorderColor}`}
          type="button"
          fontFamily={FONT_FAMILIES.NOSTROMO}
          fontSize="17px"
          paddingX="28px"
          paddingY={"10px"}
          bg={colors.swapBgColor}
          boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
        >
          Sign in with Wallet
        </Button>
      ) : isSigningIn ? (
        <Button
          disabled
          cursor="not-allowed"
          color={colors.offWhite}
          _active={{ bg: colors.swapBgColor }}
          _hover={{ bg: colors.swapHoverColor }}
          borderRadius={"12px"}
          border={`2.5px solid ${colors.swapBorderColor}`}
          type="button"
          fontFamily={FONT_FAMILIES.NOSTROMO}
          fontSize="17px"
          paddingX="28px"
          paddingY={"10px"}
          bg={colors.swapBgColor}
          boxShadow="0px 0px 5px 3px rgba(18,18,18,1)"
          opacity={0.7}
        >
          Signing in...
        </Button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            onClick={openChainModal}
            type="button"
            _hover={{ bg: chainHoverColor }}
            _active={{ bg: chainColors.background }}
            bg={chainColors.background}
            borderRadius={"12px"}
            fontFamily={"aux"}
            fontSize={"17px"}
            paddingX="18px"
            pt="2px"
            color={colors.offWhite}
            h="42px"
            border={`2.5px solid ${chainColors.border}`}
            style={{ display: "flex", alignItems: "center" }}
          >
            <Flex alignItems="center" gap="8px">
              <NetworkIcon />
              {getChainName()}
            </Flex>
          </Button>
          <Button
            onClick={openAccountModal}
            type="button"
            _hover={{ bg: chainHoverColor }}
            _active={{ bg: chainColors.background }}
            bg={chainColors.background}
            borderRadius="11px"
            fontFamily="aux"
            fontSize="17px"
            fontWeight="bold"
            pt="2px"
            px="18px"
            color={colors.offWhite}
            h="42px"
            border={`2.5px solid ${chainColors.border}`}
          >
            {displayAddress}
          </Button>
        </div>
      )}
    </div>
  );
};
