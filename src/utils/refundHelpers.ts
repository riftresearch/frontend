/**
 * Helper functions for creating refund requests with EIP-712 signatures
 */

import { type WalletClient } from "viem";
import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  hashTypedData,
  type Address,
} from "viem";
import { RefundPayload, RefundSwapRequest, RefundSwapResponse, OTCServerClient } from "./otcClient";

/**
 * Create a RefundSwapRequest with EIP-712 signature
 *
 * Based on the server's signature validation, this uses the correct EIP-712 structure
 * with the domain name "Rift OTC", version "1.0.0", and chainId 1.
 *
 * @param walletClient - The viem wallet client from wagmi
 * @param swapId - The UUID of the swap to refund
 * @param refundRecipient - The address to receive the refund (Bitcoin or EVM address as string)
 * @param refundTransactionFee - The transaction fee for the refund (in base units, as a string)
 * @returns A signed RefundSwapRequest ready to send to the server
 */
export async function createSignedRefundRequest(
  walletClient: WalletClient,
  swapId: string,
  refundRecipient: string,
  refundTransactionFee: string = "0"
): Promise<RefundSwapRequest> {
  if (!walletClient.account) {
    throw new Error("Wallet client must have an account");
  }

  // Create the payload
  const payload: RefundPayload = {
    swap_id: swapId,
    refund_recipient: refundRecipient,
    refund_transaction_fee: refundTransactionFee,
  };

  // EIP-712 domain and types matching the server's expectations
  const domain = {
    name: "Rift OTC",
    version: "1.0.0",
    chainId: 1,
    // Note: verifyingContract is not included based on server implementation
  } as const;

  const types = {
    SolRefundPayload: [
      { name: "swap_id", type: "string" },
      { name: "refund_recipient", type: "string" },
      { name: "refund_transaction_fee", type: "uint256" },
    ],
  } as const;

  const message = {
    swap_id: swapId,
    refund_recipient: refundRecipient,
    refund_transaction_fee: BigInt(refundTransactionFee),
  };

  console.log("[REFUND HELPER] Signing refund request:", {
    swapId,
    refundRecipient,
    refundTransactionFee,
    signerAddress: walletClient.account.address,
  });

  // Sign using EIP-712 typed data
  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain,
    types,
    primaryType: "SolRefundPayload",
    message,
  });

  console.log("[REFUND HELPER] EIP-712 signature:", signature);

  // Convert hex signature to byte array (Vec<u8> in Rust)
  const signatureHex = signature.slice(2); // Remove '0x' prefix
  const signatureBytes: number[] = [];
  for (let i = 0; i < signatureHex.length; i += 2) {
    signatureBytes.push(parseInt(signatureHex.substring(i, i + 2), 16));
  }

  console.log("[REFUND HELPER] Signature bytes length:", signatureBytes.length);
  console.log("[REFUND HELPER] Signature bytes preview:", signatureBytes.slice(0, 10));

  // Return the request with signature as byte array
  return {
    payload,
    signature: signatureBytes,
  };
}

/**
 * Check if a swap is eligible for refund based on status and timing
 *
 * @param swap - The swap object with status and timing information
 * @returns Object with eligibility status and reason
 */
export function checkRefundEligibility(swap: {
  status: string;
  user_deposit_confirmed_at?: string;
  mm_deposit_initiated_at?: string;
  mm_deposit_confirmed_at?: string;
}): { eligible: boolean; reason?: string; timeRemaining?: number } {
  const now = new Date();

  // Case 1: Market Maker Never Initiated Their Deposit
  if (swap.status === "WaitingMMDepositInitiated" && swap.user_deposit_confirmed_at) {
    const userDepositTime = new Date(swap.user_deposit_confirmed_at);
    const hoursSinceUserDeposit = (now.getTime() - userDepositTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceUserDeposit >= 1) {
      return { eligible: true, reason: "MarketMakerNeverInitiatedDeposit" };
    } else {
      const timeRemaining = 1 * 60 * 60 * 1000 - (now.getTime() - userDepositTime.getTime());
      return {
        eligible: false,
        reason: "Must wait 1 hour after user deposit confirmation",
        timeRemaining,
      };
    }
  }

  // Case 2: Market Maker Deposit Never Confirmed
  if (swap.status === "WaitingMMDepositConfirmed" && swap.mm_deposit_initiated_at) {
    const mmDepositTime = new Date(swap.mm_deposit_initiated_at);
    const hoursSinceMMDeposit = (now.getTime() - mmDepositTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceMMDeposit >= 24) {
      return { eligible: true, reason: "MarketMakerDepositNeverConfirmed" };
    } else {
      const timeRemaining = 24 * 60 * 60 * 1000 - (now.getTime() - mmDepositTime.getTime());
      return {
        eligible: false,
        reason: "Must wait 24 hours after MM deposit initiation",
        timeRemaining,
      };
    }
  }

  // Not in a refundable state
  return {
    eligible: false,
    reason: `Swap status '${swap.status}' is not refundable`,
  };
}

/**
 * Validate a refund recipient address
 * Basic validation - checks if the address is non-empty and has reasonable length
 *
 * @param address - The address to validate
 * @param addressType - The expected type of address ("bitcoin" or "ethereum")
 * @returns true if the address appears valid
 */
export function validateRefundAddress(
  address: string,
  addressType: "bitcoin" | "ethereum"
): boolean {
  if (!address || address.trim().length === 0) {
    return false;
  }

  if (addressType === "bitcoin") {
    // Bitcoin addresses typically start with 1, 3, or bc1
    // Basic length check: 26-62 characters for most Bitcoin addresses
    const trimmed = address.trim();
    return trimmed.length >= 26 && trimmed.length <= 62 && /^[13]|^bc1/.test(trimmed);
  } else {
    // Ethereum addresses should be 42 characters (0x + 40 hex chars)
    const trimmed = address.trim();
    return trimmed.length === 42 && /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  }
}

/**
 * Format error messages for refund operations
 */
export function formatRefundError(error: unknown): string {
  if (error instanceof Error) {
    // Handle user rejection
    if (error.message.includes("User rejected") || error.message.includes("user rejected")) {
      return "Signature rejected. Please try again.";
    }

    // Handle wallet connection issues
    if (error.message.includes("Wallet not connected") || error.message.includes("account")) {
      return "Wallet not connected. Please connect your wallet and try again.";
    }

    return error.message;
  }

  return "An unknown error occurred while processing the refund.";
}

/**
 * Broadcast an EVM refund transaction
 *
 * @param walletClient - The viem wallet client
 * @param txData - Hex-encoded transaction data from the server
 * @param tokenAddress - The token contract address
 * @returns Transaction hash
 */
export async function broadcastEvmRefund(
  walletClient: WalletClient,
  txData: `0x${string}`
): Promise<`0x${string}`> {
  if (!walletClient.account) {
    throw new Error("Wallet client must have an account");
  }
  const cbBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

  console.log("[REFUND HELPER] Broadcasting EVM refund transaction:", {
    tokenAddress: cbBTC,
    txData: txData.slice(0, 20) + "...",
    from: walletClient.account.address,
  });

  const formattedTxData = txData.slice(2) === "0x" ? txData : `0x${txData}`;

  // Send the transaction with the provided calldata
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: cbBTC,
    data: formattedTxData as `0x${string}`,
    chain: walletClient.chain,
    // Gas will be estimated automatically by the wallet
  });

  console.log("[REFUND HELPER] EVM refund transaction sent:", txHash);
  return txHash;
}

/**
 * Broadcast a Bitcoin refund transaction
 *
 * @param txData - Hex-encoded signed Bitcoin transaction
 * @param bitcoinRpcUrl - Bitcoin RPC endpoint URL (optional, defaults to a public API)
 * @returns Transaction hash
 */
export async function broadcastBitcoinRefund(
  txData: string,
  bitcoinRpcUrl?: string
): Promise<string> {
  const rpcUrl = bitcoinRpcUrl || "https://blockstream.info/api";

  console.log("[REFUND HELPER] Broadcasting Bitcoin refund transaction:", {
    txData: txData.slice(0, 20) + "...",
    rpcUrl,
  });

  try {
    // Use Blockstream API for broadcasting
    const response = await fetch(`${rpcUrl}/tx`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: txData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bitcoin broadcast failed: ${response.status} ${errorText}`);
    }

    const txHash = await response.text();
    console.log("[REFUND HELPER] Bitcoin refund transaction sent:", txHash);
    return txHash;
  } catch (error) {
    console.error("[REFUND HELPER] Bitcoin broadcast error:", error);
    throw new Error(
      `Failed to broadcast Bitcoin transaction: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Format time remaining until refund is available
 *
 * @param timeRemaining - Time remaining in milliseconds
 * @returns Formatted string like "2h 30m" or "45m"
 */
export function formatTimeRemaining(timeRemaining: number): string {
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Complete refund workflow helper
 *
 * This function handles the entire refund process:
 * 1. Creates and signs the refund request
 * 2. Submits it to the server
 * 3. Broadcasts the returned transaction
 *
 * @param client - RFQ client instance
 * @param walletClient - Viem wallet client for signing
 * @param swapId - UUID of the swap to refund
 * @param refundRecipient - Address to receive the refund
 * @param refundTransactionFee - Transaction fee (default "0")
 * @param tokenAddress - Token contract address (for EVM refunds)
 * @param bitcoinRpcUrl - Bitcoin RPC URL (for Bitcoin refunds)
 * @returns Object with transaction hash and refund details
 */
export const executeCompleteRefund = async (
  client: OTCServerClient,
  walletClient: any, // WalletClient from viem
  swapId: string,
  refundRecipient: string,
  refundTransactionFee: string = "0",
  tokenAddress?: string,
  bitcoinRpcUrl?: string
): Promise<{
  refundResponse: RefundSwapResponse;
  transactionHash: string;
}> => {
  // 1. Create signed refund request
  const signedRequest = await createSignedRefundRequest(
    walletClient,
    swapId,
    refundRecipient,
    refundTransactionFee
  );

  // 2. Submit to server
  const refundResponse = await client.refundSwap(signedRequest);

  // 3. Broadcast the transaction
  let transactionHash: string;

  if (refundResponse.tx_chain === "Bitcoin") {
    transactionHash = await broadcastBitcoinRefund(refundResponse.tx_data, bitcoinRpcUrl);
  } else {
    transactionHash = await broadcastEvmRefund(
      walletClient,
      refundResponse.tx_data as `0x${string}`
    );
  }

  return {
    refundResponse,
    transactionHash,
  };
};
