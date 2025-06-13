import { useWaitForTransactionReceipt } from "wagmi";
import { type Address } from "viem";
import {
  useSimulateRiftAuctionAdaptorCreateAuction,
  useWriteRiftAuctionAdaptorCreateAuction,
} from "@/generated";
import { useStore } from "@/utils/store";
import { useLightClientTipBlock } from "./useLightClientTipBlock";
import { useBitcoinTipBlock } from "./useBitcoinTipBlock";
import { BlockLeaf } from "@/utils/dataEngineClient";
import { InlineResponseDefault2 } from "@interlay/esplora-btc-api";
import { LIGHT_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD } from "@/utils/constants";
import { toastError, toastInfo } from "@/utils/toast";

/// If the difference between the Bitcoin block height and the Light Client block height is greater than the threshold,
/// we consider the Light Client to be unsafe for orders.
const isLightClientSafeForOrders = (
  lightClientBlockLeaf: BlockLeaf,
  bitcoinBlockInfo: InlineResponseDefault2
) => {
  const { height: bitcoinBlockHeight } = bitcoinBlockInfo;
  const { height: lightClientBlockHeight } = lightClientBlockLeaf;
  const heightDiff = bitcoinBlockHeight - lightClientBlockHeight;
  return heightDiff <= LIGHT_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD;
};

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
  const { blockLeaf, isLoading: isLightClientLoading } =
    useLightClientTipBlock();
  const { blockInfo, isLoading: isBitcoinLoading } = useBitcoinTipBlock();

  const isLoading =
    isLightClientLoading || isBitcoinLoading || !blockLeaf || !blockInfo;

  const createAuction = async () => {
    if (isLoading) {
      toastInfo({
        title: "Loading block information",
        description: "Please wait while we load block information",
      });
      return;
    }

    if (!isLightClientSafeForOrders(blockLeaf, blockInfo)) {
      toastError(new Error(), {
        title: "Light client is unsafe for orders",
        description:
          "The Light Client is unsafe for orders. Please wait while we load the block information",
      });
      return;
    }
  };

  const {
    writeContract: write,
    writeContractAsync: writeAsync,
    data,
    isPending,
  } = useWriteRiftAuctionAdaptorCreateAuction();
}
