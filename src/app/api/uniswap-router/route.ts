/**
 * Server-side Uniswap Router API
 * Handles quote generation and swap transaction building using AlphaRouter (V2/V3) and V4
 * Uses ethers v5 (required by @uniswap/smart-order-router)
 */

import { NextRequest, NextResponse } from "next/server";
import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from "@uniswap/smart-order-router";
import { CurrencyAmount, Percent, Token, TradeType, ChainId } from "@uniswap/sdk-core";
import { Contract, providers, utils } from "ethers";
import { Actions, PathKey, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { createHash } from "crypto";

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

// V4 Contract Addresses (Mainnet)
const V4_POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90";
const V4_QUOTER = "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203";
const V4_UNIVERSAL_ROUTER = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
const V4_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// Pool configurations (fee tier -> tick spacing)
const POOL_CONFIGS = [
  { fee: 100, tickSpacing: 1 }, // 0.01%
  { fee: 500, tickSpacing: 10 }, // 0.05%
  { fee: 3000, tickSpacing: 60 }, // 0.3%
  { fee: 10000, tickSpacing: 200 }, // 1%
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// V4 Quoter ABI (minimal for quoteExactInputSingle and quoteExactInput)
const V4_QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: "Currency", name: "currency0", type: "address" },
              { internalType: "Currency", name: "currency1", type: "address" },
              { internalType: "uint24", name: "fee", type: "uint24" },
              { internalType: "int24", name: "tickSpacing", type: "int24" },
              { internalType: "contract IHooks", name: "hooks", type: "address" },
            ],
            internalType: "struct PoolKey",
            name: "poolKey",
            type: "tuple",
          },
          { internalType: "bool", name: "zeroForOne", type: "bool" },
          { internalType: "uint128", name: "exactAmount", type: "uint128" },
          { internalType: "bytes", name: "hookData", type: "bytes" },
        ],
        internalType: "struct IV4Quoter.QuoteExactSingleParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "Currency",
            name: "exactCurrency",
            type: "address",
          },
          {
            components: [
              {
                internalType: "Currency",
                name: "intermediateCurrency",
                type: "address",
              },
              { internalType: "uint24", name: "fee", type: "uint24" },
              { internalType: "int24", name: "tickSpacing", type: "int24" },
              { internalType: "contract IHooks", name: "hooks", type: "address" },
              { internalType: "bytes", name: "hookData", type: "bytes" },
            ],
            internalType: "struct PathKey[]",
            name: "path",
            type: "tuple[]",
          },
          {
            internalType: "uint128",
            name: "exactAmount",
            type: "uint128",
          },
        ],
        internalType: "struct IV4Quoter.QuoteExactParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInput",
    outputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

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
  buyAmount: string;
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
  sellAmount: string;
  decimals: number;
  userAddress: string;
  slippageBps: number;
  validFor: number;
}

interface QuoteResult {
  buyAmount: string;
  expiresAt: string;
  route: any;
}

async function getV2V3Quote(params: V2V3QuoteParams): Promise<QuoteResult | null> {
  const { sellToken, sellAmount, decimals, userAddress, slippageBps, validFor } = params;

  try {
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

    // Get route from AlphaRouter
    console.log("[V2/V3] Fetching AlphaRouter quote for", sellToken, "->", "cbBTC");
    const route = await alphaRouter.route(
      CurrencyAmount.fromRawAmount(tokenIn, sellAmount),
      tokenOut,
      TradeType.EXACT_INPUT,
      options
    );

    if (!route || !route.methodParameters) {
      console.log("[V2/V3] No route found");
      return null;
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + validFor * 1000);

    // Extract buy amount (cbBTC output)
    const buyAmount = route.quote.numerator.toString();

    // Build route path string with pool types
    const routePath = route.route
      .map((r: any) => {
        const path = r.tokenPath.map((t: any) => t.address).join(" -> ");
        const poolType = r.protocol || "UNKNOWN";
        return `${path} [${poolType}]`;
      })
      .join(" | ");

    const result = {
      buyAmount,
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
    console.log("[V2/V3] Quote:", buyAmount, "cbBTC (", result.route.quote, ")");
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
  const { sellToken, sellAmount, validFor } = params;

  try {
    const tokenInAddress = sellToken.toUpperCase() === "ETH" ? WETH_ADDRESS : sellToken;

    // If input is already WBTC, try direct WBTC -> cbBTC swap
    if (tokenInAddress.toLowerCase() === WBTC_ADDRESS.toLowerCase()) {
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
          exactAmount: sellAmount,
          hookData: "0x",
        });

        const buyAmount = result.amountOut.toString();
        const expiresAt = new Date(Date.now() + validFor * 1000);

        console.log("[V4] ✓ Direct WBTC -> cbBTC quote:", buyAmount, "cbBTC");

        return {
          buyAmount,
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
            amountIn: sellAmount,
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

    // Multi-hop: tokenIn -> WBTC -> cbBTC
    // Try different fee tiers for first hop (tokenIn -> WBTC)
    // Always use 0.01% for second hop (WBTC -> cbBTC, the only pool that exists)

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
          exactAmount: sellAmount,
        });

        const buyAmount = result.amountOut.toString();

        if (BigInt(buyAmount) > bestAmount) {
          bestAmount = BigInt(buyAmount);
          bestQuote = {
            buyAmount,
            metadata: {
              currencyIn: tokenInAddress,
              path,
              amountIn: sellAmount,
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
    console.log("[V4] Building V4 swap transaction to", receiver);

    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();

    const deadline = Math.floor(Date.now() / 1000) + validFor;

    // Calculate minimum output with slippage
    const amountOut = BigInt(metadata.amountOutMinimum || "0");
    const slippageMultiplier = BigInt(10_000 - slippageBps);
    const amountOutMinimum = ((amountOut * slippageMultiplier) / BigInt(10_000)).toString();

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
      v4Planner.addAction(Actions.SETTLE_ALL, [metadata.poolKey.currency0, metadata.amountIn]);
      v4Planner.addAction(Actions.TAKE_ALL, [metadata.poolKey.currency1, amountOutMinimum]);
    } else if (metadata.path && metadata.currencyIn) {
      // Multi-hop swap
      const swapConfig = {
        currencyIn: metadata.currencyIn,
        path: metadata.path,
        amountIn: metadata.amountIn,
        amountOutMinimum,
      };

      v4Planner.addAction(Actions.SWAP_EXACT_IN, [swapConfig]);
      v4Planner.addAction(Actions.SETTLE_ALL, [metadata.currencyIn, metadata.amountIn]);

      // Get final output currency from path
      const finalCurrency = metadata.path[metadata.path.length - 1].intermediateCurrency;
      v4Planner.addAction(Actions.TAKE_ALL, [finalCurrency, amountOutMinimum]);
    } else {
      throw new Error("Invalid V4 metadata: missing poolKey or path");
    }

    const encodedActions = v4Planner.finalize();
    routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

    // Encode the execute call for Universal Router
    // execute(bytes commands, bytes[] inputs, uint256 deadline)
    const universalRouterInterface = new utils.Interface([
      "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
    ]);

    const calldata = universalRouterInterface.encodeFunctionData("execute", [
      routePlanner.commands,
      routePlanner.inputs,
      deadline,
    ]);

    // Determine if we need to send ETH value
    const isNativeEth = sellToken.toUpperCase() === "ETH";
    const value = isNativeEth ? metadata.amountIn : "0";

    const expiresAt = new Date(Date.now() + validFor * 1000);

    console.log("[V4] Swap built successfully. CallData length:", calldata.length);

    return {
      calldata,
      value,
      to: V4_UNIVERSAL_ROUTER,
      buyAmount: amountOutMinimum,
      expiresAt: expiresAt.toISOString(),
      route: {
        type: "v4",
        deadline: deadline.toString(),
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
    const decimalsParam = searchParams.get("decimals");
    const userAddress = searchParams.get("userAddress");
    const slippageBps = parseInt(searchParams.get("slippageBps") || String(DEFAULT_SLIPPAGE_BPS));
    const validFor = parseInt(searchParams.get("validFor") || String(DEFAULT_VALID_FOR_SECONDS));
    const router = searchParams.get("router"); // "v3", "v4", or null (both)

    // Validate inputs
    if (!sellToken || !sellAmount || !decimalsParam || !userAddress) {
      return NextResponse.json(
        { error: "Missing required parameters: sellToken, sellAmount, decimals, userAddress" },
        { status: 400 }
      );
    }

    const decimals = parseInt(decimalsParam);

    const quoteParams: V2V3QuoteParams = {
      sellToken,
      sellAmount,
      decimals,
      userAddress,
      slippageBps,
      validFor,
    };

    // Fetch quotes based on router parameter
    console.log("\n========================================");
    if (router === "v3") {
      console.log("Fetching quotes from V2/V3 only...");
    } else if (router === "v4") {
      console.log("Fetching quotes from V4 only...");
    } else {
      console.log("Fetching quotes from V2/V3 and V4...");
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
      const v2v3Amount = BigInt(v2v3Result.buyAmount);
      const v4Amount = BigInt(v4Result.buyAmount);

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

    // Cache the winning quote
    const cacheKey = generateCacheKey(sellToken, sellAmount, userAddress);
    quoteCache.set(cacheKey, {
      routerType: winner,
      buyAmount: winningQuote.buyAmount,
      expiresAt: new Date(winningQuote.expiresAt),
      route: winningQuote.route,
      v4Metadata,
    });

    console.log("========================================\n");

    return NextResponse.json({
      routerType: winner,
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

      // Update amountOutMinimum with the cached buyAmount
      cachedQuote.v4Metadata.amountOutMinimum = cachedQuote.buyAmount;

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
