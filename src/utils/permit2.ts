/**
 * Permit2 utilities for Uniswap V4 swaps
 * Handles EIP-712 signatures and Universal Router command encoding
 */

import { Address, encodeAbiParameters, parseAbiParameters, concat, toHex } from "viem";

// ============================================================================
// Constants
// ============================================================================

export const PERMIT2_ADDRESS: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const UNIVERSAL_ROUTER_ADDRESS: Address = "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af";

// Universal Router Command Types (v2)
export const CMD_PERMIT2_PERMIT = "0x0a" as const; // Single permit
export const CMD_V4_SWAP = "0x10" as const;
export const CMD_SWEEP = "0x04" as const;

// ============================================================================
// EIP-712 Domain and Types for Permit2
// ============================================================================

export const PERMIT2_DOMAIN = {
  name: "Permit2",
  chainId: 1, // Ethereum Mainnet
  verifyingContract: PERMIT2_ADDRESS,
} as const;

export const PERMIT2_TYPES = {
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
} as const;

// ============================================================================
// Types
// ============================================================================

export interface PermitDetails {
  token: Address;
  amount: bigint;
  expiration: number;
  nonce: number;
}

export interface PermitSingle {
  details: PermitDetails;
  spender: Address;
  sigDeadline: bigint;
}

export interface Permit2SignatureParams {
  token: Address;
  amount: bigint;
  nonce: bigint;
  expiration: number; // Unix seconds
  sigDeadlineSeconds?: number; // How long the signature is valid (default: 600s / 10min)
}

export interface UniversalRouterCommandsInput {
  permitSignature?: `0x${string}`;
  permitBatch?: {
    token: Address;
    amount: bigint;
    expiration: number;
    nonce: number;
  }[];
  v4SwapEncodedActions: `0x${string}`;
  sweepToken?: Address;
  sweepRecipient?: Address;
  deadline: number;
}

// ============================================================================
// Permit2 Signature Building
// ============================================================================

/**
 * Build EIP-712 typed data for Permit2 PermitSingle signature
 */
export function buildPermit2TypedData(params: Permit2SignatureParams) {
  const sigDeadline = params.sigDeadlineSeconds
    ? BigInt(Math.floor(Date.now() / 1000) + params.sigDeadlineSeconds)
    : BigInt(Math.floor(Date.now() / 1000) + 600); // Default 10 minutes

  const values: PermitSingle = {
    details: {
      token: params.token,
      amount: params.amount,
      expiration: params.expiration,
      nonce: Number(params.nonce),
    },
    spender: UNIVERSAL_ROUTER_ADDRESS,
    sigDeadline,
  };

  return {
    domain: PERMIT2_DOMAIN,
    types: PERMIT2_TYPES,
    primaryType: "PermitSingle" as const,
    message: values,
  };
}

/**
 * Encode PERMIT2_PERMIT input for Universal Router (single permit)
 */
export function encodePermit2PermitInput(
  token: Address,
  amount: bigint,
  expiration: number,
  nonce: number,
  signature: `0x${string}`,
  sigDeadline: bigint
): `0x${string}` {
  // PermitSingle structure:
  // struct PermitSingle {
  //   PermitDetails details;
  //   address spender;
  //   uint256 sigDeadline;
  // }
  return encodeAbiParameters(
    parseAbiParameters(
      "((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline), bytes signature"
    ),
    [
      {
        details: {
          token,
          amount,
          expiration: expiration as any as number,
          nonce: nonce as any as number,
        },
        spender: UNIVERSAL_ROUTER_ADDRESS,
        sigDeadline,
      },
      signature,
    ]
  );
}

/**
 * Encode SWEEP input for Universal Router
 */
export function encodeSweepInput(
  token: Address,
  recipient: Address,
  minAmount: bigint
): `0x${string}` {
  // SWEEP expects: (address token, address recipient, uint256 amountMin)
  return encodeAbiParameters(
    parseAbiParameters("address token, address recipient, uint256 amountMin"),
    [token, recipient, minAmount]
  );
}

/**
 * Encode V4_SWAP input for Universal Router
 * Takes the encoded V4 actions from the server
 */
export function encodeV4SwapInput(encodedActions: `0x${string}`): `0x${string}` {
  // V4_SWAP expects: bytes actions
  return encodeAbiParameters(parseAbiParameters("bytes actions"), [encodedActions]);
}

// ============================================================================
// Universal Router Command Encoding
// ============================================================================

/**
 * Encode Universal Router commands and inputs for V4 swap with Permit2
 *
 * For ERC20 tokens:
 *   1. PERMIT2_PERMIT - Grant allowance via signature
 *   2. V4_SWAP - Execute the swap (SETTLE actions pull tokens via Permit2)
 *   3. SWEEP - Clean up any remaining output tokens
 *
 * For ETH:
 *   1. V4_SWAP - Execute the swap (ETH sent via msg.value)
 */
export function encodeUniversalRouterCommands(input: UniversalRouterCommandsInput): {
  commands: `0x${string}`;
  inputs: `0x${string}`[];
  deadline: number;
} {
  const commands: string[] = [];
  const inputs: `0x${string}`[] = [];

  // If we have a permit signature, this is an ERC20 swap requiring Permit2 flow
  if (input.permitSignature && input.permitBatch) {
    const permitDetails = input.permitBatch[0]; // We only support single token for now
    const sigDeadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes

    // Command 1: PERMIT2_PERMIT (single permit, not batch)
    commands.push(CMD_PERMIT2_PERMIT);
    inputs.push(
      encodePermit2PermitInput(
        permitDetails.token,
        permitDetails.amount,
        permitDetails.expiration,
        permitDetails.nonce,
        input.permitSignature,
        sigDeadline
      )
    );
  }

  // Command 2 (or 1 for ETH): V4_SWAP
  commands.push(CMD_V4_SWAP);
  inputs.push(encodeV4SwapInput(input.v4SwapEncodedActions));

  // Command 3: SWEEP output token to recipient
  if (input.sweepToken && input.sweepRecipient) {
    commands.push(CMD_SWEEP);
    inputs.push(encodeSweepInput(input.sweepToken, input.sweepRecipient, BigInt(0)));
  }

  // Combine all command bytes into a single hex string
  const commandsHex = concat(commands.map((c) => c as `0x${string}`));

  return {
    commands: commandsHex,
    inputs,
    deadline: input.deadline,
  };
}

/**
 * Calculate the infinite approval amount for Permit2
 * Using uint160 max to avoid future approval transactions
 */
export function getInfinitePermit2Amount(): bigint {
  // uint160 max = 2^160 - 1
  return BigInt("0xffffffffffffffffffffffffffffffffffffffff");
}

/**
 * Calculate Permit2 expiration timestamp
 * Default: 30 days from now
 */
export function getDefaultPermit2Expiration(daysFromNow = 30): number {
  const now = Math.floor(Date.now() / 1000);
  return now + daysFromNow * 24 * 60 * 60;
}
