/**
 * Helper functions for creating refund requests with EIP-712 signatures
 */

import { type WalletClient } from "viem";
import { keccak256, encodeAbiParameters, parseAbiParameters, hashTypedData } from "viem";
import { RefundPayload, RefundSwapRequest } from "./rfqClient";

/**
 * Create a RefundSwapRequest with EIP-712 signature
 *
 * This manually constructs the EIP-712 hash to match the Rust server's implementation
 * which uses tuple encoding instead of standard struct encoding.
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

  // The Rust server uses NON-STANDARD EIP-712: it encodes domain and message as raw tuples
  // instead of using proper EIP-712 struct hashing. We must match this exactly.

  // Encode domain tuple: (string name, string version, uint256 chainId, address verifyingContract)
  const domainTuple = encodeAbiParameters(parseAbiParameters("string, string, uint256, address"), [
    "Rift OTC",
    "1.0.0",
    BigInt(1),
    "0x4242424242424242424242424242424242424242",
  ]);
  const domainSeparator = keccak256(domainTuple);

  console.log("[REFUND HELPER] Domain tuple:", domainTuple);
  console.log("[REFUND HELPER] Domain separator:", domainSeparator);

  // Encode message tuple: (string swap_id, string refund_recipient, uint256 refund_transaction_fee)
  const messageTuple = encodeAbiParameters(parseAbiParameters("string, string, uint256"), [
    swapId,
    refundRecipient,
    BigInt(refundTransactionFee),
  ]);
  const messageHash = keccak256(messageTuple);

  console.log("[REFUND HELPER] Message tuple:", messageTuple);
  console.log("[REFUND HELPER] Message hash:", messageHash);

  // Create EIP-712 hash: keccak256(0x19 || 0x01 || domainSeparator || messageHash)
  const eip712Data = `0x1901${domainSeparator.slice(2)}${messageHash.slice(2)}` as `0x${string}`;
  const eip712Hash = keccak256(eip712Data);

  console.log("[REFUND HELPER] EIP-712 data:", eip712Data);
  console.log("[REFUND HELPER] EIP-712 hash to sign:", eip712Hash);
  console.log("[REFUND HELPER] Signing with address:", walletClient.account?.address);

  // Use eth_signTypedData_v4 for proper EIP-712 signing
  // This will sign the typed data structure and the wallet will compute the same hash
  const typedData = {
    domain: {
      name: "Rift OTC",
      version: "1.0.0",
      chainId: 1,
      verifyingContract: "0x4242424242424242424242424242424242424242",
    },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      RefundPayload: [
        { name: "swap_id", type: "string" },
        { name: "refund_recipient", type: "string" },
        { name: "refund_transaction_fee", type: "uint256" },
      ],
    },
    primaryType: "RefundPayload",
    message: {
      swap_id: swapId,
      refund_recipient: refundRecipient,
      refund_transaction_fee: refundTransactionFee,
    },
  };

  console.log("[REFUND HELPER] Typed data:", JSON.stringify(typedData, null, 2));

  // Sign using eth_signTypedData_v4
  const signature = await walletClient.request({
    method: "eth_signTypedData_v4",
    params: [walletClient.account!.address, JSON.stringify(typedData)],
  });

  console.log("[REFUND HELPER] eth_signTypedData_v4 signature:", signature);

  // Convert hex signature to byte array (Vec<u8> in Rust)
  const signatureHex = signature.slice(2); // Remove '0x' prefix
  const signatureBytes: number[] = [];
  for (let i = 0; i < signatureHex.length; i += 2) {
    signatureBytes.push(parseInt(signatureHex.substring(i, i + 2), 16));
  }

  console.log("[REFUND HELPER] Signature bytes length:", signatureBytes.length);
  console.log("[REFUND HELPER] First 10 bytes:", signatureBytes.slice(0, 10));

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
