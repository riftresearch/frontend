import {
  useWaitForTransactionReceipt,
  useSendTransaction,
  useAccount,
  useChainId,
  useWalletClient,
  useBlockNumber,
  useBlock,
} from "wagmi";
import { type Address, type Hex } from "viem";
import { useStore } from "@/utils/store";
import { useLightClientTipBlock } from "./useLightClientTipBlock";
import { useBitcoinTipBlock } from "./useBitcoinTipBlock";
import { BlockLeaf } from "@/utils/dataEngineClient";
import { InlineResponseDefault2 } from "@interlay/esplora-btc-api";
import { LIGHT_CLIENT_BLOCK_HEIGHT_DIFF_THRESHOLD } from "@/utils/constants";
import { toastError, toastInfo, toastSuccess } from "@/utils/toast";
import {
  type InputBundlerOperation,
  populateBundle,
  finalizeBundle,
  encodeBundle,
} from "@/lib/bundler-sdk-viem";
import { ChainId } from "@morpho-org/blue-sdk";
import { SimulationState } from "@morpho-org/simulation-sdk";
import { generatePrivateKey } from "viem/accounts";

export interface CreateAuctionParams {
  cbBTCAmount: bigint;
  startsBTCperBTCRate: bigint;
  endcbsBTCperBTCRate: bigint;
  decayBlocks: bigint;
  deadline: bigint;
  fillerWhitelistContract: Address;
  bitcoinScriptPubKey: Hex;
  confirmationBlocks: number;
}

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

type RandomSalt = `0x${string}` & { readonly __brand: "RandomSalt" };

function generateSecureRandomSalt(): RandomSalt {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const hexString = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `0x${hexString}` as RandomSalt;
}

/**
 * Custom hook to create an auction using the RiftAuctionAdaptor contract
 * Uses the bundler SDK for proper contract encoding and execution
 *
 * @returns Object containing createAuction function, loading states, and blockchain data
 *
 * @example
 * ```typescript
 * const { createAuction, isLoading, isConfirmed, isLightClientSafe } = useCreateAuction();
 *
 * const handleCreateAuction = () => {
 *   createAuction({
 *     startsBTCperBTCRate: 1000000000000000000n, // 1 BTC per BTC
 *     endcbsBTCperBTCRate: 950000000000000000n,  // 0.95 BTC per BTC
 *     decayBlocks: 100n,                         // Decay over 100 blocks
 *     deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
 *     fillerWhitelistContract: '0x0000000000000000000000000000000000000000', // No whitelist
 *     bitcoinScriptPubKey: '0x76a914...',        // P2PKH script
 *     salt: '0x123...',                          // Random salt
 *     confirmationBlocks: 6,                     // 6 confirmations required
 *   });
 * };
 * ```
 */
export function useCreateAuction() {
  const connectedChainId = useChainId();
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const { address: userAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { blockLeaf: lightClientBlockLeaf, isLoading: isLightClientLoading } =
    useLightClientTipBlock();
  const { blockInfo: canonicalBlockInfo, isLoading: isBitcoinLoading } =
    useBitcoinTipBlock();

  // Get current Ethereum block data
  const { data: currentBlockNumber } = useBlockNumber();
  const { data: currentBlock, isLoading: isCurrentBlockLoading } = useBlock({
    blockNumber: currentBlockNumber,
  });

  const isLoading =
    isLightClientLoading ||
    isBitcoinLoading ||
    isCurrentBlockLoading ||
    !lightClientBlockLeaf ||
    !canonicalBlockInfo ||
    !currentBlock;

  // Bundler3 contract interaction hooks
  const {
    sendTransaction: writeBundler,
    isPending: isBundlerPending,
    data: bundlerTxHash,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: bundlerTxHash,
    });

  const createAuction = async (params: CreateAuctionParams) => {
    if (
      !userAddress ||
      !selectedChainConfig ||
      !connectedChainId ||
      !walletClient
    ) {
      toastError(new Error(), {
        title: "Wallet not connected",
        description: "Please connect your wallet to create an auction",
      });
      return;
    }

    if (isLoading) {
      toastInfo({
        title: "Loading block information",
        description: "Please wait while we load block information",
      });
      return;
    }

    if (!isLightClientSafeForOrders(lightClientBlockLeaf, canonicalBlockInfo)) {
      toastError(new Error(), {
        title: "Light client is unsafe for orders",
        description:
          "The Light Client is unsafe for orders. Please wait while we load the block information",
      });
      return;
    }

    const { riftcbBTCAdapterAddress } = selectedChainConfig.bundler3;

    if (
      !riftcbBTCAdapterAddress ||
      riftcbBTCAdapterAddress === "0x0000000000000000000000000000000000000000"
    ) {
      toastError(new Error(), {
        title: "RiftAuctionAdaptor not deployed",
        description:
          "The RiftAuctionAdaptor contract is not deployed on this network",
      });
      return;
    }

    try {
      toastInfo({
        title: "Preparing auction",
        description: "Fetching simulation state and building transaction",
      });

      // Create simulation state with current block data
      const simulationState = new SimulationState({
        chainId: connectedChainId as ChainId,
        block: {
          number: currentBlock.number,
          timestamp: currentBlock.timestamp,
        },
      });

      // Create the base parameters for the auction
      const baseParams = {
        owner: userAddress,
        bitcoinScriptPubKey: params.bitcoinScriptPubKey,
        salt: generateSecureRandomSalt(),
        confirmationBlocks: params.confirmationBlocks,
        // TODO(alpine): This needs to be a "sufficiently" safe block leaf
        // ie at least 6 blocks behind the canonical main chain
        safeBlockLeaf: {
          blockHash: lightClientBlockLeaf.block_hash as Hex,
          height: lightClientBlockLeaf.height,
          cumulativeChainwork: BigInt(
            lightClientBlockLeaf.cumulative_chainwork
          ),
        },
      };

      // Create the input operations following whitepaper section 3.1
      // 1. ERC20 transfer (bundler SDK will automatically add permit)
      // 2. Rift auction creation
      const inputOperations: InputBundlerOperation[] = [
        // Transfer cbBTC from user to RiftAuctionAdapter
        // The bundler SDK will automatically add the permit operation
        {
          type: "Erc20_Transfer",
          sender: userAddress,
          address: selectedChainConfig.underlyingSwappingAsset
            .tokenAddress as Address,
          args: {
            amount: params.cbBTCAmount,
            from: userAddress,
            to: riftcbBTCAdapterAddress as Address,
          },
        },
        // Create the auction
        {
          type: "Rift_CreateAuction",
          sender: userAddress,
          address: riftcbBTCAdapterAddress as Address,
          args: {
            riftAdaptorAddress: riftcbBTCAdapterAddress as Address,
            startsBTCperBTCRate: params.startsBTCperBTCRate,
            endcbsBTCperBTCRate: params.endcbsBTCperBTCRate,
            decayBlocks: params.decayBlocks,
            deadline: params.deadline,
            fillerWhitelistContract: params.fillerWhitelistContract,
            baseParams,
          },
        },
      ];

      // Use the bundler SDK to populate, finalize and encode the bundle
      let { operations } = populateBundle(inputOperations, simulationState);

      operations = finalizeBundle(operations, simulationState, userAddress);

      const bundle = encodeBundle(operations, simulationState, true);

      // Sign any required permits/signatures
      await Promise.all(
        bundle.requirements.signatures.map((requirement) =>
          requirement.sign(walletClient, walletClient.account!)
        )
      );

      toastInfo({
        title: "Creating auction",
        description: "Please confirm the transaction in your wallet",
      });

      // Execute any prerequisite transactions first
      for (const { tx } of bundle.requirements.txs) {
        await writeBundler({
          to: tx.to,
          data: tx.data,
          value: tx.value,
        });
      }

      // Execute the main bundled transaction
      const mainTx = bundle.tx();
      await writeBundler({
        to: mainTx.to,
        data: mainTx.data,
        value: mainTx.value,
      });

      toastSuccess({
        title: "Auction creation submitted",
        description: "Your auction creation transaction has been submitted",
      });
    } catch (error) {
      console.error("Error creating auction:", error);
      toastError(error as Error, {
        title: "Failed to create auction",
        description:
          "There was an error creating your auction. Please try again.",
      });
    }
  };

  return {
    createAuction,
    isLoading: isLoading || isBundlerPending || isConfirming,
    isConfirmed,
    isPending: isBundlerPending,
    isConfirming,
    txHash: bundlerTxHash,
    blockLeaf: lightClientBlockLeaf,
    blockInfo: canonicalBlockInfo,
    isLightClientSafe:
      lightClientBlockLeaf && canonicalBlockInfo
        ? isLightClientSafeForOrders(lightClientBlockLeaf, canonicalBlockInfo)
        : false,
  };
}
