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
  /** Amount in (for exact input) - provide either this OR amountOut */
  amountIn?: string;
  /** Amount out (for exact output) - provide either this OR amountIn */
  amountOut?: string;
  /** Token decimals */
  decimals: number;
  /** Slippage tolerance in basis points (100 bps = 1%) */
  slippageBps?: number;
  /** How long the swap should be valid in seconds */
  validFor?: number;
  /** User's wallet address */
  userAddress: string;
  /** Router to use: "v3" for V3 only, "v4" for V4 only, or undefined for both */
  router?: "v3" | "v4";
}

/**
 * Uniswap quote response
 */
export interface UniswapQuoteResponse {
  /** Router type that provided the best quote */
  routerType: "v4" | "v3";
  /** Amount in (with slippage applied) */
  amountIn: string;
  /** Amount out (with slippage applied) */
  amountOut: string;
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
  // V4-specific fields
  poolKey?: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  path?: any[]; // PathKey[]
  currencyIn?: string;
  isFirstToken?: boolean;
  isExactOutput?: boolean;
}

/**
 * Uniswap swap transaction ready for execution
 */
export interface UniversalRouterTransaction {
  /** Transaction calldata **/
  calldata: string;
  /** Transaction value (for ETH swaps) */
  value: string;
  // Target address (Universal Router)
  to: string;

  /** Router type that generated this transaction */
  routerType?: "v4" | "v3";
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

import { BigNumber } from "ethers";

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
      // Validate exactly one of amountIn or amountOut is provided
      if (!request.amountIn && !request.amountOut) {
        throw new UniswapRouterError(
          "Must provide either amountIn (for exact input) or amountOut (for exact output)",
          "INVALID_PARAMS"
        );
      }
      if (request.amountIn && request.amountOut) {
        throw new UniswapRouterError(
          "Cannot provide both amountIn and amountOut - use only one",
          "INVALID_PARAMS"
        );
      }

      const params = new URLSearchParams({
        sellToken: request.sellToken,
        decimals: request.decimals.toString(),
        userAddress: request.userAddress,
      });

      // Add either amountIn or amountOut
      if (request.amountIn) {
        params.append("amountIn", request.amountIn);
      }
      if (request.amountOut) {
        params.append("amountOut", request.amountOut);
      }

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
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        expiresAt: new Date(data.expiresAt),
        route: data.route,
        // V4 fields
        poolKey: data.poolKey,
        path: data.path,
        currencyIn: data.currencyIn,
        isFirstToken: data.isFirstToken,
        isExactOutput: data.isExactOutput,
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
    sellToken: string,
    decimals: number,
    userAddress: string,
    routerType: "v4" | "v3",
    amountIn: string,
    receiver?: string,
    slippageBps?: number,
    validFor?: number,
    permit?: any,
    signature?: string,
    // V4 fields
    poolKey?: any,
    path?: any[],
    currencyIn?: string,
    isFirstToken?: boolean,
    amountOut?: string,
    isExactOutput?: boolean
  ): Promise<UniversalRouterTransaction> {
    try {
      const body = {
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
      };

      console.log("buildSwapTransaction body", body);
      const response = await fetch(this.apiBaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
      console.log("buildSwapTransaction response", data);

      return {
        calldata: data.calldata,
        value: data.value,
        to: data.to,
        routerType,
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
