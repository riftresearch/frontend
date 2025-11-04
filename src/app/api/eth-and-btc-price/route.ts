/**
 * ETH and BTC Price API Endpoint
 * Uses AlphaRouter to get on-chain prices by simulating swaps to USDC
 */

import { NextResponse } from "next/server";
import { AlphaRouter, SwapOptionsUniversalRouter, SwapType } from "@uniswap/smart-order-router";
import { CurrencyAmount, Percent, Token, TradeType, ChainId, Ether } from "@uniswap/sdk-core";
import { providers } from "ethers";
import { UniversalRouterVersion } from "@uniswap/universal-router-sdk";

// Token addresses
const WBTC_ADDRESS = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

// Input amounts (1 ETH in wei, 1 WBTC in smallest unit)
const ONE_ETH = "1000000000000000000"; // 10^18
const ONE_WBTC = "100000000"; // 10^8

// Lazy-loaded provider and router
let provider: providers.StaticJsonRpcProvider | providers.WebSocketProvider | null = null;
let alphaRouter: AlphaRouter | null = null;

function getProvider() {
  if (!provider) {
    const RPC_URL = process.env.QUICKNODE_ETHEREUM_URL;
    if (!RPC_URL) {
      throw new Error("QUICKNODE_ETHEREUM_URL environment variable is not set");
    }

    provider = RPC_URL.startsWith("ws")
      ? new providers.WebSocketProvider(RPC_URL, ChainId.MAINNET)
      : new providers.StaticJsonRpcProvider(
          { url: RPC_URL, skipFetchSetup: true },
          ChainId.MAINNET
        );
  }
  return provider;
}

function getAlphaRouter() {
  if (!alphaRouter) {
    alphaRouter = new AlphaRouter({
      chainId: ChainId.MAINNET,
      provider: getProvider(),
    });
  }
  return alphaRouter;
}

export async function GET() {
  try {
    const router = getAlphaRouter();

    // USDC token (output for both swaps)
    const usdc = new Token(ChainId.MAINNET, USDC_ADDRESS, 6, "USDC", "USD Coin");

    // Swap options with 0 slippage (we just want the quote)
    const options: SwapOptionsUniversalRouter = {
      slippageTolerance: new Percent(0, 10_000),
      type: SwapType.UNIVERSAL_ROUTER,
      version: UniversalRouterVersion.V2_0,
    };

    // Get ETH price
    let ethPrice: number | null = null;
    try {
      const ethToken = Ether.onChain(ChainId.MAINNET);
      const ethRoute = await router.route(
        CurrencyAmount.fromRawAmount(ethToken, ONE_ETH),
        usdc,
        TradeType.EXACT_INPUT,
        options
      );

      if (ethRoute && ethRoute.quote) {
        // Convert USDC amount to decimal (6 decimals)
        const usdcAmount = ethRoute.quote.numerator.toString();
        ethPrice = Number(usdcAmount) / 1e6;
        console.log("[ETH Price] Raw USDC:", usdcAmount, "Formatted:", ethPrice);
      } else {
        console.warn("[ETH Price] No route found");
      }
    } catch (error) {
      console.error("[ETH Price] Error:", error);
    }

    // Get BTC price (via WBTC)
    let btcPrice: number | null = null;
    try {
      const wbtc = new Token(ChainId.MAINNET, WBTC_ADDRESS, 8, "WBTC", "Wrapped BTC");
      const wbtcRoute = await router.route(
        CurrencyAmount.fromRawAmount(wbtc, ONE_WBTC),
        usdc,
        TradeType.EXACT_INPUT,
        options
      );

      if (wbtcRoute && wbtcRoute.quote) {
        // Convert USDC amount to decimal (6 decimals)
        const usdcAmount = wbtcRoute.quote.numerator.toString();
        btcPrice = Number(usdcAmount) / 1e6;
        console.log("[BTC Price] Raw USDC:", usdcAmount, "Formatted:", btcPrice);
      } else {
        console.warn("[BTC Price] No route found");
      }
    } catch (error) {
      console.error("[BTC Price] Error:", error);
    }

    // Return prices (null if failed)
    if (ethPrice === null || btcPrice === null) {
      return NextResponse.json(
        {
          error: "price_fetch_failed",
          details: "Could not get quotes from Uniswap",
          ethPrice,
          btcPrice,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ethPrice, btcPrice });
  } catch (error: any) {
    console.error("[Price API] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message ?? "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
