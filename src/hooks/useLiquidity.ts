import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useStore } from "@/utils/store";
import { formatUnits } from "viem";
import { BITCOIN_DECIMALS, rfqClient } from "@/utils/constants";
import type { LiquidityResponse, MarketMaker, ChainType } from "@/utils/rfqClient";

/**
 * Extended liquidity response with calculated max liquidity values per chain
 */
interface ExtendedLiquidityResponse {
  market_makers: MarketMaker[];
  timestamp: string;
  maxCbBTCLiquidity: string;
  maxCbBTCLiquidityEthereum: string;
  maxCbBTCLiquidityBase: string;
  maxBTCLiquidityEthereum: string;
  maxBTCLiquidityBase: string;
  maxBTCLiquidity: string;
}

/**
 * Convert a satoshi amount to a decimal string
 */
function satoshisToDecimal(sats: string): string {
  try {
    return formatUnits(BigInt(sats), BITCOIN_DECIMALS);
  } catch {
    return "0";
  }
}

/**
 * Map chainId to the chain type used by RFQ client
 */
function chainIdToChainType(chainId: number | undefined): ChainType {
  return chainId === 8453 ? "base" : "ethereum";
}

/**
 * Calculate max liquidity from market maker trading pairs
 * Aggregates max amounts across all market makers for a given direction and chain
 */
function calculateMaxLiquidity(
  marketMakers: MarketMaker[],
  fromChain: ChainType,
  toChain: ChainType
): string {
  let maxAmount = BigInt(0);

  for (const mm of marketMakers) {
    for (const pair of mm.trading_pairs) {
      // Match trading pairs by chain
      if (pair.from.chain === fromChain && pair.to.chain === toChain) {
        try {
          const pairMax = BigInt(pair.max_amount);
          if (pairMax > maxAmount) {
            maxAmount = pairMax;
          }
        } catch {
          // Skip invalid amounts
        }
      }
    }
  }

  return maxAmount.toString();
}

/**
 * Hook to fetch and cache liquidity information from market makers
 *
 * Fetches liquidity data from the RFQ server and calculates max available
 * liquidity for each direction (BTC→cbBTC, cbBTC→BTC) and chain (Ethereum, Base).
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

  const query = useQuery<ExtendedLiquidityResponse, Error>({
    queryKey: ["liquidity"],
    queryFn: async () => {
      console.log("[useLiquidity] Fetching liquidity from RFQ server...");

      const response: LiquidityResponse = await rfqClient.getLiquidity();

      // Calculate max liquidity for each direction and chain
      // BTC → cbBTC (user sends BTC, receives cbBTC on EVM chain)
      const maxCbBTCLiquidityEthereum = calculateMaxLiquidity(
        response.market_makers,
        "bitcoin",
        "ethereum"
      );
      const maxCbBTCLiquidityBase = calculateMaxLiquidity(
        response.market_makers,
        "bitcoin",
        "base"
      );

      // cbBTC → BTC (user sends cbBTC from EVM chain, receives BTC)
      const maxBTCLiquidityEthereum = calculateMaxLiquidity(
        response.market_makers,
        "ethereum",
        "bitcoin"
      );
      const maxBTCLiquidityBase = calculateMaxLiquidity(response.market_makers, "base", "bitcoin");

      // Calculate overall max for each direction (max across both chains)
      const maxCbBTCLiquidity =
        BigInt(maxCbBTCLiquidityEthereum) > BigInt(maxCbBTCLiquidityBase)
          ? maxCbBTCLiquidityEthereum
          : maxCbBTCLiquidityBase;

      const maxBTCLiquidity =
        BigInt(maxBTCLiquidityEthereum) > BigInt(maxBTCLiquidityBase)
          ? maxBTCLiquidityEthereum
          : maxBTCLiquidityBase;

      console.log("[useLiquidity] Liquidity calculated:", {
        maxCbBTCLiquidityEthereum,
        maxCbBTCLiquidityBase,
        maxBTCLiquidityEthereum,
        maxBTCLiquidityBase,
      });

      return {
        market_makers: response.market_makers,
        timestamp: response.timestamp,
        maxCbBTCLiquidity,
        maxCbBTCLiquidityEthereum,
        maxCbBTCLiquidityBase,
        maxBTCLiquidity,
        maxBTCLiquidityEthereum,
        maxBTCLiquidityBase,
      };
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
    return usdValue.toString();
  }, [maxCbBTCLiquidity, btcPrice]);

  const maxBTCLiquidityInUsd = useMemo(() => {
    if (!maxBTCLiquidity || !btcPrice) return "0";
    const satoshis = Number(maxBTCLiquidity);
    const btcAmount = satoshis / 100_000_000; // Convert satoshis to BTC
    const usdValue = btcAmount * btcPrice;
    return usdValue.toString();
  }, [maxBTCLiquidity, btcPrice]);

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
    maxCbBTCLiquidityDecimal: satoshisToDecimal(maxCbBTCLiquidity),
    /** Maximum liquidity available for Bitcoin as destination (decimal string) */
    maxBTCLiquidityDecimal: satoshisToDecimal(maxBTCLiquidity),
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
