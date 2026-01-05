import { useQuery } from "@tanstack/react-query";
import type { Block } from "viem";

/**
 * Bitcoin block header from Esplora API
 */
interface BitcoinBlockHeader {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  bits: number;
  nonce: number;
  difficulty: number;
  merkle_root: string;
  tx_count: number;
  size: number;
  weight: number;
  previousblockhash: string;
}

/**
 * Verification result containing both chain headers
 */
interface ChainSyncResult {
  isValid: boolean;
  ethereumHeader?: Block;
  bitcoinHeader?: BitcoinBlockHeader;
  ethereumBlockHeight?: bigint;
  bitcoinBlockHeight?: number;
  heightDiff?: {
    ethereum: bigint;
    bitcoin: number;
  };
  error?: string;
}

/**
 * Hook to verify that the TEE's chain clients are synced with the actual chains.
 *
 * NOTE: This is currently stubbed to return valid sync status until the riftApiClient
 * supports getBestHash endpoints. The original implementation used otcClient.getBestHash().
 */
export function useTEEChainSyncVerification() {
  const query = useQuery<ChainSyncResult>({
    queryKey: ["chain-sync-verification"],
    queryFn: async () => {
      // TODO: Replace with actual riftApiClient chain sync verification when available
      console.log("[useTEEChainSyncVerification] Returning stubbed sync result (valid)");
      return {
        isValid: true,
        heightDiff: {
          ethereum: 0n,
          bitcoin: 0,
        },
      };
    },
    enabled: true,
    refetchInterval: 1000 * 60 * 60, // Refetch every 1 hour
    staleTime: 1000 * 60 * 60, // Consider stale after 1 hour
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    isTEESynced: query.data?.isValid ?? true,
    ethereumHeader: query.data?.ethereumHeader,
    bitcoinHeader: query.data?.bitcoinHeader,
    ethereumBlockHeight: query.data?.ethereumBlockHeight,
    bitcoinBlockHeight: query.data?.bitcoinBlockHeight,
    heightDiff: query.data?.heightDiff,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    verificationError: query.data?.error,
    refetch: query.refetch,
  };
}
