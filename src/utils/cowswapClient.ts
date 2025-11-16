/**
 * TypeScript client for CowSwap Protocol
 * Provides typed access to quote and order creation for ERC20 -> cbBTC swaps
 */

import {
  OrderBookApi,
  OrderSigningUtils,
  SupportedChainId,
  OrderKind,
  SellTokenSource,
  BuyTokenDestination,
  SigningScheme,
  PriceQuality,
} from "@cowprotocol/cow-sdk";
import type {
  OrderCreation,
  OrderQuoteResponse,
  OrderQuoteSideKindBuy,
  OrderQuoteSideKindSell,
} from "@cowprotocol/cow-sdk";
import { applySlippageExactOutput, applySlippage } from "./swapHelpers";

// Constants
const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DEFAULT_SLIPPAGE_BPS = 5; // 0.05% = 5 basis points
const DEFAULT_VALID_FOR_SECONDS = 120; // 2 minutes

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
  /** Slippage tolerance in basis points (100 bps = 1%) */
  slippageBps?: number;
  /** How long the order should be valid in seconds */
  validFor?: number;
  /** User's wallet address */
  userAddress: string;
  /** Price quality preference (defaults to FAST) */
  priceQuality?: PriceQuality;
}

/**
 * CowSwap quote response
 */
export interface CowSwapQuoteResponse {
  /** The quote details from CowSwap */
  quote: OrderQuoteResponse;
  /** Amount to buy (set when quote was a sell order) */
  buyAmount?: string;
  /** Amount to sell (set when quote was a buy order) */
  sellAmount?: string;
  /** When the quote expires */
  expiresAt: Date;
}

/**
 * CowSwap order ready for signing
 */
export interface CowSwapOrder {
  /** The order parameters */
  order: OrderCreation;
  /** The quote ID for tracking */
  quoteId?: number;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * CowSwap client configuration
 */
export interface CowSwapClientConfig {
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
  private readonly orderBookApi: OrderBookApi;
  private readonly chainId: SupportedChainId;

  constructor(config: CowSwapClientConfig = {}) {
    this.chainId = config.chainId ?? SupportedChainId.MAINNET;
    this.orderBookApi = new OrderBookApi({ chainId: this.chainId });
  }

  /**
   * Get a quote for selling a token for cbBTC
   */
  async getQuote(request: CowSwapQuoteRequest): Promise<CowSwapQuoteResponse> {
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
        request.sellToken.toUpperCase() === "ETH" ? NATIVE_ETH_ADDRESS : request.sellToken;

      const validFor = request.validFor ?? DEFAULT_VALID_FOR_SECONDS;
      const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const priceQuality = request.priceQuality ?? PriceQuality.VERIFIED;

      // Determine order kind and construct quote request
      const isBuyOrder = hasBuyAmount;

      const quote = isBuyOrder
        ? await this.orderBookApi.getQuote({
            sellToken,
            buyToken: CBBTC_ADDRESS,
            from: request.userAddress,
            receiver: request.userAddress,
            buyAmountAfterFee: request.buyAmount!,
            kind: "buy" as OrderQuoteSideKindBuy,
            validFor,
            priceQuality,
          })
        : await this.orderBookApi.getQuote({
            sellToken,
            buyToken: CBBTC_ADDRESS,
            from: request.userAddress,
            receiver: request.userAddress,
            sellAmountBeforeFee: applySlippage(request.sellAmount!, slippageBps),
            kind: "sell" as OrderQuoteSideKindSell,
            validFor,
            priceQuality,
          });

      // Calculate expiration
      const expiresAt = new Date(Date.now() + validFor * 1000);

      // Return appropriate amount based on order type
      return isBuyOrder
        ? {
            quote,
            sellAmount: applySlippageExactOutput(quote.quote.sellAmount, slippageBps),
            expiresAt,
          }
        : {
            quote,
            buyAmount: quote.quote.buyAmount,
            expiresAt,
          };
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
   * Build an order ready for signing
   */
  async buildOrder(request: CowSwapQuoteRequest, receiver?: string): Promise<CowSwapOrder> {
    try {
      console.log("Building CowSwap order with request:", request);
      const quoteResponse = await this.getQuote(request);
      const { quote } = quoteResponse;

      const sellToken =
        request.sellToken.toUpperCase() === "ETH" ? NATIVE_ETH_ADDRESS : request.sellToken;

      // For BUY orders, apply slippage to sell amount (increase max input allowed)
      const adjustedSellAmount = applySlippageExactOutput(
        quote.quote.sellAmount,
        request.slippageBps
      );

      // Build the order from the quote
      const order: OrderCreation = {
        ...quote.quote,
        sellToken,
        buyToken: CBBTC_ADDRESS,
        receiver: receiver ?? request.userAddress,
        from: request.userAddress,
        signature: "",
        kind: OrderKind.BUY,
        partiallyFillable: false,
        sellTokenBalance: SellTokenSource.ERC20,
        buyTokenBalance: BuyTokenDestination.ERC20,
        signingScheme: SigningScheme.EIP712,
        sellAmount: adjustedSellAmount,
        feeAmount: "0",
      };

      return {
        order,
        quoteId: quote.id,
        expiresAt: quoteResponse.expiresAt,
      };
    } catch (error) {
      if (error instanceof CowSwapError) {
        throw error;
      }
      throw new CowSwapError(
        `Failed to build CowSwap order: ${error instanceof Error ? error.message : "Unknown error"}`,
        "BUILD_ORDER_ERROR",
        error
      );
    }
  }

  /**
   * Get the status of an order
   */
  async getOrderStatus(orderUid: string): Promise<string> {
    try {
      const order = await this.orderBookApi.getOrder(orderUid);
      return order.status;
    } catch (error) {
      throw new CowSwapError(
        `Failed to get order status: ${error instanceof Error ? error.message : "Unknown error"}`,
        "ORDER_STATUS_ERROR",
        error
      );
    }
  }

  /**
   * Get EIP-712 typed data for signing an order
   */
  async getOrderTypedData(order: OrderCreation) {
    try {
      // Use CowSwap SDK's signing utilities to get the typed data
      const domain = await OrderSigningUtils.getDomain(this.chainId);
      const types = OrderSigningUtils.getEIP712Types();

      return {
        domain,
        types,
        message: order,
      };
    } catch (error) {
      throw new CowSwapError(
        `Failed to get order typed data: ${error instanceof Error ? error.message : "Unknown error"}`,
        "TYPED_DATA_ERROR",
        error
      );
    }
  }

  /**
   * Submit a signed order to CowSwap
   */
  async submitOrder(order: OrderCreation, signature: string): Promise<string> {
    try {
      const orderUid = await this.orderBookApi.sendOrder({
        ...order,
        signature,
        signingScheme: SigningScheme.EIP712,
      });
      return orderUid;
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
 * Create a configured CowSwap client
 */
export const createCowSwapClient = (config?: CowSwapClientConfig): CowSwapClient =>
  new CowSwapClient(config);

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
