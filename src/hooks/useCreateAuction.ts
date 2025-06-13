import { useWaitForTransactionReceipt } from "wagmi";
import { type Address } from "viem";
import {
  useSimulateRiftAuctionAdaptorCreateAuction,
  useWriteRiftAuctionAdaptorCreateAuction,
} from "@/generated";
import { useStore } from "@/utils/store";
import { useLightClientTipBlock } from "./useLightClientTipBlock";

/**
 * Custom hook to create an auction using the RiftAuctionAdaptor contract
 * Uses generated wagmi hooks for type safety and automatic contract address resolution
 *
 * @param params - Optional configuration for chainId and contract address override
 * @returns Object containing writeContract function, simulation, transaction data, loading states, and errors
 *
 * @example
 * ```typescript
 * const { writeContract, simulate, isPending, isConfirmed, error } = useCreateAuction({
 *   chainId: 1337
 * });
 *
 * const handleCreateAuction = () => {
 *   // Simulate first (optional but recommended)
 *   simulate(
 *     1000000000000000000n, // startsBTCperBTCRate
 *     950000000000000000n,  // endcbsBTCperBTCRate
 *     100n,                 // decayBlocks
 *     BigInt(Math.floor(Date.now() / 1000) + 3600), // deadline
 *     '0x0000000000000000000000000000000000000000', // fillerWhitelistContract
 *     {                     // baseParams
 *       owner: '0x456...',
 *       bitcoinScriptPubKey: '0x76a914...',
 *       salt: '0x123...',
 *       confirmationBlocks: 6,
 *       safeBlockLeaf: {
 *         blockHash: '0x000...',
 *         height: 800000,
 *         cumulativeChainwork: 123456789n
 *       }
 *     }
 *   );
 *
 *   // Then execute the transaction
 *   writeContract(...sameArgs);
 * };
 * ```
 */
export function useCreateAuction() {
  const connectedChainId = useStore((state) => state.connectedChainId);
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const { blockLeaf, isInSync, error } = useLightClientTipBlock();
  // TODO: Make this real

  console.log("blockLeaf|isInSync|error", blockLeaf, isInSync, error);

  const {
    writeContract: write,
    writeContractAsync: writeAsync,
    data,
    isPending,
  } = useWriteRiftAuctionAdaptorCreateAuction();
}
