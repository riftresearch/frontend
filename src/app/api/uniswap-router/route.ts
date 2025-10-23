/**
 * Server-side Uniswap Router API
 * Handles quote generation and swap transaction building using AlphaRouter (V2/V3) and V4
 * Uses ethers v5 (required by @uniswap/smart-order-router)
 */

import { NextRequest, NextResponse } from "next/server";
import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from "@uniswap/smart-order-router";
import { CurrencyAmount, Percent, Token, TradeType, ChainId } from "@uniswap/sdk-core";
import { Contract, providers } from "ethers";
import { Actions, PathKey, V4Planner } from "@uniswap/v4-sdk";
import { createHash } from "crypto";
import {
  V4_QUOTER_ABI,
  V4_QUOTER,
  V4_POOL_MANAGER,
  V4_UNIVERSAL_ROUTER,
  V4_PERMIT2,
} from "./v4ABIs";

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
// Quote Cache
// ============================================================================

interface CachedQuote {
  routerType: "v4" | "v2v3";
  sellAmount?: string;
  buyAmount?: string;
  expiresAt: Date;
  route: any;
  v4Metadata?: V4QuoteMetadata;
}

interface V4QuoteMetadata {
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
  amountIn: string;
  amountOutMinimum: string;
}

const quoteCache = new Map<string, CachedQuote>();

// Cache TTL: 2 minutes
const CACHE_TTL_MS = 120_000;

function generateCacheKey(sellToken: string, sellAmount: string, userAddress: string): string {
  return createHash("sha256").update(`${sellToken}-${sellAmount}-${userAddress}`).digest("hex");
}

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of quoteCache.entries()) {
    if (value.expiresAt.getTime() < now) {
      quoteCache.delete(key);
    }
  }
}

// Clean cache every minute
setInterval(cleanExpiredCache, 60_000);

// ============================================================================
// Helper Functions
// ============================================================================

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
// V2/V3 Quote Logic (AlphaRouter)
// ============================================================================

interface V2V3QuoteParams {
  sellToken: string;
  sellAmount?: string;
  buyAmount?: string;
  decimals: number;
  userAddress: string;
  slippageBps: number;
  validFor: number;
}

interface QuoteResult {
  sellAmount?: string;
  buyAmount?: string;
  expiresAt: string;
  route: any;
}

async function getV2V3Quote(params: V2V3QuoteParams): Promise<QuoteResult | null> {
  const { sellToken, sellAmount, buyAmount, decimals, userAddress, slippageBps, validFor } = params;

  try {
    // Validate exactly one of sellAmount or buyAmount is provided
    if (!sellAmount && !buyAmount) {
      throw new Error("Must provide either sellAmount or buyAmount");
    }
    if (sellAmount && buyAmount) {
      throw new Error("Cannot provide both sellAmount and buyAmount");
    }

    // Determine trade type and amount
    const isExactOutput = !!buyAmount;
    const amount = (buyAmount || sellAmount) as string;

    // Determine token address
    const tokenInAddress = sellToken.toUpperCase() === "ETH" ? WETH_ADDRESS : sellToken;
    const tokenIn = new Token(ChainId.MAINNET, tokenInAddress, decimals);
    const tokenOut = new Token(ChainId.MAINNET, CBBTC_ADDRESS, 8, "cbBTC", "Coinbase Wrapped BTC");

    // Configure swap options
    const options: SwapOptionsSwapRouter02 = {
      recipient: userAddress,
      slippageTolerance: new Percent(slippageBps, 10_000),
      deadline: Math.floor(Date.now() / 1000 + validFor),
      type: SwapType.SWAP_ROUTER_02,
    };

    // Determine trade type
    const routeTradeType = isExactOutput ? TradeType.EXACT_OUTPUT : TradeType.EXACT_INPUT;

    // Get route from AlphaRouter
    console.log(
      `[V2/V3] Fetching AlphaRouter quote for ${sellToken} -> cbBTC (${isExactOutput ? "exact output" : "exact input"})`
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
      console.log("[V2/V3] No route found");
      return null;
    }

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

    // For exact output: return sellAmount (required input)
    // For exact input: return buyAmount (expected output)
    const result: QuoteResult = isExactOutput
      ? {
          sellAmount: quotedAmount,
          expiresAt: expiresAt.toISOString(),
          route: {
            quote: route.quote.toExact(),
            quoteGasAdjusted: route.quoteGasAdjusted.toExact(),
            estimatedGasUsed: route.estimatedGasUsed.toString(),
            gasPriceWei: route.gasPriceWei.toString(),
            routePath,
          },
        }
      : {
          buyAmount: quotedAmount,
          expiresAt: expiresAt.toISOString(),
          route: {
            quote: route.quote.toExact(),
            quoteGasAdjusted: route.quoteGasAdjusted.toExact(),
            estimatedGasUsed: route.estimatedGasUsed.toString(),
            gasPriceWei: route.gasPriceWei.toString(),
            routePath,
          },
        };

    console.log("[V2/V3] Route:", routePath);
    if (isExactOutput) {
      console.log("[V2/V3] Quote:", quotedAmount, "input required (", result.route.quote, ")");
    } else {
      console.log("[V2/V3] Quote:", quotedAmount, "cbBTC output (", result.route.quote, ")");
    }
    return result;
  } catch (error) {
    console.error("[V2/V3] Quote error:", error);
    return null;
  }
}

// ============================================================================
// V4 Quote Logic
// ============================================================================

interface V4QuoteResult extends QuoteResult {
  v4Metadata: V4QuoteMetadata;
}

async function getV4Quote(params: V2V3QuoteParams): Promise<V4QuoteResult | null> {
  const { sellToken, sellAmount, buyAmount, validFor } = params;

  try {
    // Validate exactly one of sellAmount or buyAmount is provided
    if (!sellAmount && !buyAmount) {
      throw new Error("Must provide either sellAmount or buyAmount");
    }
    if (sellAmount && buyAmount) {
      throw new Error("Cannot provide both sellAmount and buyAmount");
    }

    // Determine trade type and amount
    const isExactOutput = !!buyAmount;
    const amount = (buyAmount || sellAmount) as string;

    const tokenInAddress = sellToken.toUpperCase() === "ETH" ? WETH_ADDRESS : sellToken;

    // If input is already WBTC, try direct WBTC -> cbBTC swap
    if (tokenInAddress.toLowerCase() === WBTC_ADDRESS.toLowerCase()) {
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

          console.log(
            "[V4] ✓ Direct WBTC -> cbBTC (exact output) quote:",
            inputAmountNeeded,
            "WBTC needed"
          );

          return {
            sellAmount: inputAmountNeeded, // For exact output, return the required input
            expiresAt: expiresAt.toISOString(),
            route: {
              type: "single-hop",
              path: "WBTC -> cbBTC",
              poolFee: 100,
              tickSpacing: 1,
              gasEstimate: result.gasEstimate?.toString() || "0",
            },
            v4Metadata: {
              poolKey,
              isFirstToken: sortedPair.isFirstToken,
              amountIn: "0", // Will be set by swap builder
              amountOutMinimum: amount, // This is the exact amount we want
            },
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

          console.log("[V4] ✓ Direct WBTC -> cbBTC quote:", outputAmount, "cbBTC");

          return {
            buyAmount: outputAmount,
            expiresAt: expiresAt.toISOString(),
            route: {
              type: "single-hop",
              path: "WBTC -> cbBTC",
              poolFee: 100,
              tickSpacing: 1,
              gasEstimate: result.gasEstimate?.toString() || "0",
            },
            v4Metadata: {
              poolKey,
              isFirstToken: sortedPair.isFirstToken,
              amountIn: amount,
              amountOutMinimum: "0",
            },
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
        metadata: V4QuoteMetadata;
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
              intermediateCurrency: tokenInAddress, // The input token
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
              metadata: {
                currencyIn: tokenInAddress,
                path,
                amountIn: "0", // Will be set by swap builder
                amountOutMinimum: amount, // This is the exact amount we want
              },
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

      // Log the best route in the requested format
      const feePercent = (bestQuote.firstHopFee / 10000).toFixed(2);
      console.log(
        `[V4] Trying (exact output): ${sellToken} -(${feePercent}%)-> WBTC -(0.01%)-> cbBTC`
      );
      console.log("[V4] Best quote (exact output):", bestQuote.inputAmount, "input needed");

      return {
        sellAmount: bestQuote.inputAmount, // For exact output, return the required input
        expiresAt: expiresAt.toISOString(),
        route: bestQuote.route,
        v4Metadata: bestQuote.metadata,
      };
    } else {
      // Exact input: maximize output amount
      let bestQuote: {
        buyAmount: string;
        metadata: V4QuoteMetadata;
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
            exactCurrency: tokenInAddress,
            path: path,
            exactAmount: amount,
          });

          const outputAmount = result.amountOut.toString();

          if (BigInt(outputAmount) > bestAmount) {
            bestAmount = BigInt(outputAmount);
            bestQuote = {
              buyAmount: outputAmount,
              metadata: {
                currencyIn: tokenInAddress,
                path,
                amountIn: amount,
                amountOutMinimum: "0",
              },
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

      // Log the best route in the requested format
      const feePercent = (bestQuote.firstHopFee / 10000).toFixed(2);
      console.log(`[V4] Trying: ${sellToken} -(${feePercent}%)-> WBTC -(0.01%)-> cbBTC`);
      console.log("[V4] Best quote:", bestQuote.buyAmount, "cbBTC");

      return {
        buyAmount: bestQuote.buyAmount,
        expiresAt: expiresAt.toISOString(),
        route: bestQuote.route,
        v4Metadata: bestQuote.metadata,
      };
    }
  } catch (error) {
    console.error("[V4] Quote error:", error);
    return null;
  }
}

// ============================================================================
// V2/V3 Swap Building (AlphaRouter)
// ============================================================================

interface V2V3SwapParams {
  sellToken: string;
  sellAmount: string;
  decimals: number;
  userAddress: string;
  receiver: string;
  slippageBps: number;
  validFor: number;
}

interface SwapResult {
  calldata: string;
  value: string;
  to: string;
  buyAmount: string;
  expiresAt: string;
  route: any;
}

async function buildV2V3Swap(params: V2V3SwapParams): Promise<SwapResult | null> {
  const { sellToken, sellAmount, decimals, receiver, slippageBps, validFor } = params;

  try {
    const tokenInAddress = sellToken.toUpperCase() === "ETH" ? WETH_ADDRESS : sellToken;
    const tokenIn = new Token(ChainId.MAINNET, tokenInAddress, decimals);
    const tokenOut = new Token(ChainId.MAINNET, CBBTC_ADDRESS, 8, "cbBTC", "Coinbase Wrapped BTC");

    // Configure swap options with the receiver as recipient
    const options: SwapOptionsSwapRouter02 = {
      recipient: receiver,
      slippageTolerance: new Percent(slippageBps, 10_000),
      deadline: Math.floor(Date.now() / 1000 + validFor),
      type: SwapType.SWAP_ROUTER_02,
    };

    console.log("[V2/V3] Building swap transaction for", sellToken, "->", "cbBTC", "to", receiver);
    const route = await alphaRouter.route(
      CurrencyAmount.fromRawAmount(tokenIn, sellAmount),
      tokenOut,
      TradeType.EXACT_INPUT,
      options
    );

    if (!route || !route.methodParameters) {
      console.error("[V2/V3] No route found");
      return null;
    }

    const expiresAt = new Date(Date.now() + validFor * 1000);

    console.log(
      "[V2/V3] Swap built successfully. Output:",
      route.quote.numerator.toString(),
      "cbBTC"
    );

    return {
      calldata: route.methodParameters.calldata,
      value: route.methodParameters.value,
      to: route.methodParameters.to,
      buyAmount: route.quote.numerator.toString(),
      expiresAt: expiresAt.toISOString(),
      route: {
        quote: route.quote.toExact(),
        quoteGasAdjusted: route.quoteGasAdjusted.toExact(),
        estimatedGasUsed: route.estimatedGasUsed.toString(),
        gasPriceWei: route.gasPriceWei.toString(),
      },
    };
  } catch (error) {
    console.error("[V2/V3] Swap build error:", error);
    return null;
  }
}

// ============================================================================
// V4 Swap Building
// ============================================================================

interface V4SwapParams {
  metadata: V4QuoteMetadata;
  receiver: string;
  slippageBps: number;
  validFor: number;
  sellToken: string;
}

async function buildV4Swap(params: V4SwapParams): Promise<SwapResult | null> {
  const { metadata, receiver, slippageBps, validFor, sellToken } = params;

  try {
    console.log("[V4] Building V4 swap actions for client-side execution");

    const v4Planner = new V4Planner();
    const deadline = Math.floor(Date.now() / 1000) + validFor;

    // Calculate minimum output with slippage
    const amountOut = BigInt(metadata.amountOutMinimum || "0");
    const slippageMultiplier = BigInt(10_000 - slippageBps);
    const amountOutMinimum = ((amountOut * slippageMultiplier) / BigInt(10_000)).toString();

    // Determine input/output currencies
    let inputCurrency: string;
    let outputCurrency: string;

    if (metadata.poolKey) {
      // Single-hop swap
      const swapConfig = {
        poolKey: metadata.poolKey,
        zeroForOne: metadata.isFirstToken!,
        amountIn: metadata.amountIn,
        amountOutMinimum,
        hookData: "0x",
      };

      v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);

      inputCurrency = metadata.isFirstToken
        ? metadata.poolKey.currency0
        : metadata.poolKey.currency1;
      outputCurrency = metadata.isFirstToken
        ? metadata.poolKey.currency1
        : metadata.poolKey.currency0;

      // SETTLE: Pull input tokens from sender via Permit2
      v4Planner.addAction(Actions.SETTLE_ALL, [inputCurrency, metadata.amountIn]);

      // TAKE: Take output tokens directly to receiver
      v4Planner.addAction(Actions.TAKE_PORTION, [outputCurrency, receiver, 10000]);
    } else if (metadata.path && metadata.currencyIn) {
      // Multi-hop swap
      const swapConfig = {
        currencyIn: metadata.currencyIn,
        path: metadata.path,
        amountIn: metadata.amountIn,
        amountOutMinimum,
      };

      v4Planner.addAction(Actions.SWAP_EXACT_IN, [swapConfig]);

      inputCurrency = metadata.currencyIn;
      outputCurrency = metadata.path[metadata.path.length - 1].intermediateCurrency;

      // SETTLE: Pull input tokens from sender via Permit2
      v4Planner.addAction(Actions.SETTLE_ALL, [inputCurrency, metadata.amountIn]);

      // TAKE: Take output tokens directly to receiver
      v4Planner.addAction(Actions.TAKE_PORTION, [outputCurrency, receiver, 10000]);
    } else {
      throw new Error("Invalid V4 metadata: missing poolKey or path");
    }

    const encodedActions = v4Planner.finalize();
    const expiresAt = new Date(Date.now() + validFor * 1000);

    // Determine if we need to send ETH value
    const isNativeEth = sellToken.toUpperCase() === "ETH";
    const value = isNativeEth ? metadata.amountIn : "0";

    console.log("[V4] Swap actions encoded successfully");

    // Return the encoded actions and metadata for client-side Universal Router execution
    return {
      calldata: encodedActions, // This is the encoded V4 actions, not the full UR calldata
      value,
      to: V4_UNIVERSAL_ROUTER,
      buyAmount: amountOutMinimum,
      expiresAt: expiresAt.toISOString(),
      route: {
        type: "v4",
        deadline: deadline.toString(),
        inputToken: inputCurrency,
        outputToken: outputCurrency,
      },
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
    const sellAmount = searchParams.get("sellAmount");
    const buyAmount = searchParams.get("buyAmount");
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

    // Validate exactly one of sellAmount or buyAmount is provided
    if (!sellAmount && !buyAmount) {
      return NextResponse.json(
        {
          error: "Must provide either sellAmount (for exact input) or buyAmount (for exact output)",
        },
        { status: 400 }
      );
    }

    if (sellAmount && buyAmount) {
      return NextResponse.json(
        { error: "Cannot provide both sellAmount and buyAmount - use only one" },
        { status: 400 }
      );
    }

    const decimals = parseInt(decimalsParam);
    const isExactOutput = !!buyAmount;

    const quoteParams: V2V3QuoteParams = {
      sellToken,
      sellAmount: sellAmount || undefined,
      buyAmount: buyAmount || undefined,
      decimals,
      userAddress,
      slippageBps,
      validFor,
    };

    // Fetch quotes based on router parameter and trade type
    console.log("\n========================================");
    if (router === "v3") {
      console.log(
        `Fetching quotes from V2/V3 only (${isExactOutput ? "exact output" : "exact input"})...`
      );
    } else if (router === "v4") {
      console.log(
        `Fetching quotes from V4 only (${isExactOutput ? "exact output" : "exact input"})...`
      );
    } else {
      console.log(
        `Fetching quotes from V2/V3 and V4 (${isExactOutput ? "exact output" : "exact input"})...`
      );
    }
    console.log("========================================");

    const [v2v3Result, v4Result] = await Promise.all([
      router === "v4" ? Promise.resolve(null) : getV2V3Quote(quoteParams),
      router === "v3" ? Promise.resolve(null) : getV4Quote(quoteParams),
    ]);

    // Compare and select winner
    let winner: "v2v3" | "v4";
    let winningQuote: QuoteResult;
    let v4Metadata: V4QuoteMetadata | undefined;

    if (!v2v3Result && !v4Result) {
      return NextResponse.json({ error: "No routes found for this swap" }, { status: 404 });
    }

    if (!v4Result || !v2v3Result) {
      // Only one router returned a quote
      if (v4Result) {
        winner = "v4";
        winningQuote = v4Result;
        v4Metadata = v4Result.v4Metadata;
        console.log("\n✓ V4 wins (only available route)");
      } else {
        winner = "v2v3";
        winningQuote = v2v3Result!;
        console.log("\n✓ V2/V3 wins (only available route)");
      }
    } else {
      // Both returned quotes, compare amounts
      if (isExactOutput) {
        // For exact output, compare sellAmount (lower input is better)
        const v2v3Amount = BigInt(v2v3Result.sellAmount!);
        const v4Amount = BigInt(v4Result.sellAmount!);

        if (v4Amount < v2v3Amount) {
          winner = "v4";
          winningQuote = v4Result;
          v4Metadata = v4Result.v4Metadata;
          const improvement = Number(((v2v3Amount - v4Amount) * BigInt(10000)) / v2v3Amount) / 100;
          console.log(`\n✓ V4 wins! (-${improvement.toFixed(2)}% less input required)`);
          console.log(`  V4: ${v4Amount.toString()} input required`);
          console.log(`  V2/V3: ${v2v3Amount.toString()} input required`);
        } else {
          winner = "v2v3";
          winningQuote = v2v3Result;
          const improvement = Number(((v4Amount - v2v3Amount) * BigInt(10000)) / v4Amount) / 100;
          console.log(`\n✓ V2/V3 wins! (-${improvement.toFixed(2)}% less input required)`);
          console.log(`  V2/V3: ${v2v3Amount.toString()} input required`);
          console.log(`  V4: ${v4Amount.toString()} input required`);
        }
      } else {
        // For exact input, compare buyAmount (higher output is better)
        const v2v3Amount = BigInt(v2v3Result.buyAmount!);
        const v4Amount = BigInt(v4Result.buyAmount!);

        if (v4Amount > v2v3Amount) {
          winner = "v4";
          winningQuote = v4Result;
          v4Metadata = v4Result.v4Metadata;
          const improvement = Number(((v4Amount - v2v3Amount) * BigInt(10000)) / v2v3Amount) / 100;
          console.log(`\n✓ V4 wins! (+${improvement.toFixed(2)}% better)`);
          console.log(`  V4: ${v4Amount.toString()} cbBTC`);
          console.log(`  V2/V3: ${v2v3Amount.toString()} cbBTC`);
        } else {
          winner = "v2v3";
          winningQuote = v2v3Result;
          const improvement = Number(((v2v3Amount - v4Amount) * BigInt(10000)) / v4Amount) / 100;
          console.log(`\n✓ V2/V3 wins! (+${improvement.toFixed(2)}% better)`);
          console.log(`  V2/V3: ${v2v3Amount.toString()} cbBTC`);
          console.log(`  V4: ${v4Amount.toString()} cbBTC`);
        }
      }
    }

    // Cache the winning quote
    const amount = (buyAmount || sellAmount) as string;
    const cacheKey = generateCacheKey(sellToken, amount, userAddress);
    quoteCache.set(cacheKey, {
      routerType: winner,
      sellAmount: winningQuote.sellAmount,
      buyAmount: winningQuote.buyAmount,
      expiresAt: new Date(winningQuote.expiresAt),
      route: winningQuote.route,
      v4Metadata,
    });

    console.log("========================================\n");

    return NextResponse.json({
      routerType: winner,
      sellAmount: winningQuote.sellAmount,
      buyAmount: winningQuote.buyAmount,
      expiresAt: winningQuote.expiresAt,
      route: winningQuote.route,
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
      sellAmount,
      decimals,
      userAddress,
      receiver,
      slippageBps,
      validFor,
    } = body;

    // Validate inputs
    if (!routerType || !sellToken || !sellAmount || decimals === undefined || !userAddress) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: routerType, sellToken, sellAmount, decimals, userAddress",
        },
        { status: 400 }
      );
    }

    const finalSlippageBps = slippageBps || DEFAULT_SLIPPAGE_BPS;
    const finalValidFor = validFor || DEFAULT_VALID_FOR_SECONDS;
    const recipient = receiver || userAddress;

    // Look up cached quote
    const cacheKey = generateCacheKey(sellToken, sellAmount, userAddress);
    const cachedQuote = quoteCache.get(cacheKey);

    if (!cachedQuote) {
      return NextResponse.json(
        {
          error: "Quote expired or not found. Please fetch a new quote via GET request.",
        },
        { status: 404 }
      );
    }

    // Verify the routerType matches
    if (cachedQuote.routerType !== routerType) {
      return NextResponse.json(
        {
          error: `Router type mismatch. Cached quote is for ${cachedQuote.routerType}, but ${routerType} was requested.`,
        },
        { status: 400 }
      );
    }

    console.log("\n========================================");
    console.log(`Building ${routerType.toUpperCase()} swap transaction`);
    console.log("Receiver:", recipient);
    console.log("========================================");

    let swapResult: SwapResult | null = null;

    if (routerType === "v4") {
      if (!cachedQuote.v4Metadata) {
        return NextResponse.json({ error: "V4 metadata not found in cache" }, { status: 500 });
      }

      // Update amountOutMinimum with the cached buyAmount if available
      if (cachedQuote.buyAmount) {
        cachedQuote.v4Metadata.amountOutMinimum = cachedQuote.buyAmount;
      }

      swapResult = await buildV4Swap({
        metadata: cachedQuote.v4Metadata,
        receiver: recipient,
        slippageBps: finalSlippageBps,
        validFor: finalValidFor,
        sellToken,
      });
    } else {
      swapResult = await buildV2V3Swap({
        sellToken,
        sellAmount,
        decimals,
        userAddress,
        receiver: recipient,
        slippageBps: finalSlippageBps,
        validFor: finalValidFor,
      });
    }

    if (!swapResult) {
      return NextResponse.json({ error: "Failed to build swap transaction" }, { status: 500 });
    }

    console.log("========================================\n");

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
