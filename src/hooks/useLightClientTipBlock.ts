import { useReadContract, useWatchContractEvent } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "../utils/store";
import { btcDutchAuctionHouseAbi } from "../generated";
import { DataEngineClient, BlockLeaf } from "../utils/dataEngineClient";

interface TipBlockInfo {
  /** Current MMR root */
  mmrRoot: `0x${string}` | undefined;
  /** Full block leaf with height, hash, and chainwork */
  blockLeaf: BlockLeaf | undefined;
  /** Whether the MMRs between contract and data engine are in sync */
  isInSync: boolean;
  /** Whether any of the queries are currently loading */
  isLoading: boolean;
  /** Whether any of the queries are pending (initial load) */
  isPending: boolean;
  /** Error object if any query failed */
  error: Error | null;
  /** Function to manually refetch the tip block data */
  refetch: () => void;
}

/**
 * Custom hook to read the current Bitcoin Light Client tip block information
 *
 * This hook fetches:
 * - The current MMR root from the light client contract
 * - The tip block height and cumulative chainwork from the current checkpoint
 * - The full block leaf (including block hash) from the data engine API
 * - Validates that both contract and data engine have the same MMR root
 *
 * If MMR roots don't match, it polls every 5 seconds until they sync up.
 * The data is automatically kept up to date by listening to `BitcoinLightClientUpdated`
 * events and data engine updates.
 *
 * @returns Object containing full block leaf, sync status, loading states, error, and refetch function
 *
 * @example
 * ```typescript
 * const { blockLeaf, isInSync, isLoading, error } = useLightClientTipBlock();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (!isInSync) return <div>Syncing...</div>;
 *
 * console.log(`Current Bitcoin tip: ${blockLeaf?.height} - ${blockLeaf?.block_hash}`);
 * ```
 */
export function useLightClientTipBlock(): TipBlockInfo {
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const riftExchangeAddress =
    selectedChainConfig.riftExchangeAddress as `0x${string}`;
  const dataEngineClient = new DataEngineClient({
    baseUrl: selectedChainConfig.dataEngineUrl,
  });

  // Fetch the current MMR root
  const {
    data: mmrRoot,
    isLoading: mmrRootLoading,
    isPending: mmrRootPending,
    error: mmrRootError,
    refetch: refetchMmrRoot,
  } = useReadContract({
    address: riftExchangeAddress,
    abi: btcDutchAuctionHouseAbi,
    functionName: "mmrRoot",
    query: {
      enabled: !!riftExchangeAddress,
    },
  });

  // Fetch the checkpoint data for the current MMR root
  const {
    data: checkpointData,
    isLoading: checkpointLoading,
    isPending: checkpointPending,
    error: checkpointError,
    refetch: refetchCheckpoint,
  } = useReadContract({
    address: riftExchangeAddress,
    abi: btcDutchAuctionHouseAbi,
    functionName: "checkpoints",
    args: mmrRoot ? [mmrRoot] : undefined,
    query: {
      enabled: !!riftExchangeAddress && !!mmrRoot,
    },
  });

  // Fetch tip proof from data engine API with MMR validation and polling
  const {
    data: tipProofData,
    isLoading: tipProofLoading,
    isPending: tipProofPending,
    error: tipProofError,
    refetch: refetchTipProof,
  } = useQuery({
    queryKey: ["dataEngine", "tipProof", mmrRoot],
    queryFn: async () => {
      const tipProof = await dataEngineClient.getTipProof();
      console.log("tipProof", tipProof);

      // Check if MMR roots match
      const contractMmrRoot = mmrRoot?.toLowerCase();
      const dataEngineMmrRoot = tipProof.peaks?.[0]?.toLowerCase(); // Assuming first peak represents MMR root

      return {
        ...tipProof,
        isInSync: contractMmrRoot === dataEngineMmrRoot,
      };
    },
    enabled: !!mmrRoot && !!riftExchangeAddress,
    refetchInterval: (data) => {
      // If not in sync, poll every 5 seconds
      // If in sync, poll every 30 seconds for updates
      return (data as any)?.isInSync ? 30_000 : 5_000;
    },
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      return failureCount < 3;
    },
  });

  // Watch for BitcoinLightClientUpdated events to trigger real-time updates
  useWatchContractEvent({
    address: riftExchangeAddress,
    abi: btcDutchAuctionHouseAbi,
    eventName: "BitcoinLightClientUpdated",
    onLogs() {
      // Refetch contract data and tip proof when light client updates
      refetchMmrRoot();
      refetchCheckpoint();
      refetchTipProof();
    },
    // For HTTP providers, enable polling to ensure we catch events
    poll: true,
    pollingInterval: 5_000, // Poll every 5 seconds as fallback
  });

  // Combine loading states
  const isLoading = mmrRootLoading || checkpointLoading || tipProofLoading;
  const isPending = mmrRootPending || checkpointPending || tipProofPending;

  // Get the first error that occurred
  const error = mmrRootError || checkpointError || tipProofError || null;

  // Extract height and cumulativeChainwork from checkpoint data
  const contractHeight = checkpointData ? Number(checkpointData[0]) : undefined;
  const contractChainwork = checkpointData ? checkpointData[1] : undefined;

  // Create full block leaf from data engine if MMRs are in sync
  const blockLeaf: BlockLeaf | undefined =
    tipProofData?.isInSync && tipProofData.leaf
      ? {
          height: tipProofData.leaf.height,
          block_hash: tipProofData.leaf.block_hash,
          cumulative_chainwork: tipProofData.leaf.cumulative_chainwork,
        }
      : undefined;

  // Validate that data engine height matches contract height when in sync
  const isInSync =
    tipProofData?.isInSync && blockLeaf?.height === contractHeight;

  // Combined refetch function
  const refetch = () => {
    refetchMmrRoot();
    refetchCheckpoint();
    refetchTipProof();
  };

  return {
    mmrRoot,
    blockLeaf,
    isInSync: isInSync ?? false,
    isLoading,
    isPending,
    error,
    refetch,
  };
}
