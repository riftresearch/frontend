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
} from "@cowprotocol/cow-sdk";
import type {
  OrderCreation,
  OrderQuoteResponse,
  OrderQuoteSideKindSell,
} from "@cowprotocol/cow-sdk";

// Constants
const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const NATIVE_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DEFAULT_SLIPPAGE_BPS = 10; // 0.1% = 10 basis points
const DEFAULT_VALID_FOR_SECONDS = 60;

/**
 * CowSwap quote request parameters
 */
export interface CowSwapQuoteRequest {
  /** Token to sell (address or "ETH" for native) */
  sellToken: string;
  /** Amount to sell in base units (wei for ETH, token decimals for ERC20) */
  sellAmount: string;
  /** Slippage tolerance in basis points (100 bps = 1%) */
  slippageBps?: number;
  /** How long the order should be valid in seconds */
  validFor?: number;
  /** User's wallet address */
  userAddress: string;
}

/**
 * CowSwap quote response
 */
export interface CowSwapQuoteResponse {
  /** The quote details from CowSwap */
  quote: OrderQuoteResponse;
  /** Minimum amount of cbBTC to receive after slippage */
  buyAmount: string;
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
      const sellToken =
        request.sellToken.toUpperCase() === "ETH" ? NATIVE_ETH_ADDRESS : request.sellToken;

      const validFor = request.validFor ?? DEFAULT_VALID_FOR_SECONDS;
      const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

      // Request quote from CowSwap
      const quoteRequest = {
        sellToken,
        buyToken: CBBTC_ADDRESS,
        from: request.userAddress,
        receiver: request.userAddress,
        sellAmountBeforeFee: request.sellAmount,
        kind: "sell" as OrderQuoteSideKindSell,
        validFor,
      };

      const quote = await this.orderBookApi.getQuote(quoteRequest);

      // Calculate expiration
      const expiresAt = new Date(Date.now() + validFor * 1000);

      return {
        quote,
        buyAmount: quote.quote.buyAmount,
        expiresAt,
      };
    } catch (error) {
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
      const quoteResponse = await this.getQuote(request);
      const { quote } = quoteResponse;

      const sellToken =
        request.sellToken.toUpperCase() === "ETH" ? NATIVE_ETH_ADDRESS : request.sellToken;

      // Build the order from the quote
      const order: OrderCreation = {
        ...quote.quote,
        sellToken,
        buyToken: CBBTC_ADDRESS,
        receiver: receiver ?? request.userAddress,
        from: request.userAddress,
        signature: "",
        kind: OrderKind.SELL,
        partiallyFillable: false,
        sellTokenBalance: SellTokenSource.ERC20,
        buyTokenBalance: BuyTokenDestination.ERC20,
        signingScheme: SigningScheme.EIP712,
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
  getOrderTypedData(order: OrderCreation) {
    try {
      // Use CowSwap SDK's signing utilities to get the typed data
      const domain = OrderSigningUtils.getDomain(this.chainId);
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
