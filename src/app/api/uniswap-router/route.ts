/**
 * Server-side Uniswap Router API
 * Handles quote generation and swap transaction building using AlphaRouter (V2/V3) and V4
 * Uses ethers v5 (required by @uniswap/smart-order-router)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapOptionsUniversalRouter,
  SwapOptions,
  SwapType,
} from "@uniswap/smart-order-router";
import {
  CurrencyAmount,
  Percent,
  Token,
  TradeType,
  ChainId,
  NativeCurrency,
  Ether,
} from "@uniswap/sdk-core";
import { Contract, providers } from "ethers";
import { Actions, PathKey, V4Planner } from "@uniswap/v4-sdk";
import { V4_QUOTER_ABI, V4_QUOTER, V4_POOL_MANAGER, UNIVERSAL_ROUTER_ADDRESS } from "./v4ABIs";
import { RoutePlanner, CommandType, UniversalRouterVersion } from "@uniswap/universal-router-sdk";
import { encodeFunctionData, encodeAbiParameters, parseSignature } from "viem";

// ============================================================================
// Constants
// ============================================================================

const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const WBTC_ADDRESS = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";

const DEFAULT_SLIPPAGE_BPS = 10;
const DEFAULT_VALID_FOR_SECONDS = 120;
const RPC_URL = process.env.QUICKNODE_ETHEREUM_URL || "https://eth0.riftnodes.com";

// Pool configurations (fee tier -> tick spacing)
const POOL_CONFIGS = [
  { fee: 100, tickSpacing: 1 }, // 0.01%
  { fee: 500, tickSpacing: 10 }, // 0.05%
  { fee: 3000, tickSpacing: 60 }, // 0.3%
  { fee: 10000, tickSpacing: 200 }, // 1%
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Initialize provider and router (reused across requests)
const provider = new providers.StaticJsonRpcProvider(
  { url: RPC_URL, skipFetchSetup: true },
  ChainId.MAINNET
);

const alphaRouter = new AlphaRouter({
  chainId: ChainId.MAINNET,
  provider,
});

const v4QuoterContract = new Contract(V4_QUOTER, V4_QUOTER_ABI, provider);

// ============================================================================
// Quote Cache - REMOVED (now using client-side management)
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply slippage tolerance to an amount
 * @param amount - The amount to apply slippage to
 * @param slippageBps - Slippage tolerance in basis points
 * @param isAmountIn - True if this is an input amount (increases it), false if output (decreases it)
 * @returns The amount with slippage applied
 */
function applySlippage(amount: string, slippageBps: number, isAmountIn: boolean): string {
  const amountBigInt = BigInt(amount);
  const slippageMultiplier = isAmountIn
    ? BigInt(10_000 + slippageBps) // Increase amountIn for exact output protection
    : BigInt(10_000 - slippageBps); // Decrease amountOut for exact input protection
  return ((amountBigInt * slippageMultiplier) / BigInt(10_000)).toString();
}

function sortTokens(
  token0: string,
  token1: string
): { firstToken: string; secondToken: string; isFirstToken: boolean } {
  const token0Lower = token0.toLowerCase();
  const token1Lower = token1.toLowerCase();
  if (token0Lower < token1Lower) {
    return { firstToken: token0, secondToken: token1, isFirstToken: true };
  } else {
    return { firstToken: token1, secondToken: token0, isFirstToken: false };
  }
}

// ============================================================================
// V3 Quote Logic (AlphaRouter)
// ============================================================================

interface QuoteParams {
  sellToken: string;
  amountIn?: string;
  amountOut?: string;
  decimals: number;
  userAddress: string;
  slippageBps: number;
  validFor: number;
}

interface MethodParameters {
  calldata: string;
  value: string;
  to: string;
}

interface QuoteResult {
  amountIn: string;
  amountOut: string;
  expiresAt: string;
  route: any;
  // V4-specific fields (optional, only present for V4 quotes)
  poolKey?: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  path?: PathKey[];
  currencyIn?: string;
  isFirstToken?: boolean;
  isExactOutput?: boolean;
  methodParameters?: MethodParameters;
}

async function getV3Quote(params: QuoteParams): Promise<QuoteResult | null> {
  const { sellToken, amountIn, amountOut, decimals, userAddress, slippageBps, validFor } = params;

  try {
    // Validate exactly one of amountIn or amountOut is provided
    if (!amountIn && !amountOut) {
      throw new Error("Must provide either amountIn or amountOut");
    }
    if (amountIn && amountOut) {
      throw new Error("Cannot provide both amountIn and amountOut");
    }

    // Determine trade type and amount
    const isExactOutput = !!amountOut;
    const amount = (amountOut || amountIn) as string;

    // Determine token address
    const isNativeEth = sellToken === "0x0000000000000000000000000000000000000000";
    const tokenIn = isNativeEth
      ? Ether.onChain(ChainId.MAINNET)
      : new Token(ChainId.MAINNET, sellToken, decimals);
    const tokenOut = new Token(ChainId.MAINNET, CBBTC_ADDRESS, 8, "cbBTC", "Coinbase Wrapped BTC");

    // Configure swap options
    const options: SwapOptionsUniversalRouter = {
      // recipient: userAddress,
      // inputTokenPermit:
      slippageTolerance: new Percent(slippageBps, 10_000),
      type: SwapType.UNIVERSAL_ROUTER,
      version: UniversalRouterVersion.V2_0,
    };

    // Determine trade type
    const routeTradeType = isExactOutput ? TradeType.EXACT_OUTPUT : TradeType.EXACT_INPUT;

    // Get route from AlphaRouter
    console.log(
      `[V3] Fetching AlphaRouter quote for ${sellToken} -> cbBTC (${isExactOutput ? "exact output" : "exact input"})`
    );

    const route = isExactOutput
      ? await alphaRouter.route(
          CurrencyAmount.fromRawAmount(tokenOut, amount),
          tokenIn,
          routeTradeType,
          options
        )
      : await alphaRouter.route(
          CurrencyAmount.fromRawAmount(tokenIn, amount),
          tokenOut,
          routeTradeType,
          options
        );

    if (!route || !route.methodParameters) {
      console.log("[V3] No route found");
      return null;
    }

    // console.log("path", route.trade.swaps[0].route.path);
    // console.log("pools", route.trade.swaps[0].route.pools);
    // Calculate expiration
    const expiresAt = new Date(Date.now() + validFor * 1000);

    // Extract the quoted amount
    const quotedAmount = route.quote.numerator.toString();

    // Build route path string with pool types
    const routePath = route.route
      .map((r: any) => {
        const path = r.tokenPath.map((t: any) => t.address).join(" -> ");
        const poolType = r.protocol || "UNKNOWN";
        return `${path} [${poolType}]`;
      })
      .join(" | ");

    // Apply slippage and return both amountIn and amountOut
    let finalAmountIn: string;
    let finalAmountOut: string;

    if (isExactOutput) {
      // For exact output: amountOut is known, amountIn needs slippage protection (increase it)
      finalAmountOut = amount;
      finalAmountIn = applySlippage(quotedAmount, slippageBps, true);
    } else {
      // For exact input: amountIn is known, amountOut needs slippage protection (decrease it)
      finalAmountIn = amount;
      finalAmountOut = applySlippage(quotedAmount, slippageBps, false);
    }

    const result: QuoteResult = {
      amountIn: finalAmountIn,
      amountOut: finalAmountOut,
      expiresAt: expiresAt.toISOString(),
      methodParameters: route.methodParameters,
      route: {
        quote: route.quote.toExact(),
        quoteGasAdjusted: route.quoteGasAdjusted.toExact(),
        estimatedGasUsed: route.estimatedGasUsed.toString(),
        gasPriceWei: route.gasPriceWei.toString(),
        routePath,
      },
      isExactOutput: isExactOutput,
    };

    console.log("[V3] Route:", routePath);
    if (isExactOutput) {
      console.log("[V3] Quote:", quotedAmount, "input required (", result.route.quote, ")");
      console.log("[V3] With slippage:", finalAmountIn, "max input");
    } else {
      console.log("[V3] Quote:", quotedAmount, "cbBTC output (", result.route.quote, ")");
      console.log("[V3] With slippage:", finalAmountOut, "min output");
    }
    return result;
  } catch (error) {
    console.error("[V3] Quote error:", error);
    return null;
  }
}

// ============================================================================
// V4 Quote Logic
// ============================================================================

async function getV4Quote(params: QuoteParams): Promise<QuoteResult | null> {
  const { sellToken, amountIn, amountOut, slippageBps, validFor } = params;

  try {
    // Validate exactly one of amountIn or amountOut is provided
    if (!amountIn && !amountOut) {
      throw new Error("Must provide either amountIn or amountOut");
    }
    if (amountIn && amountOut) {
      throw new Error("Cannot provide both amountIn and amountOut");
    }

    // Determine trade type and amount
    const isExactOutput = !!amountOut;
    const amount = (amountOut || amountIn) as string;

    // If input is already WBTC, try direct WBTC -> cbBTC swap
    if (sellToken.toLowerCase() === WBTC_ADDRESS.toLowerCase()) {
      if (isExactOutput) {
        console.log("[V4] Input is WBTC, trying direct WBTC -> cbBTC (exact output) at 0.01%");
        try {
          const sortedPair = sortTokens(WBTC_ADDRESS, CBBTC_ADDRESS);
          const poolKey = {
            currency0: sortedPair.firstToken,
            currency1: sortedPair.secondToken,
            fee: 100, // 0.01%
            tickSpacing: 1,
            hooks: ZERO_ADDRESS,
          };

          const result = await v4QuoterContract.callStatic.quoteExactOutputSingle({
            poolKey: poolKey,
            zeroForOne: sortedPair.isFirstToken,
            exactAmount: amount, // This is the exact output amount (cbBTC)
            hookData: "0x",
          });

          const inputAmountNeeded = result.amountIn.toString();
          const expiresAt = new Date(Date.now() + validFor * 1000);

          // Apply slippage: increase input amount for protection
          const finalAmountIn = applySlippage(inputAmountNeeded, slippageBps, true);
          const finalAmountOut = amount; // Exact output amount

          console.log(
            "[V4] ✓ Direct WBTC -> cbBTC (exact output) quote:",
            inputAmountNeeded,
            "WBTC needed"
          );
          console.log("[V4] With slippage:", finalAmountIn, "max input");

          return {
            amountIn: finalAmountIn,
            amountOut: finalAmountOut,
            expiresAt: expiresAt.toISOString(),
            route: {
              type: "single-hop",
              path: "WBTC -> cbBTC",
              poolFee: 100,
              tickSpacing: 1,
              gasEstimate: result.gasEstimate?.toString() || "0",
            },
            // V4 fields
            poolKey,
            isFirstToken: sortedPair.isFirstToken,
            isExactOutput: isExactOutput,
          };
        } catch (error) {
          console.log(
            "[V4] ✗ Direct WBTC -> cbBTC (exact output) failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          return null;
        }
      } else {
        console.log("[V4] Input is WBTC, trying direct WBTC -> cbBTC at 0.01%");
        try {
          const sortedPair = sortTokens(WBTC_ADDRESS, CBBTC_ADDRESS);
          const poolKey = {
            currency0: sortedPair.firstToken,
            currency1: sortedPair.secondToken,
            fee: 100, // 0.01%
            tickSpacing: 1,
            hooks: ZERO_ADDRESS,
          };

          const result = await v4QuoterContract.callStatic.quoteExactInputSingle({
            poolKey: poolKey,
            zeroForOne: sortedPair.isFirstToken,
            exactAmount: amount,
            hookData: "0x",
          });

          const outputAmount = result.amountOut.toString();
          const expiresAt = new Date(Date.now() + validFor * 1000);

          // Apply slippage: decrease output amount for protection
          const finalAmountIn = amount; // Exact input amount
          const finalAmountOut = applySlippage(outputAmount, slippageBps, false);

          console.log("[V4] ✓ Direct WBTC -> cbBTC quote:", outputAmount, "cbBTC");
          console.log("[V4] With slippage:", finalAmountOut, "min output");

          return {
            amountIn: finalAmountIn,
            amountOut: finalAmountOut,
            expiresAt: expiresAt.toISOString(),
            route: {
              type: "single-hop",
              path: "WBTC -> cbBTC",
              poolFee: 100,
              tickSpacing: 1,
              gasEstimate: result.gasEstimate?.toString() || "0",
            },
            // V4 fields
            poolKey,
            isFirstToken: sortedPair.isFirstToken,
            isExactOutput: isExactOutput,
          };
        } catch (error) {
          console.log(
            "[V4] ✗ Direct WBTC -> cbBTC failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          return null;
        }
      }
    }

    // Multi-hop: tokenIn -> WBTC -> cbBTC
    // Try different fee tiers for first hop (tokenIn -> WBTC)
    // Always use 0.01% for second hop (WBTC -> cbBTC, the only pool that exists)

    if (isExactOutput) {
      // Exact output: minimize input amount
      let bestQuote: {
        inputAmount: string;
        currencyIn: string;
        path: PathKey[];
        route: any;
        firstHopFee: number;
      } | null = null;
      let bestAmount = BigInt(2) ** BigInt(256) - BigInt(1); // Start with max value

      for (const config of POOL_CONFIGS) {
        try {
          // Build the two-hop path for exact output
          // For exact output: we start at cbBTC (exactCurrency) and work backwards through WBTC to tokenIn
          // The path only contains intermediate currencies (WBTC), not the final input (tokenIn)
          const path: PathKey[] = [
            {
              intermediateCurrency: sellToken, // The input token
              fee: config.fee,
              tickSpacing: config.tickSpacing,
              hooks: ZERO_ADDRESS,
              hookData: "0x",
            },
            {
              intermediateCurrency: WBTC_ADDRESS,
              fee: 100,
              tickSpacing: 1,
              hooks: ZERO_ADDRESS,
              hookData: "0x",
            },
          ];

          const result = await v4QuoterContract.callStatic.quoteExactOutput({
            exactCurrency: CBBTC_ADDRESS, // The token we want exact amount of
            path: path,
            exactAmount: amount, // The exact output amount we want
          });

          const inputAmount = result.amountIn.toString();

          // For exact output, we want the minimum input amount
          if (BigInt(inputAmount) < bestAmount) {
            bestAmount = BigInt(inputAmount);
            bestQuote = {
              inputAmount,
              currencyIn: sellToken,
              path,
              route: {
                type: "multi-hop",
                path: `${sellToken} -> WBTC -> cbBTC`,
                poolFees: [config.fee, 100],
                tickSpacings: [config.tickSpacing, 1],
                gasEstimate: result.gasEstimate?.toString() || "0",
              },
              firstHopFee: config.fee,
            };
          }
        } catch (error) {
          // Silently try next config
        }
      }

      if (!bestQuote) {
        console.log("[V4] No valid routes found (exact output)");
        return null;
      }

      const expiresAt = new Date(Date.now() + validFor * 1000);

      // Apply slippage: increase input amount for protection
      const finalAmountIn = applySlippage(bestQuote.inputAmount, slippageBps, true);
      const finalAmountOut = amount; // Exact output amount

      // Log the best route in the requested format
      const feePercent = (bestQuote.firstHopFee / 10000).toFixed(2);
      console.log(
        `[V4] Trying (exact output): ${sellToken} -(${feePercent}%)-> WBTC -(0.01%)-> cbBTC`
      );
      console.log("[V4] Best quote (exact output):", bestQuote.inputAmount, "input needed");
      console.log("[V4] With slippage:", finalAmountIn, "max input");

      return {
        amountIn: finalAmountIn,
        amountOut: finalAmountOut,
        expiresAt: expiresAt.toISOString(),
        route: bestQuote.route,
        // V4 fields
        currencyIn: bestQuote.currencyIn,
        path: bestQuote.path,
        isExactOutput: isExactOutput,
      };
    } else {
      // Exact input: maximize output amount
      let bestQuote: {
        outputAmount: string;
        currencyIn: string;
        path: PathKey[];
        route: any;
        firstHopFee: number;
      } | null = null;
      let bestAmount = BigInt(0);

      for (const config of POOL_CONFIGS) {
        try {
          // Build the two-hop path
          // Key insight: intermediateCurrency is the OUTPUT of each hop
          const path: PathKey[] = [
            {
              intermediateCurrency: WBTC_ADDRESS, // Output of first hop
              fee: config.fee,
              tickSpacing: config.tickSpacing,
              hooks: ZERO_ADDRESS,
              hookData: "0x",
            },
            {
              intermediateCurrency: CBBTC_ADDRESS, // Output of second hop
              fee: 100, // 0.01% - the only WBTC/cbBTC pool on V4
              tickSpacing: 1,
              hooks: ZERO_ADDRESS,
              hookData: "0x",
            },
          ];

          const result = await v4QuoterContract.callStatic.quoteExactInput({
            exactCurrency: sellToken,
            path: path,
            exactAmount: amount,
          });

          const outputAmount = result.amountOut.toString();

          if (BigInt(outputAmount) > bestAmount) {
            bestAmount = BigInt(outputAmount);
            bestQuote = {
              outputAmount: outputAmount,
              currencyIn: sellToken,
              path,
              route: {
                type: "multi-hop",
                path: `${sellToken} -> WBTC -> cbBTC`,
                poolFees: [config.fee, 100],
                tickSpacings: [config.tickSpacing, 1],
                gasEstimate: result.gasEstimate?.toString() || "0",
              },
              firstHopFee: config.fee,
            };
          }
        } catch (error) {
          // Silently try next config
        }
      }

      if (!bestQuote) {
        console.log("[V4] No valid routes found");
        return null;
      }

      const expiresAt = new Date(Date.now() + validFor * 1000);

      // Apply slippage: decrease output amount for protection
      const finalAmountIn = amount; // Exact input amount
      const finalAmountOut = applySlippage(bestQuote.outputAmount, slippageBps, false);

      // Log the best route in the requested format
      const feePercent = (bestQuote.firstHopFee / 10000).toFixed(2);
      // console.log(`[V4] Trying: ${sellToken} -(${feePercent}%)-> WBTC -(0.01%)-> cbBTC`);
      console.log("[V4] Route:", bestQuote.route.path);
      console.log("[V4] Best quote:", bestQuote.outputAmount, "cbBTC");
      console.log("[V4] With slippage:", finalAmountOut, "min output");

      return {
        amountIn: finalAmountIn,
        amountOut: finalAmountOut,
        expiresAt: expiresAt.toISOString(),
        route: bestQuote.route,
        // V4 fields
        currencyIn: bestQuote.currencyIn,
        path: bestQuote.path,
        isExactOutput: isExactOutput,
      };
    }
  } catch (error) {
    console.error("[V4] Quote error:", error);
    return null;
  }
}

// ============================================================================
// V3 Swap Building (AlphaRouter)
// ============================================================================

interface V3SwapParams {
  sellToken: string;
  amountIn?: string;
  amountOut?: string;
  decimals: number;
  userAddress: string;
  receiver: string;
  slippageBps: number;
  validFor: number;
  signature?: string;
  permit?: any;
  isExactOutput?: boolean;
}

interface ExecuteSwapParams {
  calldata: string;
  value: string;
  to: string;
}

async function buildV3Swap(params: V3SwapParams): Promise<ExecuteSwapParams | null> {
  const {
    sellToken,
    amountIn,
    amountOut,
    decimals,
    receiver,
    userAddress,
    slippageBps,
    validFor,
    signature,
    permit,
    isExactOutput,
  } = params;

  try {
    // Set tokenIn and tokenOut
    const isNativeEth = sellToken === "0x0000000000000000000000000000000000000000";
    const tokenIn = isNativeEth
      ? Ether.onChain(ChainId.MAINNET)
      : new Token(ChainId.MAINNET, sellToken, decimals);
    const tokenOut = new Token(ChainId.MAINNET, CBBTC_ADDRESS, 8, "cbBTC", "Coinbase Wrapped BTC");

    // Configure swap options with the receiver as recipient
    const options: SwapOptionsUniversalRouter = {
      recipient: receiver,
      slippageTolerance: new Percent(slippageBps, 10_000),
      type: SwapType.UNIVERSAL_ROUTER,
      version: UniversalRouterVersion.V2_0,
    };

    // console.log("signature", signature);
    // console.log("permit", permit);
    // Add inputTokenPermit if signature and permit are provided
    if (signature && permit) {
      const { v, r, s } = parseSignature(signature as any);
      options.inputTokenPermit = {
        signature: signature,
        details: permit.details,
        spender: permit.spender,
        sigDeadline: permit.sigDeadline,
      };
    }
    console.log("options", options);

    console.log("[V3] Building swap transaction for", sellToken, "->", "cbBTC", "to", receiver);

    // Call AlphaRouter based on trade type
    const route = isExactOutput
      ? await alphaRouter.route(
          CurrencyAmount.fromRawAmount(tokenOut, amountOut!),
          tokenIn,
          TradeType.EXACT_OUTPUT,
          options
        )
      : await alphaRouter.route(
          CurrencyAmount.fromRawAmount(tokenIn, amountIn!),
          tokenOut,
          TradeType.EXACT_INPUT,
          options
        );

    if (!route || !route.methodParameters) {
      console.error("[V3] No route found");
      return null;
    }

    console.log("[V3] Swap built successfully. Output:", route.quote.numerator.toString(), "cbBTC");

    return {
      calldata: route.methodParameters.calldata,
      value: route.methodParameters.value,
      to: route.methodParameters.to,
    };
  } catch (error) {
    console.error("[V3] Swap build error:", error);
    return null;
  }
}

// ============================================================================
// V4 Swap Building
// ============================================================================

interface V4SwapParams {
  poolKey?: any;
  path?: any[];
  currencyIn?: string;
  isFirstToken?: boolean;
  amountIn: string;
  amountOut: string;
  receiver: string;
  validFor: number;
  sellToken: string;
  permit?: any;
  signature?: string;
  isExactOutput: boolean;
}

async function buildV4Swap(params: V4SwapParams): Promise<ExecuteSwapParams | null> {
  const {
    poolKey,
    path,
    currencyIn,
    isFirstToken,
    amountIn,
    amountOut,
    receiver,
    validFor,
    sellToken,
    permit,
    signature,
    isExactOutput,
  } = params;

  try {
    console.log("[V4] Building V4 swap actions for client-side execution");
    console.log("[V4] Swap type:", isExactOutput ? "EXACT_OUTPUT" : "EXACT_INPUT");

    const v4Planner = new V4Planner();
    const deadline = Math.floor(Date.now() / 1000) + validFor;

    console.log("amountIn", amountIn);
    console.log("amountOut", amountOut);

    // Define currencies once - they're the same regardless of swap type
    const inputCurrency = currencyIn!;
    const outputCurrency = CBBTC_ADDRESS;

    if (poolKey) {
      // Single-hop swap
      if (isExactOutput) {
        // Exact output: user specifies exact output, accepts spending up to amountIn
        const swapConfig = {
          poolKey: poolKey,
          zeroForOne: isFirstToken!,
          amountOut: amountOut,
          amountInMaximum: amountIn,
          hookData: "0x",
        };
        console.log("swapConfig (EXACT_OUT_SINGLE)", swapConfig);
        v4Planner.addAction(Actions.SWAP_EXACT_OUT_SINGLE, [swapConfig]);
      } else {
        // Exact input: user specifies exact input, expects at least amountOut
        const swapConfig = {
          poolKey: poolKey,
          zeroForOne: isFirstToken!,
          amountIn: amountIn,
          amountOutMinimum: amountOut,
          hookData: "0x",
        };
        console.log("swapConfig (EXACT_IN_SINGLE)", swapConfig);
        v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
      }
    } else if (path && currencyIn) {
      // Multi-hop swap
      if (isExactOutput) {
        // Exact output: user specifies exact output, accepts spending up to amountIn
        const swapConfig = {
          currencyOut: outputCurrency,
          path: path,
          amountOut: amountOut,
          amountInMaximum: amountIn,
        };
        console.log("swapConfig (EXACT_OUT)", swapConfig);
        v4Planner.addAction(Actions.SWAP_EXACT_OUT, [swapConfig]);
      } else {
        // Exact input: user specifies exact input, expects at least amountOut
        const swapConfig = {
          currencyIn: currencyIn,
          path: path,
          amountIn: amountIn,
          amountOutMinimum: amountOut,
        };
        console.log("swapConfig (EXACT_IN)", swapConfig);
        v4Planner.addAction(Actions.SWAP_EXACT_IN, [swapConfig]);
      }
    } else {
      throw new Error("Invalid V4 params: missing poolKey or path");
    }

    // SETTLE and TAKE actions are the same regardless of swap type
    // SETTLE: Pull input tokens from sender via Permit2
    v4Planner.addAction(Actions.SETTLE_ALL, [inputCurrency, amountIn]);

    // TAKE: Take output tokens directly to receiver
    v4Planner.addAction(Actions.TAKE_PORTION, [outputCurrency, receiver, 10000]);

    const encodedActions = v4Planner.finalize();
    const expiresAt = new Date(Date.now() + validFor * 1000);

    // Determine if we need to send ETH value
    const isNativeEth = sellToken === "0x0000000000000000000000000000000000000000";
    const value = isNativeEth ? amountIn : "0";

    // Build Universal Router calldata using RoutePlanner
    const routePlanner = new RoutePlanner();

    console.log("permit", permit);
    console.log("signature", signature);
    // Only add Permit2 commands if both permit and signature are provided
    if (permit && signature) {
      routePlanner.addCommand(CommandType.PERMIT2_PERMIT, [permit, signature as `0x${string}`]);
    }

    routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions as `0x${string}`]);

    // Encode the Universal Router execute() function call
    const encodedCalldata = encodeFunctionData({
      abi: [
        {
          inputs: [
            { internalType: "bytes", name: "commands", type: "bytes" },
            { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
          ],
          name: "execute",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
      ],
      functionName: "execute",
      args: [
        routePlanner.commands as `0x${string}`,
        routePlanner.inputs as readonly `0x${string}`[],
        BigInt(deadline),
      ],
    });

    console.log("[V4] Universal Router transaction calldata encoded successfully");

    // Return the full Universal Router transaction data for sendTransaction
    return {
      calldata: encodedCalldata,
      value,
      to: UNIVERSAL_ROUTER_ADDRESS,
    };
  } catch (error) {
    console.error("[V4] Swap build error:", error);
    return null;
  }
}

// ============================================================================
// GET Handler - Quote Comparison
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sellToken = searchParams.get("sellToken");
    const amountIn = searchParams.get("amountIn");
    const amountOut = searchParams.get("amountOut");
    const decimalsParam = searchParams.get("decimals");
    const userAddress = searchParams.get("userAddress");
    const slippageBps = parseInt(searchParams.get("slippageBps") || String(DEFAULT_SLIPPAGE_BPS));
    const validFor = parseInt(searchParams.get("validFor") || String(DEFAULT_VALID_FOR_SECONDS));
    const router = searchParams.get("router"); // "v3", "v4", or null (both)

    // Validate inputs
    if (!sellToken || !decimalsParam || !userAddress) {
      return NextResponse.json(
        { error: "Missing required parameters: sellToken, decimals, userAddress" },
        { status: 400 }
      );
    }

    // Validate exactly one of amountIn or amountOut is provided
    if (!amountIn && !amountOut) {
      return NextResponse.json(
        {
          error: "Must provide either amountIn (for exact input) or amountOut (for exact output)",
        },
        { status: 400 }
      );
    }

    if (amountIn && amountOut) {
      return NextResponse.json(
        { error: "Cannot provide both amountIn and amountOut - use only one" },
        { status: 400 }
      );
    }

    const decimals = parseInt(decimalsParam);
    const isExactOutput = !!amountOut;

    const quoteParams: QuoteParams = {
      sellToken,
      amountIn: amountIn || undefined,
      amountOut: amountOut || undefined,
      decimals,
      userAddress,
      slippageBps,
      validFor,
    };

    // Fetch quotes based on router parameter and trade type
    console.log("\n========================================");
    if (router === "v3") {
      console.log(
        `Fetching quotes from V3 only (${isExactOutput ? "exact output" : "exact input"})...`
      );
    } else if (router === "v4") {
      console.log(
        `Fetching quotes from V4 only (${isExactOutput ? "exact output" : "exact input"})...`
      );
    } else {
      console.log(
        `Fetching quotes from V3 and V4 (${isExactOutput ? "exact output" : "exact input"})...`
      );
    }
    const start = Date.now();
    console.log("========================================");

    const [v3Result, v4Result] = await Promise.all([
      router === "v4" ? Promise.resolve(null) : getV3Quote(quoteParams),
      router === "v3" ? Promise.resolve(null) : getV4Quote(quoteParams),
    ]);

    // Compare and select winner
    let winner: "v3" | "v4";
    let winningQuote: QuoteResult;

    if (!v3Result && !v4Result) {
      return NextResponse.json({ error: "No routes found for this swap" }, { status: 404 });
    }

    if (!v4Result || !v3Result) {
      // Only one router returned a quote
      if (v4Result) {
        winner = "v4";
        winningQuote = v4Result;
        console.log("\n✓ V4 wins (only available route)");
      } else {
        winner = "v3";
        winningQuote = v3Result!;
        console.log("\n✓ V3 wins (only available route)");
      }
    } else {
      // Both returned quotes, compare amounts
      if (isExactOutput) {
        // For exact output, compare amountIn (lower input is better)
        const v3Amount = BigInt(v3Result.amountIn);
        const v4Amount = BigInt(v4Result.amountIn);

        if (v4Amount < v3Amount) {
          winner = "v4";
          winningQuote = v4Result;
          const improvement = Number(((v3Amount - v4Amount) * BigInt(10000)) / v3Amount) / 100;
          console.log(`\n✓ V4 wins! (-${improvement.toFixed(2)}% less input required)`);
          console.log(`  V4: ${v4Amount.toString()} input required`);
          console.log(`  V3: ${v3Amount.toString()} input required`);
        } else {
          winner = "v3";
          winningQuote = v3Result;
          const improvement = Number(((v4Amount - v3Amount) * BigInt(10000)) / v4Amount) / 100;
          console.log(`\n✓ V3 wins! (-${improvement.toFixed(2)}% less input required)`);
          console.log(`  V3: ${v3Amount.toString()} input required`);
          console.log(`  V4: ${v4Amount.toString()} input required`);
        }
      } else {
        // For exact input, compare amountOut (higher output is better)
        const v3Amount = BigInt(v3Result.amountOut);
        const v4Amount = BigInt(v4Result.amountOut);

        if (v4Amount > v3Amount) {
          winner = "v4";
          winningQuote = v4Result;
          const improvement = Number(((v4Amount - v3Amount) * BigInt(10000)) / v3Amount) / 100;
          console.log(`\n✓ V4 wins! (+${improvement.toFixed(2)}% better)`);
          console.log(`  V4: ${v4Amount.toString()} cbBTC`);
          console.log(`  V3: ${v3Amount.toString()} cbBTC`);
        } else {
          winner = "v3";
          winningQuote = v3Result;
          const improvement = Number(((v3Amount - v4Amount) * BigInt(10000)) / v4Amount) / 100;
          console.log(`\n✓ V3 wins! (+${improvement.toFixed(2)}% better)`);
          console.log(`  V3: ${v3Amount.toString()} cbBTC`);
          console.log(`  V4: ${v4Amount.toString()} cbBTC`);
        }
      }
    }

    console.log("========================================\n");
    const end = Date.now();
    console.log(`Time taken: ${end - start}ms`);

    return NextResponse.json({
      routerType: winner,
      amountIn: winningQuote.amountIn,
      amountOut: winningQuote.amountOut,
      expiresAt: winningQuote.expiresAt,
      route: winningQuote.route,
      // V4 fields (if present)
      poolKey: winningQuote.poolKey,
      path: winningQuote.path,
      currencyIn: winningQuote.currencyIn,
      isFirstToken: winningQuote.isFirstToken,
      isExactOutput: winningQuote.isExactOutput,
    });
  } catch (error) {
    console.error("Quote error:", error);
    return NextResponse.json(
      {
        error: "Failed to get quote",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Build Swap Transaction
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      routerType,
      sellToken,
      decimals,
      userAddress,
      receiver,
      slippageBps,
      validFor,
      permit,
      signature,
      // V4 fields
      poolKey,
      path,
      currencyIn,
      isFirstToken,
      amountIn,
      amountOut,
      isExactOutput,
    } = body;

    // Validate inputs
    if (!routerType || !sellToken || !amountIn || decimals === undefined || !userAddress) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: routerType, sellToken, amountIn, decimals, userAddress",
        },
        { status: 400 }
      );
    }

    // Validate V4-specific requirements
    if (routerType === "v4") {
      if (!amountOut) {
        return NextResponse.json({ error: "V4 swaps require amountOut" }, { status: 400 });
      }
    }

    const finalSlippageBps = slippageBps || DEFAULT_SLIPPAGE_BPS;
    const finalValidFor = validFor || DEFAULT_VALID_FOR_SECONDS;
    const recipient = receiver || userAddress;
    const start = Date.now();

    console.log("\n========================================");
    console.log(`Building ${routerType.toUpperCase()} swap transaction`);
    console.log("Receiver:", recipient);
    console.log("========================================");

    let swapResult: ExecuteSwapParams | null = null;

    console.log("router type for swap", routerType);
    if (routerType === "v4") {
      console.log("building v4 swap");
      swapResult = await buildV4Swap({
        poolKey,
        path,
        currencyIn,
        isFirstToken,
        amountIn: amountIn!,
        amountOut: amountOut!,
        receiver: recipient,
        validFor: finalValidFor,
        sellToken,
        permit: permit!,
        signature: signature!,
        isExactOutput: isExactOutput || false,
      });
    } else {
      console.log("building v3 swap");
      swapResult = await buildV3Swap({
        sellToken,
        amountIn,
        amountOut,
        decimals,
        userAddress,
        receiver: recipient,
        slippageBps: finalSlippageBps,
        validFor: finalValidFor,
        signature,
        permit,
        isExactOutput,
      });
    }

    console.log("========================================\n");
    const end = Date.now();
    console.log(`Time taken: ${end - start}ms`);

    if (!swapResult) {
      return NextResponse.json({ error: "Failed to build swap transaction" }, { status: 500 });
    }

    return NextResponse.json(swapResult);
  } catch (error) {
    console.error("Swap build error:", error);
    return NextResponse.json(
      {
        error: "Failed to build swap transaction",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
