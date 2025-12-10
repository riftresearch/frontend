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
 * Extended liquidity response with calculated max liquidity values per chain
 */
interface ExtendedLiquidityResponse extends LiquidityResponse {
  maxCbBTCLiquidity: string;
  maxCbBTCLiquidityEthereum: string;
  maxCbBTCLiquidityBase: string;
  maxBTCLiquidityEthereum: string;
  maxBTCLiquidityBase: string;
  maxBTCLiquidity: string;
}

/**
 * Map chainId to the RFQ chain type
 */
function chainIdToChainType(chainId: number | undefined): ChainType {
  return chainId === 8453 ? "base" : "ethereum";
}

/**
 * Hook to fetch and cache liquidity information from market makers
 *
 * Automatically refetches every minute to keep liquidity data fresh.
 * Uses TanStack Query for efficient caching and background updates.
 *
 * Liquidity is filtered based on swap direction:
 * - EVM → BTC: Uses the input token's chain
 * - BTC → EVM: Uses the output token's chain
 *
 * @returns Query result with liquidity data, loading states, and error handling
 */
export function useMaxLiquidity() {
  const { btcPrice, isSwappingForBTC, selectedInputToken, selectedOutputToken } = useStore();

  // Determine the relevant chain based on swap direction:
  // - If swapping EVM → BTC: use the input token's chain (where we're selling from)
  // - If swapping BTC → EVM: use the output token's chain (where cbBTC will be received)
  const relevantChainId = useMemo(() => {
    if (isSwappingForBTC) {
      // EVM → BTC: use input token's chain
      return selectedInputToken?.chainId ?? 1;
    } else {
      // BTC → EVM: use output token's chain
      return selectedOutputToken?.chainId ?? 1;
    }
  }, [isSwappingForBTC, selectedInputToken?.chainId, selectedOutputToken?.chainId]);

  const relevantChainType = chainIdToChainType(relevantChainId);

  // Debug label for UI
  const liquidityChainDebugLabel = useMemo(() => {
    const chainName = relevantChainType === "base" ? "Base" : "Ethereum";
    const direction = isSwappingForBTC ? "EVM→BTC" : "BTC→EVM";
    return `${chainName} (${direction})`;
  }, [relevantChainType, isSwappingForBTC]);

  const query = useQuery<ExtendedLiquidityResponse, RfqClientError>({
    queryKey: ["liquidity"],
    queryFn: async () => {
      try {
        if (process.env.NEXT_PUBLIC_FAKE_RFQ === "true") {
          return {
            market_makers: [],
            timestamp: new Date().toISOString(),
            maxCbBTCLiquidity: "0",
            maxCbBTCLiquidityEthereum: "0",
            maxCbBTCLiquidityBase: "0",
            maxBTCLiquidity: "0",
            maxBTCLiquidityEthereum: "0",
            maxBTCLiquidityBase: "0",
          };
        }

        const liquidity = await rfqClient.getLiquidity();
        console.log(`Fetched liquidity from ${liquidity.market_makers.length} market makers`);

        // Store liquidity per chain for cbBTC (BTC → EVM direction)
        let maxCbBTCLiquidityEthereum = BigInt(0);
        let maxCbBTCLiquidityBase = BigInt(0);
        // Store liquidity per chain for BTC (EVM → BTC direction)
        let maxBTCLiquidityEthereum = BigInt(0);
        let maxBTCLiquidityBase = BigInt(0);

        for (const marketMaker of liquidity.market_makers) {
          for (const pair of marketMaker.trading_pairs) {
            const amount = BigInt(pair.max_amount);

            // Check if "to" is cbBTC on Ethereum mainnet (for BTC → cbBTC on Ethereum)
            if (
              pair.to.chain === "ethereum" &&
              pair.to.token.type === "Address" &&
              pair.to.token.data?.toLowerCase() === "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"
            ) {
              if (amount > maxCbBTCLiquidityEthereum) {
                maxCbBTCLiquidityEthereum = amount;
              }
            }

            // Check if "to" is cbBTC on Base (for BTC → cbBTC on Base)
            if (
              pair.to.chain === "base" &&
              pair.to.token.type === "Address" &&
              pair.to.token.data?.toLowerCase() === "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"
            ) {
              if (amount > maxCbBTCLiquidityBase) {
                maxCbBTCLiquidityBase = amount;
              }
            }

            // Check if "to" is Bitcoin and "from" is cbBTC on Ethereum (for EVM → BTC from Ethereum)
            if (
              pair.to.chain === "bitcoin" &&
              pair.to.token.type === "Native" &&
              pair.from.chain === "ethereum"
            ) {
              if (amount > maxBTCLiquidityEthereum) {
                maxBTCLiquidityEthereum = amount;
              }
            }

            // Check if "to" is Bitcoin and "from" is cbBTC on Base (for EVM → BTC from Base)
            if (
              pair.to.chain === "bitcoin" &&
              pair.to.token.type === "Native" &&
              pair.from.chain === "base"
            ) {
              if (amount > maxBTCLiquidityBase) {
                maxBTCLiquidityBase = amount;
              }
            }
          }
        }

        console.log(
          `Max cbBTC liquidity (Ethereum): ${hexToDecimal(maxCbBTCLiquidityEthereum.toString())}`
        );
        console.log(
          `Max cbBTC liquidity (Base): ${hexToDecimal(maxCbBTCLiquidityBase.toString())}`
        );
        console.log(
          `Max BTC liquidity (from Ethereum): ${hexToDecimal(maxBTCLiquidityEthereum.toString())}`
        );
        console.log(
          `Max BTC liquidity (from Base): ${hexToDecimal(maxBTCLiquidityBase.toString())}`
        );

        return {
          ...liquidity,
          maxCbBTCLiquidityEthereum: maxCbBTCLiquidityEthereum.toString(),
          maxCbBTCLiquidityBase: maxCbBTCLiquidityBase.toString(),
          maxBTCLiquidityEthereum: maxBTCLiquidityEthereum.toString(),
          maxBTCLiquidityBase: maxBTCLiquidityBase.toString(),
          // For backwards compatibility
          maxCbBTCLiquidity: maxCbBTCLiquidityEthereum.toString(),
          maxBTCLiquidity: maxBTCLiquidityEthereum.toString(),
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

  // Select the correct liquidity based on swap direction and chain
  const maxCbBTCLiquidity = useMemo(() => {
    if (!query.data) return "0";
    return relevantChainType === "base"
      ? query.data.maxCbBTCLiquidityBase
      : query.data.maxCbBTCLiquidityEthereum;
  }, [query.data, relevantChainType]);

  const maxBTCLiquidity = useMemo(() => {
    if (!query.data) return "0";
    return relevantChainType === "base"
      ? query.data.maxBTCLiquidityBase
      : query.data.maxBTCLiquidityEthereum;
  }, [query.data, relevantChainType]);

  // Calculate USD values reactively when BTC price or liquidity data changes
  const maxCbBTCLiquidityInUsd = useMemo(() => {
    if (!maxCbBTCLiquidity || !btcPrice) return "0";
    const satoshis = Number(maxCbBTCLiquidity);
    const btcAmount = satoshis / 100_000_000; // Convert satoshis to BTC
    const usdValue = btcAmount * btcPrice;
    console.log(
      `Calculating cbBTC USD (${relevantChainType}): ${satoshis} sats = ${btcAmount} BTC * $${btcPrice} = $${usdValue}`
    );
    return usdValue.toString();
  }, [maxCbBTCLiquidity, btcPrice, relevantChainType]);

  const maxBTCLiquidityInUsd = useMemo(() => {
    if (!maxBTCLiquidity || !btcPrice) return "0";
    const satoshis = Number(maxBTCLiquidity);
    const btcAmount = satoshis / 100_000_000; // Convert satoshis to BTC
    const usdValue = btcAmount * btcPrice;
    console.log(
      `Calculating BTC USD (${relevantChainType}): ${satoshis} sats = ${btcAmount} BTC * $${btcPrice} = $${usdValue}`
    );
    return usdValue.toString();
  }, [maxBTCLiquidity, btcPrice, relevantChainType]);

  return {
    /** Liquidity data from all market makers */
    liquidity: query.data,
    /** Array of market makers with their trading pairs */
    marketMakers: query.data?.market_makers ?? [],
    /** Timestamp when liquidity data was last updated */
    timestamp: query.data?.timestamp,
    /** Number of available market makers */
    marketMakerCount: query.data?.market_makers.length ?? 0,
    /** Maximum liquidity available for cbBTC as destination (for current chain) */
    maxCbBTCLiquidity,
    /** Maximum liquidity available for Bitcoin as destination (for current chain) */
    maxBTCLiquidity,
    /** Maximum liquidity available for cbBTC as destination (decimal string) */
    maxCbBTCLiquidityDecimal: hexToDecimal(maxCbBTCLiquidity),
    /** Maximum liquidity available for Bitcoin as destination (decimal string) */
    maxBTCLiquidityDecimal: hexToDecimal(maxBTCLiquidity),
    /** Maximum liquidity available for cbBTC as destination in USD */
    maxCbBTCLiquidityInUsd,
    /** Maximum liquidity available for Bitcoin as destination in USD */
    maxBTCLiquidityInUsd,
    /** Current BTC price from store (null if not loaded) */
    btcPrice,
    /** The chain type being used for liquidity (ethereum or base) */
    relevantChainType,
    /** Debug label showing which chain liquidity is for (for debugging UI) */
    liquidityChainDebugLabel,
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
