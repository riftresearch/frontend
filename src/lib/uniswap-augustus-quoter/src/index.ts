// Export all types
export * from './types';
export * from './abis';
export * from './quoter';
export * from './encoder';

import { PublicClient, Address } from 'viem';
import {
  quoteExactInputSingle,
  quoteExactOutputSingle,
  quoteExactInput,
  quoteExactOutput,
  getBestQuote,
  getBestMultiHopQuote,
  createPoolKey,
  createPath,
} from './quoter';
import {
  SingleQuoteResult,
  QuoteResult,
  FeeTier,
  PathKey,
} from './types';

// Main interface for easy usage
export interface QuoterOptions {
  feeTiers?: FeeTier[];
  routingTokens?: Address[];
  slippagePercent?: number;
}

export interface QuoteAndBestRouteResult {
  quote: SingleQuoteResult | QuoteResult;
  feeTier?: FeeTier;
  path?: PathKey[];
  route: 'direct' | 'multi-hop';
}

/**
 * Main function to get the best quote for a token swap
 * Tries both direct swaps and multi-hop routes
 */
export async function getQuoteAndBestRoute(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  options: QuoterOptions = {}
): Promise<QuoteAndBestRouteResult | null> {
  const {
    feeTiers = [500, 3000, 10000],
    routingTokens = [],
    slippagePercent = 0.5
  } = options;

  try {
    // Try direct swap first
    const directQuote = await getBestQuote(client, tokenIn, tokenOut, amountIn, feeTiers);
    
    let bestResult: QuoteAndBestRouteResult | null = null;
    
    if (directQuote) {
      bestResult = {
        quote: directQuote.quote,
        feeTier: directQuote.feeTier,
        route: 'direct',
      };
    }

    // Try multi-hop routes if routing tokens are provided
    if (routingTokens.length > 0) {
      const multiHopQuote = await getBestMultiHopQuote(
        client, 
        tokenIn, 
        tokenOut, 
        amountIn, 
        routingTokens, 
        feeTiers
      );

      if (multiHopQuote && bestResult) {
        const multiHopAmount = multiHopQuote.amount;
        const directAmount = 'amountOut' in bestResult.quote ? bestResult.quote.amountOut : bestResult.quote.amount;

        if (multiHopAmount > directAmount) {
          bestResult = {
            quote: multiHopQuote,
            path: multiHopQuote.path,
            route: 'multi-hop',
          };
        }
      }
    }

    return bestResult;
  } catch (error) {
    console.error('Failed to get quote:', error);
    return null;
  }
}

/**
 * Simple function to get a quote for exact input on a specific pool
 */
export async function getSimpleQuote(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  feeTier: FeeTier,
  amountIn: bigint
): Promise<SingleQuoteResult | null> {
  return quoteExactInputSingle(client, tokenIn, tokenOut, feeTier, amountIn);
}

/**
 * Get quote for exact output (when you know how much you want to receive)
 */
export async function getQuoteForExactOutput(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  feeTier: FeeTier,
  amountOut: bigint
): Promise<SingleQuoteResult | null> {
  return quoteExactOutputSingle(client, tokenIn, tokenOut, feeTier, amountOut);
}

/**
 * Get quotes for multiple fee tiers and return all results
 */
export async function getAllQuotes(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  feeTiers: FeeTier[] = [500, 3000, 10000]
): Promise<Array<{ feeTier: FeeTier; quote: SingleQuoteResult | null }>> {
  const results = await Promise.allSettled(
    feeTiers.map(async (feeTier) => {
      const quote = await quoteExactInputSingle(client, tokenIn, tokenOut, feeTier, amountIn);
      return { feeTier, quote };
    })
  );

  return results.map((result, index) => ({
    feeTier: feeTiers[index],
    quote: result.status === 'fulfilled' ? result.value.quote : null,
  }));
}

/**
 * Create a custom multi-hop path and get a quote
 */
export async function getCustomPathQuote(
  client: PublicClient,
  tokenIn: Address,
  intermediateTokens: Address[],
  feeTiers: FeeTier[],
  amountIn: bigint
): Promise<QuoteResult | null> {
  try {
    const path = createPath(intermediateTokens, feeTiers);
    return await quoteExactInput(client, tokenIn, path, amountIn);
  } catch (error) {
    console.error('Failed to get custom path quote:', error);
    return null;
  }
}

// Backward compatibility functions
export interface QuoteAndCalldataResult {
  quote: SingleQuoteResult | QuoteResult;
  calldata: string;
  minAmountOut: bigint;
}

export interface QuoteAndCalldataOptions {
  slippagePercent?: number;
  v3FeeTiers?: number[];
  intermediateTokens?: Address[];
}

/**
 * Backward compatibility function for existing hooks
 * Note: This is a simplified version that focuses on quoting
 * Actual swap execution would need proper router integration
 */
export async function getQuoteAndCalldata(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  beneficiary: Address,
  options?: QuoteAndCalldataOptions
): Promise<QuoteAndCalldataResult | null> {
  const result = await getQuoteAndBestRoute(client, tokenIn, tokenOut, amountIn, {
    feeTiers: options?.v3FeeTiers as FeeTier[],
    routingTokens: options?.intermediateTokens,
    slippagePercent: options?.slippagePercent,
  });

  if (!result) return null;

  const slippagePercent = options?.slippagePercent ?? 300; // Default 3%
  const slippageMultiplier = 10000 - slippagePercent;
  const amountOut = 'amountOut' in result.quote ? result.quote.amountOut : result.quote.amount;
  const minAmountOut = (amountOut * BigInt(slippageMultiplier)) / 10000n;

  // Placeholder calldata - in a real implementation, this would be proper swap router calldata
  const calldata = "0x";

  return {
    quote: result.quote,
    calldata,
    minAmountOut,
  };
}

// Utility exports for advanced usage
export {
  createPoolKey,
  createPath,
  quoteExactInputSingle,
  quoteExactOutputSingle,
  quoteExactInput,
  quoteExactOutput,
  getBestQuote,
  getBestMultiHopQuote,
};