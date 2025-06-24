import { useQuery } from "@tanstack/react-query";
import { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import {
  getQuoteAndCalldata,
  QuoteAndCalldataResult,
} from "../lib/uniswap-augustus-quoter/src";
import { CHAIN_SCOPED_CONFIGS } from "../utils/constants";

export interface UseParaswapRoutingParams {
  sellAmount: bigint | undefined;
  sellToken: Address | undefined;
  buyToken: Address | undefined;
  beneficiary: Address | undefined;
  enabled?: boolean;
  slippagePercent?: number;
  intermediateTokens?: Address[];
  v3FeeTiers?: number[];
  refetchInterval?: number;
  chainId: number;
}

export interface UseParaswapRoutingResult {
  quote: QuoteAndCalldataResult["quote"] | undefined;
  calldata: QuoteAndCalldataResult["calldata"] | undefined;
  minAmountOut: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useParaswapRouting({
  sellAmount,
  sellToken,
  buyToken,
  beneficiary,
  enabled = true,
  slippagePercent = 300, // 3% default
  intermediateTokens,
  v3FeeTiers,
  refetchInterval,
  chainId,
}: UseParaswapRoutingParams): UseParaswapRoutingResult {
  const chainConfig = CHAIN_SCOPED_CONFIGS[chainId];
  const publicClient = usePublicClient({ chainId });
  const queryEnabled = Boolean(
    enabled &&
      sellAmount &&
      sellAmount > 0n &&
      sellToken &&
      buyToken &&
      beneficiary &&
      sellToken !== buyToken &&
      publicClient
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "paraswap-routing",
      sellToken,
      buyToken,
      sellAmount?.toString(),
      beneficiary,
      slippagePercent,
      intermediateTokens,
      v3FeeTiers,
    ],
    queryFn: async () => {
      // all args are guaranteed via queryEnabled
      const result = await getQuoteAndCalldata(
        publicClient!,
        sellToken!,
        buyToken!,
        sellAmount!,
        beneficiary!,
        {
          slippagePercent,
          intermediateTokens,
          v3FeeTiers,
        }
      );

      if (!result) {
        throw new Error("No valid quote found");
      }

      return result;
    },
    enabled: queryEnabled,
    refetchInterval: refetchInterval,
    staleTime: 15000, // 15 seconds
    gcTime: 30000, // 30 seconds (formerly cacheTime)
    retry: 1,
  });
  console.log("paraswap data", data);

  return {
    quote: data?.quote,
    calldata: data?.calldata,
    minAmountOut: data?.minAmountOut,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
