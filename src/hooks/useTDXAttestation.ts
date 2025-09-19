import { useQuery } from "@tanstack/react-query";
import { otcClient } from "@/utils/constants";
import { FullyQualifiedTDXQuote, SwapResponse } from "@/utils/otcClient";
import { verifyPhalaAttestation } from "@/utils/phalaVerifierClient";

/**
 * Ensures a hex string is properly prefixed with "0x"
 * @param hex - The hex string to prefix
 * @returns The hex string with "0x" prefix
 */
const ensureHexPrefix = (hex: string): string => {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
};

/**
 * Cache duration in milliseconds (30 minutes)
 */
const CACHE_DURATION = 30 * 60 * 1000;

/**
 * Cache key for localStorage
 */
const CACHE_KEY = "tdx-attestation-cache";

/**
 * Interface for cached TDX attestation data
 */
interface TDXAttestationCache {
  isValidTEE: boolean;
  timestamp: number;
}

/**
 * Checks if we have a valid cached result that's less than 30 minutes old
 */
const getCachedResult = (): boolean | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsedCache: TDXAttestationCache = JSON.parse(cached);
    const now = Date.now();
    const isExpired = now - parsedCache.timestamp > CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsedCache.isValidTEE;
  } catch (error) {
    console.warn("Failed to read TDX attestation cache:", error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

/**
 * Caches the TDX attestation result with current timestamp
 */
const setCachedResult = (isValidTEE: boolean): void => {
  try {
    const cacheData: TDXAttestationCache = {
      isValidTEE,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn("Failed to cache TDX attestation result:", error);
  }
};

export function useTDXAttestation() {
  const query = useQuery<boolean>({
    queryKey: ["tdx-attestation"],
    queryFn: async () => {
      // Check if we have a valid cached result first
      const cachedResult = getCachedResult();
      if (cachedResult !== null) {
        console.log("Using cached TDX attestation result:", cachedResult);
        return cachedResult;
      }

      console.log("Getting fresh TDX quote (cache miss or expired)");
      const tdxQuote = await otcClient.getTDXQoute();
      console.log("tdxQuote", tdxQuote);

      const phalaAttestation = await verifyPhalaAttestation(
        ensureHexPrefix(tdxQuote.tdx_response.quote)
      );
      console.log("phalaAttestation", phalaAttestation);

      // Cache the result for future use (if successful)
      if (phalaAttestation.success) {
        setCachedResult(phalaAttestation.success);
      }

      return phalaAttestation.success;
    },
    enabled: true,
    refetchInterval: false,
    // Set a longer stale time to prevent unnecessary refetches
    staleTime: CACHE_DURATION,
    // Cache the query result for the same duration
    gcTime: CACHE_DURATION,
  });

  return {
    isValidTEE: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
