import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { type Hash } from "viem";

/**
 * Hook to track EVM transaction confirmations
 * @param txHash - Transaction hash to track
 * @param chainId - Chain ID (1 for Ethereum, 8453 for Base)
 * @param enabled - Whether to actively track confirmations
 * @returns Current number of confirmations
 */
export function useEvmConfirmations(
  txHash: Hash | string | undefined,
  chainId: number | undefined,
  enabled: boolean = true
): number {
  const [confirmations, setConfirmations] = useState<number>(0);
  const publicClient = usePublicClient({ chainId });

  useEffect(() => {
    if (!enabled || !txHash || !publicClient) {
      setConfirmations(0);
      return;
    }

    let isCancelled = false;

    async function fetchConfirmations() {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: txHash as Hash,
        });

        if (!receipt || !isCancelled) {
          // Get current block number
          const currentBlock = await publicClient.getBlockNumber();

          // Calculate confirmations
          const confs = Number(currentBlock - receipt.blockNumber + 1n);

          if (!isCancelled) {
            setConfirmations(confs);
            console.log(`[EVM CONFIRMATIONS] ${txHash}: ${confs} confirmations`);
          }
        }
      } catch (error) {
        // Transaction might not be mined yet
        if (!isCancelled) {
          setConfirmations(0);
        }
      }
    }

    // Fetch immediately
    fetchConfirmations();

    // Poll every 12 seconds (roughly 1 Ethereum block time)
    const interval = setInterval(fetchConfirmations, 12000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [txHash, publicClient, enabled]);

  return confirmations;
}
