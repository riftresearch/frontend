import { Address, Hex } from "viem";

// Uniswap V4 Core Types
export interface Currency {
  address: Address;
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface QuoteExactSingleParams {
  poolKey: PoolKey;
  zeroForOne: boolean;
  exactAmount: bigint;
  hookData: Hex;
}

export interface PathKey {
  intermediateCurrency: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface QuoteExactParams {
  currencyIn: Address;
  path: PathKey[];
  exactAmount: bigint;
}

// Quote Results
export interface SingleQuoteResult {
  amountOut: bigint;
  gasEstimate: bigint;
}

export interface QuoteResult {
  amount: bigint;
  gasEstimate: bigint;
  path?: PathKey[];
}

// Contract Addresses (Ethereum Mainnet)
export const CONTRACTS = {
  POOL_MANAGER: "0x000000000004444c5dc75cB358380D2e3dE08A90" as const,
  V4_QUOTER: "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203" as const,
  STATE_VIEW: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227" as const,
  PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const,
} as const;

// Common fee tiers and tick spacings
export const FEE_TIERS = {
  500: 10,    // 0.05% fee, tick spacing 10
  3000: 60,   // 0.3% fee, tick spacing 60  
  10000: 200, // 1% fee, tick spacing 200
} as const;

// Utility type for fee tier keys
export type FeeTier = keyof typeof FEE_TIERS;