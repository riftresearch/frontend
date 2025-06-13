import { useQuery } from "@tanstack/react-query";
import esplora, { InlineResponseDefault2 } from "@interlay/esplora-btc-api";
import { useStore } from "../utils/store";

interface BitcoinTipBlockInfo {
  /** Current Bitcoin block hash */
  blockHash: string | undefined;
  /** Current Bitcoin block height */
  blockHeight: number | undefined;
  /** Full Bitcoin block information */
  blockInfo: InlineResponseDefault2 | undefined;
  /** Whether the query is currently loading */
  isLoading: boolean;
  /** Whether the query is pending (initial load) */
  isPending: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Function to manually refetch the tip block data */
  refetch: () => void;
}

/**
 * Custom hook to read the current Bitcoin tip block information using Esplora API
 *
 * This hook fetches:
 * - The current Bitcoin tip block hash
 * - The current Bitcoin tip block height (derived from block hash)
 * - Full block information including timestamp, merkle root, etc.
 *
 * The data is automatically kept up to date by polling every 30 seconds.
 * First fetches the tip block hash, then uses that hash to get the full block information.
 *
 * @returns Object containing block hash, height, full block info, loading states, error, and refetch function
 *
 * @example
 * ```typescript
 * const { blockHash, blockHeight, blockInfo, isLoading, error } = useBitcoinTipBlock();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * console.log(`Current Bitcoin tip: ${blockHeight} - ${blockHash}`);
 * ```
 */
export function useBitcoinTipBlock(): BitcoinTipBlockInfo {
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const esploraUrl = selectedChainConfig.esploraUrl;

  // Initialize Esplora BlockApi
  const blockApi = new esplora.BlockApi({
    basePath: esploraUrl,
    isJsonMime: (mime) => mime.startsWith("application/json"),
  });

  // Fetch the current Bitcoin tip block hash
  const {
    data: blockHash,
    isLoading: hashLoading,
    isPending: hashPending,
    error: hashError,
    refetch: refetchHash,
  } = useQuery({
    queryKey: ["bitcoin", "tipBlockHash", selectedChainConfig.chainId],
    queryFn: async () => {
      const { data } = await blockApi.getLastBlockHash();
      return data;
    },
    enabled: !!esploraUrl,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000, // Refetch every 30 seconds
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      return failureCount < 3;
    },
  });

  // Fetch the current Bitcoin tip block info from the block hash
  const {
    data: blockInfo,
    isLoading: heightLoading,
    isPending: heightPending,
    error: heightError,
    refetch: refetchHeight,
  } = useQuery({
    queryKey: [
      "bitcoin",
      "tipBlockInfo",
      blockHash,
      selectedChainConfig.chainId,
    ],
    queryFn: async () => {
      if (!blockHash) throw new Error("Block hash is required");
      const { data } = await blockApi.getBlock(blockHash);
      return data;
    },
    enabled: !!esploraUrl && !!blockHash,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000, // Refetch every 30 seconds
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      return failureCount < 3;
    },
  });

  // Combine loading states
  const isLoading = hashLoading || heightLoading;
  const isPending = hashPending || heightPending;

  // Get the first error that occurred
  const error = hashError || heightError || null;

  // Combined refetch function
  const refetch = () => {
    refetchHash();
    refetchHeight();
  };

  return {
    blockHash,
    blockHeight: blockInfo?.height,
    blockInfo,
    isLoading,
    isPending,
    error,
    refetch,
  };
}
