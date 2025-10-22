/**
 * Client-side Uniswap Router
 * Calls the server-side API to get quotes and build swap transactions
 */

/**
 * Uniswap quote request parameters
 */
export interface UniswapQuoteRequest {
  /** Token to sell (address or "ETH" for native) */
  sellToken: string;
  /** Amount to sell in base units (wei for ETH, token decimals for ERC20) */
  sellAmount: string;
  /** Token decimals */
  decimals: number;
  /** Slippage tolerance in basis points (100 bps = 1%) */
  slippageBps?: number;
  /** How long the swap should be valid in seconds */
  validFor?: number;
  /** User's wallet address */
  userAddress: string;
  /** Router to use: "v3" for V2/V3 only, "v4" for V4 only, or undefined for both */
  router?: "v3" | "v4";
}

/**
 * Uniswap quote response
 */
export interface UniswapQuoteResponse {
  /** Router type that provided the best quote */
  routerType: "v4" | "v2v3";
  /** Amount of cbBTC to receive (in base units) */
  buyAmount: string;
  /** When the quote expires */
  expiresAt: Date;
  /** Additional route information */
  route?: {
    quote?: string;
    quoteGasAdjusted?: string;
    estimatedGasUsed?: string;
    gasPriceWei?: string;
    type?: string;
    path?: string;
    poolFee?: number;
    poolFees?: number[];
    tickSpacing?: number;
    tickSpacings?: number[];
    gasEstimate?: string;
    routePath?: string;
  };
}

/**
 * Uniswap swap transaction ready for execution
 */
export interface UniswapSwapTransaction {
  /** Transaction calldata */
  calldata: string;
  /** Transaction value (for ETH swaps) */
  value: string;
  /** Target address (SwapRouter02) */
  to: string;
  /** Buy amount of cbBTC */
  buyAmount: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Additional route information */
  route?: {
    quote: string;
    quoteGasAdjusted: string;
    estimatedGasUsed: string;
    gasPriceWei: string;
  };
}

/**
 * Error class for Uniswap operations
 */
export class UniswapRouterError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "UniswapRouterError";
  }
}

/**
 * Uniswap Router Client (calls server-side API)
 */
export class UniswapRouterClient {
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = "/api/uniswap-router";
  }

  /**
   * Get a quote for selling a token for cbBTC
   */
  async getQuote(request: UniswapQuoteRequest): Promise<UniswapQuoteResponse> {
    try {
      const params = new URLSearchParams({
        sellToken: request.sellToken,
        sellAmount: request.sellAmount,
        decimals: request.decimals.toString(),
        userAddress: request.userAddress,
      });

      if (request.slippageBps !== undefined) {
        params.append("slippageBps", request.slippageBps.toString());
      }
      if (request.validFor !== undefined) {
        params.append("validFor", request.validFor.toString());
      }
      if (request.router !== undefined) {
        params.append("router", request.router);
      }

      const response = await fetch(`${this.apiBaseUrl}?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new UniswapRouterError(
          errorData.error || "Failed to get quote",
          "QUOTE_ERROR",
          errorData
        );
      }

      const data = await response.json();

      return {
        routerType: data.routerType,
        buyAmount: data.buyAmount,
        expiresAt: new Date(data.expiresAt),
        route: data.route,
      };
    } catch (error) {
      if (error instanceof UniswapRouterError) {
        throw error;
      }
      throw new UniswapRouterError(
        `Failed to get Uniswap quote: ${error instanceof Error ? error.message : "Unknown error"}`,
        "QUOTE_ERROR",
        error
      );
    }
  }

  /**
   * Build a swap transaction ready for execution
   */
  async buildSwapTransaction(
    request: UniswapQuoteRequest,
    routerType: "v4" | "v2v3",
    receiver?: string
  ): Promise<UniswapSwapTransaction> {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routerType,
          sellToken: request.sellToken,
          sellAmount: request.sellAmount,
          decimals: request.decimals,
          userAddress: request.userAddress,
          receiver,
          slippageBps: request.slippageBps,
          validFor: request.validFor,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new UniswapRouterError(
          errorData.error || "Failed to build swap transaction",
          "BUILD_SWAP_ERROR",
          errorData
        );
      }

      const data = await response.json();

      return {
        calldata: data.calldata,
        value: data.value,
        to: data.to,
        buyAmount: data.buyAmount,
        expiresAt: new Date(data.expiresAt),
        route: data.route,
      };
    } catch (error) {
      if (error instanceof UniswapRouterError) {
        throw error;
      }
      throw new UniswapRouterError(
        `Failed to build Uniswap swap transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
        "BUILD_SWAP_ERROR",
        error
      );
    }
  }
}

/**
 * Create a configured Uniswap router client
 */
export const createUniswapRouter = (): UniswapRouterClient => new UniswapRouterClient();
