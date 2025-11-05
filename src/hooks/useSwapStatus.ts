import { useQuery } from "@tanstack/react-query";
import { getSwap } from "@/utils/analyticsClient";
import { AnalyticsSwapData } from "@/utils/types";

export function useSwapStatus(swapId: string | undefined) {
  const query = useQuery<AnalyticsSwapData>({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      if (!swapId) {
        throw new Error("No swap ID provided");
      }
      return getSwap(swapId);
    },
    enabled: !!swapId,
    refetchInterval: 2500,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
