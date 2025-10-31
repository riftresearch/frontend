import {
  otcClient,
  GLOBAL_CONFIG,
  ETH_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD,
  BTC_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD,
} from "@/utils/constants";
import {wagmiAdapter} from "@/utils/wallet";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type Block } from "viem";
import { mainnet } from "viem/chains";

/**
 * Bitcoin block header from Esplora API
 */
interface BitcoinBlockHeader {
  id: string; // Block hash
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

// Create a public client for Ethereum RPC calls
const ethereumClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

/**
 * Fetches Bitcoin block header from Esplora API
 */
async function fetchBitcoinBlockHeader(blockHash: string): Promise<BitcoinBlockHeader> {
  const response = await fetch(`${GLOBAL_CONFIG.esploraUrl}/block/${blockHash}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Bitcoin block header: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches the latest Bitcoin block height from Esplora API
 */
async function fetchLatestBitcoinHeight(): Promise<number> {
  const response = await fetch(`${GLOBAL_CONFIG.esploraUrl}/blocks/tip/height`);

  if (!response.ok) {
    throw new Error(`Failed to fetch latest Bitcoin height: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook to verify that the TEE's chain clients are synced with the actual chains
 * Fetches block headers from both Ethereum (via viem) and Bitcoin (via Esplora)
 * and compares them against the TEE's reported best hashes
 */
export function useTEEChainSyncVerification() {
  const query = useQuery<ChainSyncResult>({
    queryKey: ["chain-sync-verification"],
    queryFn: async () => {
      try {
        // Fetch best hashes from the TEE
        const [bestTEEBitcoinHash, bestTEEEthereumHash] = await Promise.all([
          otcClient.getBestHash("bitcoin"),
          otcClient.getBestHash("ethereum"),
        ]);

        console.log("TEE Best Hashes:", {
          bitcoin: bestTEEBitcoinHash,
          ethereum: bestTEEEthereumHash,
        });

        // Validate that we got valid hash values
        if (!bestTEEBitcoinHash || typeof bestTEEBitcoinHash !== "string") {
          throw new Error(`Invalid Bitcoin hash from TEE: ${bestTEEBitcoinHash}`);
        }
        if (!bestTEEEthereumHash || typeof bestTEEEthereumHash !== "string") {
          throw new Error(`Invalid Ethereum hash from TEE: ${bestTEEEthereumHash}`);
        }


        // Fetch headers from actual chains
        const [ethereumHeader, bitcoinHeader, latestEthBlock, latestBtcHeight] = await Promise.all([
          ethereumClient.getBlock({ blockHash: bestTEEEthereumHash as `0x${string}` }),
          fetchBitcoinBlockHeader(bestTEEBitcoinHash),
          ethereumClient.getBlockNumber(),
          fetchLatestBitcoinHeight(),
        ]);

        console.log("Chain Headers:", {
          ethereum: {
            hash: ethereumHeader.hash,
            number: ethereumHeader.number,
            timestamp: ethereumHeader.timestamp,
          },
          bitcoin: {
            hash: bitcoinHeader.id,
            height: bitcoinHeader.height,
            timestamp: bitcoinHeader.timestamp,
          },
        });

        // Calculate block height differences
        const ethHeightDiff = latestEthBlock - ethereumHeader.number;
        const btcHeightDiff = latestBtcHeight - bitcoinHeader.height;

        console.log("Block Height Differences:", {
          ethereum: {
            latest: latestEthBlock,
            tee: ethereumHeader.number,
            diff: ethHeightDiff,
          },
          bitcoin: {
            latest: latestBtcHeight,
            tee: bitcoinHeader.height,
            diff: btcHeightDiff,
          },
        });

        // Verify that headers exist and match the hashes
        const ethereumHashMatches =
          ethereumHeader.hash?.toLowerCase() === bestTEEEthereumHash.toLowerCase();
        const bitcoinHashMatches =
          bitcoinHeader.id.toLowerCase() === bestTEEBitcoinHash.toLowerCase();

        // Check if the TEE is within acceptable sync threshold
        const isEthereumSynced = ethHeightDiff <= BigInt(ETH_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD);
        const isBitcoinSynced = btcHeightDiff <= BTC_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD;

        const isValid =
          ethereumHashMatches && bitcoinHashMatches && isEthereumSynced && isBitcoinSynced;

        if (!isValid) {
          console.warn("Chain sync verification failed:", {
            ethereumHashMatches,
            bitcoinHashMatches,
            isEthereumSynced,
            isBitcoinSynced,
            ethHeightDiff: ethHeightDiff.toString(),
            btcHeightDiff,
          });
        }

        return {
          isValid,
          ethereumHeader,
          bitcoinHeader,
          ethereumBlockHeight: ethereumHeader.number,
          bitcoinBlockHeight: bitcoinHeader.height,
          heightDiff: {
            ethereum: ethHeightDiff,
            bitcoin: btcHeightDiff,
          },
        };
      } catch (error) {
        console.error("Chain sync verification error:", error);
        return {
          isValid: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    enabled: true,
    refetchInterval: 1000 * 60 * 60, // Refetch every 1 hour
    staleTime: 1000 * 60 * 60, // Consider stale after 1 hour
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    isTEESynced: query.data?.isValid ?? false,
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
