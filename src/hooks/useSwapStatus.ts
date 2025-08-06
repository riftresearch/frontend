import { useQuery } from "@tanstack/react-query";
import { otcClient } from "@/utils/constants";
import { SwapResponse } from "@/utils/otcClient";

export function useSwapStatus(swapId: string | undefined) {
  console.log("swapId", swapId);
  const query = useQuery<SwapResponse>({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      if (!swapId) {
        throw new Error("No swap ID provided");
      }
      return otcClient.getSwap(swapId);
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
