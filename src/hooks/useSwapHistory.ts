import { useState, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useStore } from "../utils/store";
import { DataEngineClient, OTCSwap } from "../utils/dataEngineClient";
import { SwapHistoryItem } from "../utils/types";
import { Address, formatUnits } from "viem";

interface SwapHistoryState {
  /** Array of all swap history items loaded so far */
  swaps: SwapHistoryItem[];
  /** Whether there are more pages available */
  hasNextPage: boolean;
  /** Whether data is currently loading more */
  isLoadingMore: boolean;
  /** Whether this is the initial load */
  isLoading: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Load more swaps */
  loadMore: () => void;
  /** Manual refetch function */
  refetch: () => void;
}

/**
 * Convert OTCSwap data from dataEngineClient to SwapHistoryItem format
 */
const convertOTCSwapToHistoryItem = (otcSwap: OTCSwap): SwapHistoryItem => {
  const { order, payments } = otcSwap;

  // Determine status based on order state and payments
  let status: "Completed" | "Pending" | "Failed" = "Pending";
  if (order.order.state === 2) {
    status = "Completed";
  } else if (order.order.state === 3) {
    status = "Failed";
  }

  // Calculate time ago from timestamp
  const timeAgo = new Date(order.order.timestamp * 1000).toLocaleString();

  const startingAmount =
    BigInt(order.order.amount) + BigInt(order.order.takerFee);

  // Format amounts using viem's formatUnits
  const amount = parseFloat(formatUnits(startingAmount, 8)).toFixed(8);
  const outputAmount = parseFloat(
    formatUnits(BigInt(order.order.expectedSats), 8)
  ).toFixed(8);

  return {
    id: `${order.order_txid}-${order.order.index}`,
    amount,
    asset: "cbBTC",
    outputAmount,
    outputAsset: "BTC",
    status,
    timeAgo,
    txHash: order.order_txid,
  };
};

/**
 * Custom hook to manage user's swap history with infinite scroll
 *
 * Fetches swap data from the dataEngineClient and loads more as needed.
 * Automatically resets when the user address changes.
 *
 * @returns Object containing swap history data and loading states
 *
 * @example
 * ```typescript
 * const {
 *   swaps,
 *   hasNextPage,
 *   isLoadingMore,
 *   loadMore,
 *   isLoading
 * } = useSwapHistory();
 * ```
 */
export function useSwapHistory(): SwapHistoryState {
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const { address: userAddress } = useAccount();

  // Create data engine client
  const dataEngineClient = new DataEngineClient({
    baseUrl: selectedChainConfig.dataEngineUrl,
  });

  // Use infinite query for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["swapHistory", userAddress],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      if (!userAddress) return { swaps: [], nextPage: null };

      const swaps = await dataEngineClient.getSwapsForAddress({
        address: userAddress as Address,
        page: pageParam,
      });

      // Return swaps and next page indicator
      // If we get less than a certain threshold, assume no more pages
      const PAGE_SIZE = 10; // Adjust based on your API's page size
      return {
        swaps,
        nextPage: swaps.length >= PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: {
      swaps: OTCSwap[];
      nextPage: number | null;
    }) => lastPage.nextPage,
    enabled: !!userAddress && !!selectedChainConfig.dataEngineUrl,
    retry: (failureCount) => failureCount < 3,
    staleTime: 30_000,
    refetchInterval: 5_000,
  });

  // Flatten all pages of swaps into a single array
  const allSwaps = data?.pages.flatMap((page) => page.swaps) ?? [];
  const swaps: SwapHistoryItem[] = allSwaps.map(convertOTCSwapToHistoryItem);

  // Load more function
  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    swaps,
    hasNextPage: hasNextPage ?? false,
    isLoadingMore: isFetchingNextPage,
    isLoading,
    error,
    loadMore,
    refetch,
  };
}
