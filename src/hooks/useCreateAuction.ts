import {
  useWaitForTransactionReceipt,
  useSendTransaction,
  useAccount,
  useChainId,
  useWalletClient,
  useBlockNumber,
  useBlock,
  useBalance,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { useEffect, useState, useCallback } from "react";
import { type Address, type Hex, maxUint256 } from "viem";
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
import { ChainId, Holding } from "@morpho-org/blue-sdk";
import { SimulationState } from "@morpho-org/simulation-sdk";
import { useSimulationState } from "@morpho-org/simulation-sdk-wagmi";

import { generatePrivateKey } from "viem/accounts";

// ERC20 ABI for allowance and approve functions
const erc20Abi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

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
  const { data: block } = useBlock();

  // State to store pending bundle for execution after approval
  const [pendingBundle, setPendingBundle] = useState<{
    bundle: any;
    walletClient: any;
    requiredAmount: bigint;
  } | null>(null);

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

  // Get user's cbBTC balance for simulation
  const { data: userCbBTCBalance, isLoading: isBalanceLoading } = useBalance({
    address: userAddress,
    token: selectedChainConfig.underlyingSwappingAsset.tokenAddress as Address,
  });

  // Check current allowance for generalAdapter1
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: selectedChainConfig.underlyingSwappingAsset
        .tokenAddress as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [
        userAddress as Address,
        selectedChainConfig.bundler3.generalAdapter1Address as Address,
      ],
      query: {
        enabled: !!userAddress,
      },
    }
  );

  // ERC20 approval hook
  const {
    writeContract: writeApproval,
    isPending: isApprovalPending,
    data: approvalTxHash,
  } = useWriteContract();

  // Wait for approval transaction
  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalConfirmed,
    isError: isApprovalError,
    error: approvalError,
  } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  const isLoading =
    isLightClientLoading ||
    isBitcoinLoading ||
    isCurrentBlockLoading ||
    isBalanceLoading ||
    !lightClientBlockLeaf ||
    !canonicalBlockInfo ||
    !currentBlock ||
    !userCbBTCBalance;

  // Bundler3 contract interaction hooks
  const {
    sendTransaction: writeBundler,
    isPending: isBundlerPending,
    data: bundlerTxHash,
  } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
    error: confirmError,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: bundlerTxHash,
  });

  // Log approval process
  useEffect(() => {
    if (approvalTxHash) {
      console.log("🔓 Approval transaction submitted:", {
        txHash: approvalTxHash,
        timestamp: new Date().toISOString(),
      });
    }
  }, [approvalTxHash]);

  useEffect(() => {
    if (isApprovalPending) {
      console.log("⏳ Approval pending - waiting for user signature...");
    }
  }, [isApprovalPending]);

  useEffect(() => {
    if (isApprovalConfirming && approvalTxHash) {
      console.log("⏳ Approval confirming - waiting for block inclusion...", {
        txHash: approvalTxHash,
      });
    }
  }, [isApprovalConfirming, approvalTxHash]);

  // Function to execute a bundle (shared between direct execution and post-approval)
  const executeBundle = useCallback(
    async (bundle: any, walletClient: any) => {
      try {
        toastInfo({
          title: "Creating auction",
          description: "Please confirm the transaction in your wallet",
        });

        // Execute the main bundled transaction
        const mainTx = bundle.tx();
        console.log("🎯 Executing main bundled transaction:", {
          to: mainTx.to,
          data: mainTx.data,
          value: 0n,
          dataLength: mainTx.data.length,
        });

        writeBundler({
          to: mainTx.to,
          data: mainTx.data,
          value: 0n,
        });

        console.log(
          "🚀 Main transaction submitted - waiting for confirmation..."
        );

        toastSuccess({
          title: "Auction creation submitted",
          description: "Your auction creation transaction has been submitted",
        });
      } catch (error) {
        console.error("❌ Error executing bundle:", error);
        toastError(error as Error, {
          title: "Failed to execute auction",
          description:
            "There was an error executing your auction. Please try again.",
        });
        throw error;
      }
    },
    [writeBundler]
  );

  // Function to execute the pending bundle
  const executePendingBundle = useCallback(async () => {
    if (!pendingBundle) return;

    const { bundle, walletClient, requiredAmount } = pendingBundle;

    try {
      console.log("🚀 Executing pending bundle after approval...");

      // Execute the bundle
      await executeBundle(bundle, walletClient);

      // Clear pending bundle
      setPendingBundle(null);
    } catch (error) {
      console.error("❌ Error executing pending bundle:", error);
      toastError(error as Error, {
        title: "Failed to execute auction",
        description:
          "There was an error executing your auction. Please try again.",
      });
      setPendingBundle(null);
    }
  }, [pendingBundle, refetchAllowance, currentAllowance, writeBundler]);

  useEffect(() => {
    if (isApprovalConfirmed) {
      console.log("✅ Approval confirmed successfully!");
      refetchAllowance(); // Refresh allowance data

      // Execute pending bundle if it exists
      if (pendingBundle) {
        console.log("🎯 Triggering pending bundle execution...");
        executePendingBundle();
      }
    }
  }, [
    isApprovalConfirmed,
    refetchAllowance,
    pendingBundle,
    executePendingBundle,
  ]);

  useEffect(() => {
    if (isApprovalError && approvalError) {
      console.error("❌ Approval failed:", {
        error: approvalError,
        message: approvalError.message,
        name: approvalError.name,
      });
    }
  }, [isApprovalError, approvalError]);

  // Log transaction hash when it becomes available
  useEffect(() => {
    if (bundlerTxHash) {
      console.log("🚀 Transaction submitted:", {
        txHash: bundlerTxHash,
        timestamp: new Date().toISOString(),
      });
    }
  }, [bundlerTxHash]);

  // Log transaction status changes
  useEffect(() => {
    if (isBundlerPending) {
      console.log("⏳ Transaction pending - waiting for user signature...");
    }
  }, [isBundlerPending]);

  // Log confirmation status
  useEffect(() => {
    if (isConfirming && bundlerTxHash) {
      console.log(
        "⏳ Transaction confirming - waiting for block inclusion...",
        {
          txHash: bundlerTxHash,
        }
      );
    }
  }, [isConfirming, bundlerTxHash]);

  // Log successful confirmation with receipt details
  useEffect(() => {
    if (isConfirmed && receipt) {
      console.log("✅ Transaction confirmed successfully!", {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
        logs: receipt.logs,
        status: receipt.status,
        receipt: receipt,
      });
    }
  }, [isConfirmed, receipt]);

  // Log transaction errors
  useEffect(() => {
    if (isConfirmError && confirmError) {
      console.error("❌ Transaction failed:", {
        error: confirmError,
        message: confirmError.message,
        name: confirmError.name,
        cause: confirmError.cause,
      });
    }
  }, [isConfirmError, confirmError]);

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

    if (
      selectedChainConfig.type === "Mainnet" &&
      !isLightClientSafeForOrders(lightClientBlockLeaf, canonicalBlockInfo)
    ) {
      toastError(new Error(), {
        title: "Light client is unsafe for orders",
        description:
          " A light client update proof must be sent before creating an auction",
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

      // Get bundler addresses for allowances
      const { bundler3Address, generalAdapter1Address } =
        selectedChainConfig.bundler3;

      // Create simulation state with current block data and user holdings
      const simulationState = new SimulationState({
        chainId: connectedChainId as ChainId,
        block: {
          number: currentBlock.number,
          timestamp: currentBlock.timestamp,
        },
        holdings: {
          [userAddress]: {
            [selectedChainConfig.underlyingSwappingAsset.tokenAddress]:
              new Holding({
                user: userAddress,
                token: selectedChainConfig.underlyingSwappingAsset
                  .tokenAddress as Address,
                balance: userCbBTCBalance.value,
                erc20Allowances: {
                  [bundler3Address]: 0n,
                  [generalAdapter1Address]: 0n,
                  morpho: 0n,
                  permit2: 0n,
                  // as far as the simulation is concerned, the generalAdapter1 has unlimited allowance
                  "bundler3.generalAdapter1": maxUint256,
                },
                permit2BundlerAllowance: {
                  amount: 0n,
                  expiration: 0n,
                  nonce: 0n,
                },
              }),
          },
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
      // 1. ERC20 transfer
      // 2. Rift auction creation
      const inputOperations: InputBundlerOperation[] = [
        // Transfer cbBTC from user to RiftAuctionAdapter
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

      console.log("📦 Input operations:", {
        inputOperations,
        count: inputOperations.length,
      });

      operations = finalizeBundle(operations, simulationState, userAddress);

      console.log("🔧 Finalized operations:", {
        operations,
        count: operations.length,
      });

      const bundle = encodeBundle(operations, simulationState, true);

      console.log("💼 Bundle created:", {
        bundle,
        requirementsCount: {
          signatures: bundle.requirements.signatures.length,
          transactions: bundle.requirements.txs.length,
        },
        requirements: {
          signatures: bundle.requirements.signatures.map((sig, index) => ({
            index,
            signature: sig,
          })),
          transactions: bundle.requirements.txs.map((tx, index) => ({
            index,
            to: tx.tx.to,
            data: tx.tx.data,
            value: tx.tx.value?.toString() || "0",
          })),
        },
        mainTransaction: {
          to: bundle.tx().to,
          data: bundle.tx().data,
          value: bundle.tx().value?.toString() || "0",
        },
      });

      // Check if approval is needed before executing bundle
      const requiredAmount = params.cbBTCAmount;
      const hasEnoughAllowance =
        currentAllowance && currentAllowance >= requiredAmount;

      console.log("🔍 Allowance check:", {
        currentAllowance: currentAllowance?.toString() || "0",
        requiredAmount: requiredAmount.toString(),
        hasEnoughAllowance,
        generalAdapter: selectedChainConfig.bundler3.generalAdapter1Address,
      });

      if (!hasEnoughAllowance) {
        console.log("🔓 Insufficient allowance - requesting approval...");

        // Store the bundle for execution after approval
        setPendingBundle({
          bundle,
          walletClient,
          requiredAmount,
        });

        toastInfo({
          title: "Approval required",
          description: "Please approve cbBTC spending for the bundler",
        });

        // Request approval for maximum amount
        writeApproval({
          address: selectedChainConfig.underlyingSwappingAsset
            .tokenAddress as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [
            selectedChainConfig.bundler3.generalAdapter1Address as Address,
            maxUint256,
          ],
        });

        console.log(
          "⏳ Approval requested - bundle will execute automatically after confirmation..."
        );
        return;
      }

      console.log("✅ Sufficient allowance - proceeding with bundle execution");

      // Execute the bundle directly
      await executeBundle(bundle, walletClient);
    } catch (error) {
      console.error("❌ Error creating auction:", {
        error,
        message: (error as Error)?.message,
        name: (error as Error)?.name,
        stack: (error as Error)?.stack,
        cause: (error as Error)?.cause,
        timestamp: new Date().toISOString(),
      });

      toastError(error as Error, {
        title: "Failed to create auction",
        description:
          "There was an error creating your auction. Please try again.",
      });
    }
  };

  return {
    createAuction,
    isLoading:
      isLoading ||
      isBundlerPending ||
      isConfirming ||
      isApprovalPending ||
      isApprovalConfirming,
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
    // Approval-related data
    currentAllowance,
    isApprovalPending,
    isApprovalConfirming,
    isApprovalConfirmed,
    approvalTxHash,
  };
}
