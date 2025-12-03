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
  console.log("[REFUND HELPER NEW] Creating signed refund request:", {
    swapId,
    refundRecipient,
    refundTransactionFee,
  });
  const signedRequest = await createSignedRefundRequest(
    walletClient,
    swapId,
    refundRecipient,
    refundTransactionFee
  );

  console.log("[REFUND HELPER NEW] Signed request:", signedRequest);

  // 2. Submit to server
  const refundResponse = await client.refundSwap(signedRequest);

  console.log("[REFUND HELPER ALPINE] Refund response:", refundResponse);

  // 3. Broadcast the transaction
  let transactionHash: string;

  if (refundResponse.tx_chain === "bitcoin") {
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

/**
 * Check if a swap is refundable by verifying server flag and checking deposit address balance
 * @param row - The raw swap data from the server
 * @param mappedSwap - The mapped AdminSwapItem (with flow steps)
 * @returns Object with refund availability status and whether swap should be marked as refunded
 */
export async function filterRefunds(
  row: any,
  mappedSwap: { id: string; flow: Array<{ status: string; state: string }> }
): Promise<{
  isRefundAvailable: boolean;
  shouldMarkAsRefunded: boolean;
  isPartialDeposit?: boolean;
}> {
  // Dynamic import to avoid circular dependencies
  const { GLOBAL_CONFIG } = await import("./constants");

  let isRefundAvailable = false;
  let shouldMarkAsRefunded = false;

  const userDepositAddress = row.user_deposit_address;
  const userDepositChain = row.quote.from_chain; // ethereum or bitcoin
  const swapStatus = row.status;

  // If status is already refunding_user or refunding_mm, mark as refunded immediately
  if (swapStatus === "refunding_user" || swapStatus === "refunding_mm") {
    console.log(
      `[REFUND STATUS] Swap ${mappedSwap.id}: Status is ${swapStatus}, marking as refunded`
    );
    return { isRefundAvailable: false, shouldMarkAsRefunded: true, isPartialDeposit: false };
  }

  // Special case: Partial deposit detection
  // If swap is still waiting for user deposit but user sent less than required amount
  if (
    swapStatus === "waiting_user_deposit_initiated" ||
    swapStatus === "waiting_user_deposit_confirmed" ||
    swapStatus === "WaitingUserDepositInitiated" ||
    swapStatus === "WaitingUserDepositConfirmed"
  ) {
    console.log(`[PARTIAL DEPOSIT CHECK] Swap ${mappedSwap.id}: Checking for partial deposit...`);

    const expectedAmount = row.quote?.from_amount; // Expected deposit amount in base units

    if (userDepositChain === "bitcoin" && expectedAmount) {
      try {
        // Fetch UTXOs for the address to check individual UTXO amounts
        const utxosUrl = `${GLOBAL_CONFIG.esploraUrl}/address/${userDepositAddress}/utxo`;
        const utxosResponse = await fetch(utxosUrl);
        if (utxosResponse.ok) {
          const utxos = await utxosResponse.json();
          const expectedAmountSats = parseInt(expectedAmount);

          // Check if there's at least one UTXO >= expected amount
          const hasValidUtxo = utxos.some((utxo: any) => utxo.value >= expectedAmountSats);

          // Calculate total balance for logging
          const totalBalance = utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);

          console.log(
            `[PARTIAL DEPOSIT] Bitcoin: Expected ${expectedAmountSats} sats, total balance ${totalBalance} sats, has valid UTXO: ${hasValidUtxo}`
          );

          // If there's balance but no single UTXO meets requirement, refund is available
          if (totalBalance > 0 && !hasValidUtxo) {
            console.log(
              `[PARTIAL DEPOSIT] Bitcoin: No single UTXO >= ${expectedAmountSats} sats - refund available`
            );
            isRefundAvailable = true;
            return { isRefundAvailable, shouldMarkAsRefunded, isPartialDeposit: true };
          }
        }
      } catch (error) {
        console.warn(`Error checking Bitcoin UTXOs for partial deposit:`, error);
      }
    } else if (expectedAmount) {
      // EVM partial deposit check
      try {
        const tokenAddress = row.quote?.from_token?.data; // The ERC20 token address
        const chainId =
          userDepositChain === "ethereum" ? 1 : userDepositChain === "base" ? 8453 : 1;

        const response = await fetch(
          `/api/token-balance?wallet=${userDepositAddress}&chainId=${chainId}`
        );
        if (response.ok) {
          const data = await response.json();

          if (data.result?.result && tokenAddress) {
            const token = data.result.result.find(
              (t: any) => t.address?.toLowerCase() === tokenAddress.toLowerCase()
            );
            if (token) {
              const actualBalance = BigInt(token.totalBalance || "0");
              const expectedBalanceBigInt = BigInt(expectedAmount);

              if (actualBalance > 0n && actualBalance < expectedBalanceBigInt) {
                console.log(
                  `[PARTIAL DEPOSIT] EVM: Expected ${expectedAmount}, got ${actualBalance.toString()} - refund available`
                );
                isRefundAvailable = true;
                return { isRefundAvailable, shouldMarkAsRefunded, isPartialDeposit: true };
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Error checking EVM balance for partial deposit:`, error);
      }
    }
  }

  if (row.isRefundAvailable || row.is_refund_available) {
    console.log(
      `[BALANCE CHECK] Swap ${mappedSwap.id}: Server says refund available, checking balance...`
    );
    // Server says refund is available, now check if user has already withdrawn funds
    // by looking up if the deposit address has any balance

    if (userDepositChain === "bitcoin") {
      // Check UTXOs to ensure at least one UTXO >= expected deposit amount
      try {
        const utxosUrl = `${GLOBAL_CONFIG.esploraUrl}/address/${userDepositAddress}/utxo`;
        const utxosResponse = await fetch(utxosUrl);
        if (!utxosResponse.ok) {
          console.warn(`Failed to fetch Bitcoin UTXOs for ${userDepositAddress}`);
          isRefundAvailable = false; // Default to not available if we can't check
        } else {
          const utxos = await utxosResponse.json();
          const expectedAmount = row.quote?.from_amount ? parseInt(row.quote.from_amount) : 0;

          // Calculate total balance for logging
          const totalBalance = utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);

          // Check if there's at least one UTXO >= expected amount
          const hasValidUtxo =
            expectedAmount > 0
              ? utxos.some((utxo: any) => utxo.value >= expectedAmount)
              : totalBalance > 0; // If no expected amount, just check if any balance exists

          console.log(
            `[BALANCE CHECK] Bitcoin UTXOs for ${userDepositAddress}: ${utxos.length} UTXOs, total ${totalBalance} sats, expected ${expectedAmount} sats, has valid UTXO: ${hasValidUtxo}`
          );

          // If there's balance but no valid UTXO (or no balance at all), mark appropriately
          if (totalBalance > 0 && !hasValidUtxo) {
            // Has balance but no single UTXO meets requirement - refund available
            isRefundAvailable = true;
            shouldMarkAsRefunded = false;
            console.log(
              `[BALANCE CHECK] Bitcoin: Has balance but no UTXO >= ${expectedAmount} sats - refund available`
            );
          } else if (totalBalance === 0) {
            // No balance - funds were already withdrawn/refunded
            isRefundAvailable = false;
            shouldMarkAsRefunded = true;
            console.log(`[BALANCE CHECK] Bitcoin: No balance - marking as refunded`);
          } else {
            // Has valid UTXO - swap can proceed, no refund needed
            isRefundAvailable = false;
            shouldMarkAsRefunded = false;
            console.log(
              `[BALANCE CHECK] Bitcoin: Has valid UTXO >= ${expectedAmount} sats - swap can proceed`
            );
          }
        }
      } catch (error) {
        console.warn(`Error checking Bitcoin UTXOs for ${userDepositAddress}:`, error);
        isRefundAvailable = false; // Default to not available if we can't check
      }
    } else {
      // look up if the deposit address has any cbBTC balance using token-balance API
      try {
        const cbBTCAddress = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
        // Use the existing token-balance API to check cbBTC balance
        const chainId = 1;
        const response = await fetch(
          `/api/token-balance?wallet=${userDepositAddress}&chainId=${chainId}`
        );
        if (!response.ok) {
          console.warn(`Failed to fetch EVM balance for ${userDepositAddress}`);
          isRefundAvailable = false; // Default to not available if we can't check
        } else {
          const data = await response.json();

          // Look for cbBTC token in the results
          if (data.result?.result) {
            const cbBTCToken = data.result.result.find(
              (token: any) => token.address?.toLowerCase() === cbBTCAddress.toLowerCase()
            );
            if (cbBTCToken) {
              const balance = BigInt(cbBTCToken.totalBalance || "0");
              const hasBalance = balance > 0n;
              isRefundAvailable = hasBalance;
              shouldMarkAsRefunded = !hasBalance; // No balance means funds were withdrawn
              console.log(
                `[BALANCE CHECK] cbBTC balance for ${userDepositAddress}: ${balance.toString()}, shouldMarkAsRefunded: ${shouldMarkAsRefunded}`
              );
            } else {
              isRefundAvailable = false; // No cbBTC token found
              shouldMarkAsRefunded = true; // No token found means withdrawn
              console.log(
                `[BALANCE CHECK] No cbBTC token found for ${userDepositAddress}, shouldMarkAsRefunded: true`
              );
            }
          } else {
            isRefundAvailable = false; // No tokens found
            shouldMarkAsRefunded = true; // No tokens means withdrawn
          }
        }
      } catch (error) {
        console.warn(`Error checking cbBTC balance for ${userDepositAddress}:`, error);
        isRefundAvailable = false; // Default to not available if we can't check
      }
    }
  }

  return { isRefundAvailable, shouldMarkAsRefunded, isPartialDeposit: false };
}
