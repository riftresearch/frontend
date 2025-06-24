import { PublicClient, Address } from "viem";
import {
  PoolKey,
  QuoteExactSingleParams,
  QuoteExactParams,
  PathKey,
  SingleQuoteResult,
  QuoteResult,
  CONTRACTS,
  FEE_TIERS,
  FeeTier,
} from "./types";
import { V4_QUOTER_ABI } from "./abis";

/**
 * Create a PoolKey for a token pair
 */
export function createPoolKey(
  token0: Address,
  token1: Address,
  feeTier: FeeTier,
  hooks: Address = "0x0000000000000000000000000000000000000000"
): PoolKey {
  // Ensure token0 < token1 for consistent ordering
  const [currency0, currency1] = token0.toLowerCase() < token1.toLowerCase() 
    ? [token0, token1] 
    : [token1, token0];

  return {
    currency0,
    currency1,
    fee: feeTier,
    tickSpacing: FEE_TIERS[feeTier],
    hooks,
  };
}

/**
 * Determine swap direction (zeroForOne)
 */
export function getSwapDirection(
  tokenIn: Address,
  tokenOut: Address,
  poolKey: PoolKey
): boolean {
  // If tokenIn is currency0, we're swapping 0 for 1 (zeroForOne = true)
  return tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
}

/**
 * Quote exact input for a single pool
 */
export async function quoteExactInputSingle(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  feeTier: FeeTier,
  amountIn: bigint,
  hooks?: Address
): Promise<SingleQuoteResult | null> {
  try {
    const poolKey = createPoolKey(tokenIn, tokenOut, feeTier, hooks);
    const zeroForOne = getSwapDirection(tokenIn, tokenOut, poolKey);

    const params: QuoteExactSingleParams = {
      poolKey,
      zeroForOne,
      exactAmount: amountIn,
      hookData: "0x",
    };

    const { result } = await client.simulateContract({
      address: CONTRACTS.V4_QUOTER,
      abi: V4_QUOTER_ABI as any,
      functionName: "quoteExactInputSingle",
      args: [params],
    });

    return {
      amountOut: result[0],
      gasEstimate: result[1],
    };
  } catch (error) {
    console.error(`Quote failed for ${tokenIn} -> ${tokenOut} (fee: ${feeTier}):`, error);
    return null;
  }
}

/**
 * Quote exact output for a single pool
 */
export async function quoteExactOutputSingle(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  feeTier: FeeTier,
  amountOut: bigint,
  hooks?: Address
): Promise<SingleQuoteResult | null> {
  try {
    const poolKey = createPoolKey(tokenIn, tokenOut, feeTier, hooks);
    const zeroForOne = getSwapDirection(tokenIn, tokenOut, poolKey);

    const params: QuoteExactSingleParams = {
      poolKey,
      zeroForOne,
      exactAmount: amountOut,
      hookData: "0x",
    };

    const { result } = await client.simulateContract({
      address: CONTRACTS.V4_QUOTER,
      abi: V4_QUOTER_ABI as any,
      functionName: "quoteExactOutputSingle",
      args: [params],
    });

    return {
      amountOut: result[0], // This is actually amountIn for exact output
      gasEstimate: result[1],
    };
  } catch (error) {
    console.error(`Quote failed for ${tokenIn} -> ${tokenOut} (fee: ${feeTier}):`, error);
    return null;
  }
}

/**
 * Quote exact input through multiple pools
 */
export async function quoteExactInput(
  client: PublicClient,
  tokenIn: Address,
  path: PathKey[],
  amountIn: bigint
): Promise<QuoteResult | null> {
  try {
    const params: QuoteExactParams = {
      currencyIn: tokenIn,
      path,
      exactAmount: amountIn,
    };

    const { result } = await client.simulateContract({
      address: CONTRACTS.V4_QUOTER,
      abi: V4_QUOTER_ABI as any,
      functionName: "quoteExactInput",
      args: [params],
    });

    return {
      amount: result[0],
      gasEstimate: result[1],
      path,
    };
  } catch (error) {
    console.error("Multi-hop quote failed:", error);
    return null;
  }
}

/**
 * Quote exact output through multiple pools
 */
export async function quoteExactOutput(
  client: PublicClient,
  tokenIn: Address,
  path: PathKey[],
  amountOut: bigint
): Promise<QuoteResult | null> {
  try {
    const params: QuoteExactParams = {
      currencyIn: tokenIn,
      path,
      exactAmount: amountOut,
    };

    const { result } = await client.simulateContract({
      address: CONTRACTS.V4_QUOTER,
      abi: V4_QUOTER_ABI as any,
      functionName: "quoteExactOutput",
      args: [params],
    });

    return {
      amount: result[0], // This is actually amountIn for exact output
      gasEstimate: result[1],
      path,
    };
  } catch (error) {
    console.error("Multi-hop quote failed:", error);
    return null;
  }
}

/**
 * Find the best quote across multiple fee tiers
 */
export async function getBestQuote(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  feeTiers: FeeTier[] = [500, 3000, 10000]
): Promise<{ quote: SingleQuoteResult; feeTier: FeeTier } | null> {
  const quotes = await Promise.allSettled(
    feeTiers.map(async (feeTier) => {
      const quote = await quoteExactInputSingle(client, tokenIn, tokenOut, feeTier, amountIn);
      return quote ? { quote, feeTier } : null;
    })
  );

  let bestQuote: { quote: SingleQuoteResult; feeTier: FeeTier } | null = null;

  for (const result of quotes) {
    if (result.status === "fulfilled" && result.value) {
      if (!bestQuote || result.value.quote.amountOut > bestQuote.quote.amountOut) {
        bestQuote = result.value;
      }
    }
  }

  return bestQuote;
}

/**
 * Create a path for multi-hop swaps
 */
export function createPath(
  intermediateTokens: Address[],
  feeTiers: FeeTier[],
  hooks?: Address[]
): PathKey[] {
  if (intermediateTokens.length !== feeTiers.length) {
    throw new Error("intermediateTokens and feeTiers arrays must have the same length");
  }

  return intermediateTokens.map((token, index) => ({
    intermediateCurrency: token,
    fee: feeTiers[index],
    tickSpacing: FEE_TIERS[feeTiers[index]],
    hooks: hooks?.[index] || "0x0000000000000000000000000000000000000000",
  }));
}

/**
 * Get a quote for a multi-hop swap through common routing tokens
 */
export async function getBestMultiHopQuote(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  routingTokens: Address[],
  feeTiers: FeeTier[] = [500, 3000, 10000]
): Promise<QuoteResult | null> {
  // Try direct swaps first
  const directQuote = await getBestQuote(client, tokenIn, tokenOut, amountIn, feeTiers);
  let bestQuote: QuoteResult | null = directQuote ? {
    amount: directQuote.quote.amountOut,
    gasEstimate: directQuote.quote.gasEstimate,
  } : null;

  // Try routes through each routing token
  for (const routingToken of routingTokens) {
    for (const feeTier1 of feeTiers) {
      for (const feeTier2 of feeTiers) {
        try {
          const path = createPath([routingToken], [feeTier1, feeTier2]);
          const quote = await quoteExactInput(client, tokenIn, path, amountIn);
          
          if (quote && (!bestQuote || quote.amount > bestQuote.amount)) {
            bestQuote = quote;
          }
        } catch (error) {
          // Continue trying other routes
          continue;
        }
      }
    }
  }

  return bestQuote;
}