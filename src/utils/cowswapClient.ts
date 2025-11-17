/**
 * TypeScript client for CowSwap Protocol
 * Provides typed access to quote and order creation for ERC20 -> cbBTC swaps
 */

import { SupportedChainId, PriceQuality } from "@cowprotocol/cow-sdk";
import { TradingSdk, type QuoteResults, type SwapAdvancedSettings } from "@cowprotocol/sdk-trading";
import { OrderKind } from "@cowprotocol/cow-sdk";
import type { TradeParameters } from "@cowprotocol/sdk-trading";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import type { WalletClient, PublicClient } from "viem";
import { applySlippageExactOutput, applySlippage } from "./swapHelpers";

// Constants
const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DEFAULT_SLIPPAGE_BPS = 5; // 0.05% = 5 basis points
const DEFAULT_VALID_FOR_SECONDS = 180; // 3 minutes

/**
 * CowSwap quote request parameters
 */
export interface CowSwapQuoteRequest {
  /** Token to sell (address or "ETH" for native) */
  sellToken: string;
  /** Amount to buy in base units (exactly one of buyAmount or sellAmount must be set) */
  buyAmount?: string;
  /** Amount to sell in base units (exactly one of buyAmount or sellAmount must be set) */
  sellAmount?: string;
  /** Token decimals for the sell token */
  decimals: number;
  /** Slippage tolerance in basis points (100 bps = 1%) */
  slippageBps?: number;
  /** How long the order should be valid in seconds */
  validFor?: number;
  /** User's wallet address */
  userAddress: string;
  /** Price quality preference (defaults to FAST) */
  priceQuality?: PriceQuality;
  /** Optional receiver address for the order */
  receiver?: string;
}

/**
 * CowSwap client configuration
 */
export interface CowSwapClientConfig {
  walletClient?: WalletClient;
  publicClient: PublicClient;
  chainId?: SupportedChainId;
}

/**
 * Error class for CowSwap operations
 */
export class CowSwapError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "CowSwapError";
  }
}

/**
 * CowSwap Client for interacting with CowSwap Protocol
 */
export class CowSwapClient {
  private readonly tradingSdk: TradingSdk;
  private readonly chainId: SupportedChainId;

  constructor(config: CowSwapClientConfig) {
    this.chainId = config.chainId ?? SupportedChainId.MAINNET;

    // Initialize ViemAdapter with provided clients
    const adapter = new ViemAdapter({
      provider: config.publicClient,
      walletClient: config.walletClient, // may be undefined for quote-only
    });

    // Initialize TradingSdk with app code and adapter
    this.tradingSdk = new TradingSdk(
      {
        appCode: "app.rift.trade",
        chainId: this.chainId,
      },
      {},
      adapter
    );
  }

  /**
   * Expose the underlying TradingSdk instance
   */
  get sdk() {
    return this.tradingSdk;
  }

  /**
   * Get a quote for selling a token for cbBTC
   * Returns the full QuoteResults object from the SDK
   */
  async getQuote(request: CowSwapQuoteRequest): Promise<QuoteResults> {
    try {
      // Validate that exactly one of buyAmount or sellAmount is provided
      const hasBuyAmount = request.buyAmount !== undefined;
      const hasSellAmount = request.sellAmount !== undefined;

      if (hasBuyAmount === hasSellAmount) {
        throw new CowSwapError(
          "Exactly one of buyAmount or sellAmount must be provided",
          "INVALID_REQUEST"
        );
      }

      const sellToken =
        request.sellToken === "0x0000000000000000000000000000000000000000"
          ? NATIVE_ETH_ADDRESS
          : request.sellToken;
      const validFor = request.validFor ?? DEFAULT_VALID_FOR_SECONDS;
      const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

      // Determine order kind
      const isBuyOrder = hasBuyAmount;

      // Build TradeParameters for TradingSdk
      const tradeParameters: TradeParameters = {
        kind: isBuyOrder ? OrderKind.BUY : OrderKind.SELL,
        sellToken,
        sellTokenDecimals: request.decimals,
        buyToken: CBBTC_ADDRESS,
        buyTokenDecimals: 8, // cbBTC has 8 decimals
        amount: isBuyOrder ? request.buyAmount! : request.sellAmount!,
        slippageBps,
        validFor,
        receiver: request.receiver,
      };

      // Configure advanced settings for fast price quality quote
      const advancedSettings: SwapAdvancedSettings = {
        quoteRequest: {
          priceQuality: request.priceQuality ?? PriceQuality.FAST,
        },
      };

      // Get quote from TradingSdk and return the full quoteResults
      const { quoteResults } = await this.tradingSdk.getQuote(tradeParameters, advancedSettings);
      return quoteResults;
    } catch (error) {
      if (error instanceof CowSwapError) {
        throw error;
      }
      throw new CowSwapError(
        `Failed to get CowSwap quote: ${error instanceof Error ? error.message : "Unknown error"}`,
        "QUOTE_ERROR",
        error
      );
    }
  }

  /**
   * Submit a swap order using TradingSdk
   */
  async submitOrder(request: CowSwapQuoteRequest): Promise<string> {
    try {
      // Validate that buyAmount is provided (only BUY orders supported)
      if (!request.buyAmount) {
        throw new CowSwapError(
          "buyAmount must be provided for order submission",
          "INVALID_REQUEST"
        );
      }

      const sellToken =
        request.sellToken === "0x0000000000000000000000000000000000000000"
          ? NATIVE_ETH_ADDRESS
          : request.sellToken;
      const validFor = request.validFor ?? DEFAULT_VALID_FOR_SECONDS;
      const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

      // Build TradeParameters for exact output (BUY) order
      const tradeParameters: TradeParameters = {
        kind: OrderKind.BUY,
        sellToken,
        sellTokenDecimals: request.decimals,
        buyToken: CBBTC_ADDRESS,
        buyTokenDecimals: 8, // cbBTC has 8 decimals
        amount: request.buyAmount,
        slippageBps,
        validFor,
        receiver: request.receiver,
      };

      // Submit order using TradingSdk
      const { orderId } = await this.tradingSdk.postSwapOrder(tradeParameters);

      return orderId;
    } catch (error) {
      throw new CowSwapError(
        `Failed to submit order: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SUBMIT_ORDER_ERROR",
        error
      );
    }
  }
}

/**
 * Helper to check if an order is expired
 */
export const isOrderExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

/**
 * Helper to get time until expiration in milliseconds
 */
export const getTimeToExpiration = (expiresAt: Date): number => {
  return Math.max(0, expiresAt.getTime() - Date.now());
};
