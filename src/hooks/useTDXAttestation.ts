import { useQuery } from "@tanstack/react-query";

/**
 * Cache duration in milliseconds (30 minutes)
 */
const CACHE_DURATION = 30 * 60 * 1000;

/**
 * Hook to verify TDX attestation from the TEE.
 *
 * NOTE: This is currently stubbed to return true until the riftApiClient
 * supports TDX quote fetching. The original implementation used otcClient.getTDXQoute().
 */
export function useTDXAttestation() {
  const query = useQuery<boolean>({
    queryKey: ["tdx-attestation"],
    queryFn: async () => {
      // TODO: Replace with actual riftApiClient TDX attestation when available
      console.log("[useTDXAttestation] Returning stubbed attestation result (true)");
      return true;
    },
    enabled: true,
    refetchInterval: false,
    staleTime: CACHE_DURATION,
    gcTime: CACHE_DURATION,
  });

  return {
    isValidTEE: query.data ?? true,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
