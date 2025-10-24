import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { rfqClient } from "@/utils/constants";
import { useStore } from "@/utils/store";
import {
  LiquidityResponse,
  RfqClientError,
  ChainType,
  TradingPair,
  hexToDecimal,
} from "@/utils/rfqClient";

/**
 * Extended liquidity response with calculated max liquidity values
 */
interface ExtendedLiquidityResponse extends LiquidityResponse {
  maxCbBTCLiquidity: string;
  maxBTCLiquidity: string;
}

/**
 * Hook to fetch and cache liquidity information from market makers
 *
 * Automatically refetches every minute to keep liquidity data fresh.
 * Uses TanStack Query for efficient caching and background updates.
 *
 * @returns Query result with liquidity data, loading states, and error handling
 */
export function useMaxLiquidity() {
  const { btcPrice } = useStore();

  const query = useQuery<ExtendedLiquidityResponse, RfqClientError>({
    queryKey: ["liquidity"],
    queryFn: async () => {
      try {
        const liquidity = await rfqClient.getLiquidity();
        console.log(`Fetched liquidity from ${liquidity.market_makers.length} market makers`);

        // Find max liquidity for "to" being cbBTC (ethereum chain, cbBTC token address)
        let maxCbBTCLiquidity = BigInt(0);
        // Find max liquidity for "to" being Bitcoin (bitcoin chain, native token)
        let maxBTCLiquidity = BigInt(0);

        for (const marketMaker of liquidity.market_makers) {
          for (const pair of marketMaker.trading_pairs) {
            const amount = BigInt(pair.max_amount);

            // Check if "to" is cbBTC
            if (
              pair.to.chain === "ethereum" &&
              pair.to.token.type === "Address" &&
              pair.to.token.data?.toLowerCase() === "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"
            ) {
              if (amount > maxCbBTCLiquidity) {
                maxCbBTCLiquidity = amount;
              }
            }

            // Check if "to" is Bitcoin
            if (pair.to.chain === "bitcoin" && pair.to.token.type === "Native") {
              if (amount > maxBTCLiquidity) {
                maxBTCLiquidity = amount;
              }
            }
          }
        }

        console.log(`Max cbBTC liquidity: ${hexToDecimal(maxCbBTCLiquidity.toString())}`);
        console.log(`Max BTC liquidity: ${hexToDecimal(maxBTCLiquidity.toString())}`);

        return {
          ...liquidity,
          maxCbBTCLiquidity: maxCbBTCLiquidity.toString(),
          maxBTCLiquidity: maxBTCLiquidity.toString(),
        };
      } catch (error) {
        console.error("Failed to fetch liquidity:", error);
        throw error;
      }
    },
    enabled: true,
    refetchInterval: 60 * 1000, // Refetch every 60 seconds (1 minute)
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff, max 10s
  });

  // Calculate USD values reactively when BTC price or liquidity data changes
  const maxCbBTCLiquidityInUsd = useMemo(() => {
    if (!query.data?.maxCbBTCLiquidity || !btcPrice) return "0";
    const satoshis = Number(query.data.maxCbBTCLiquidity);
    const btcAmount = satoshis / 100_000_000; // Convert satoshis to BTC
    const usdValue = btcAmount * btcPrice;
    console.log(
      `Calculating cbBTC USD: ${satoshis} sats = ${btcAmount} BTC * $${btcPrice} = $${usdValue}`
    );
    return usdValue.toString();
  }, [query.data?.maxCbBTCLiquidity, btcPrice]);

  const maxBTCLiquidityInUsd = useMemo(() => {
    if (!query.data?.maxBTCLiquidity || !btcPrice) return "0";
    const satoshis = Number(query.data.maxBTCLiquidity);
    const btcAmount = satoshis / 100_000_000; // Convert satoshis to BTC
    const usdValue = btcAmount * btcPrice;
    console.log(
      `Calculating BTC USD: ${satoshis} sats = ${btcAmount} BTC * $${btcPrice} = $${usdValue}`
    );
    return usdValue.toString();
  }, [query.data?.maxBTCLiquidity, btcPrice]);

  return {
    /** Liquidity data from all market makers */
    liquidity: query.data,
    /** Array of market makers with their trading pairs */
    marketMakers: query.data?.market_makers ?? [],
    /** Timestamp when liquidity data was last updated */
    timestamp: query.data?.timestamp,
    /** Number of available market makers */
    marketMakerCount: query.data?.market_makers.length ?? 0,
    /** Maximum liquidity available for cbBTC as destination (hex string) */
    maxCbBTCLiquidity: query.data?.maxCbBTCLiquidity ?? "0",
    /** Maximum liquidity available for Bitcoin as destination (hex string) */
    maxBTCLiquidity: query.data?.maxBTCLiquidity ?? "0",
    /** Maximum liquidity available for cbBTC as destination (decimal string) */
    maxCbBTCLiquidityDecimal: query.data ? hexToDecimal(query.data.maxCbBTCLiquidity) : "0",
    /** Maximum liquidity available for Bitcoin as destination (decimal string) */
    maxBTCLiquidityDecimal: query.data ? hexToDecimal(query.data.maxBTCLiquidity) : "0",
    /** Maximum liquidity available for cbBTC as destination in USD */
    maxCbBTCLiquidityInUsd,
    /** Maximum liquidity available for Bitcoin as destination in USD */
    maxBTCLiquidityInUsd,
    /** Current BTC price from store (null if not loaded) */
    btcPrice,
    /** Whether the initial request is loading */
    isLoading: query.isLoading,
    /** Whether a background refetch is happening */
    isFetching: query.isFetching,
    /** Whether there's an error */
    isError: query.isError,
    /** Error object if request failed */
    error: query.error,
    /** Function to manually refetch liquidity data */
    refetch: query.refetch,
  };
}
