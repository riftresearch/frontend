import { useQuery } from "@tanstack/react-query";
import { riftApiClient } from "@/utils/constants";
import { Swap } from "@/utils/riftApiClient";

export function useSwapStatus(swapId: string | undefined) {
  const query = useQuery<Swap>({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      if (!swapId) {
        throw new Error("No swap ID provided");
      }
      const result = await riftApiClient.getOrder(swapId);
      if (!result.ok) {
        throw new Error(result.error.error || "Failed to fetch swap status");
      }
      return result.data;
    },
    enabled: !!swapId,
    refetchInterval: 2500,
    // Ensure polling continues even when tab is in background
    refetchIntervalInBackground: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
