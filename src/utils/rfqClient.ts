/**
 * TypeScript client for the RFQ (Request for Quote) server API
 * Provides async/functional/declarative access to quote aggregation services
 */

import { useStore } from "./store";

// Types matching the Rust server responses

export type ChainType = "bitcoin" | "ethereum";
export type ChainTypeBroadcast = "Bitcoin" | "Ethereum";

export interface TokenIdentifier {
  type: "Native" | "Address";
  data?: string; // Only present when type is "Address"
}

export interface Currency {
  chain: ChainType;
  token: TokenIdentifier;
  decimals: number;
}

export interface Lot {
  currency: Currency;
  amount: string; // U256 as string
}

export interface FeeSchedule {
  protocol_fee_sats: number;
  liquidity_fee_sats: number;
  network_fee_sats: number;
}

export interface Quote {
  id: string; // UUID as string
  market_maker_id: string; // UUID as string
  from: Lot;
  to: Lot;
  fee_schedule: FeeSchedule;
  expires_at: string; // ISO 8601 datetime
  created_at: string; // ISO 8601 datetime
}

export type QuoteMode = "ExactInput" | "ExactOutput";

export interface QuoteRequest {
  mode: QuoteMode;
  from: Currency;
  to: Currency;
  amount: string; // U256 as string
}

export interface QuoteResponse {
  request_id: string; // UUID as string
  quote: Quote;
  total_quotes_received: number;
  market_makers_contacted: number;
}

export interface Status {
  status: string;
  version: string;
  connected_market_makers: number;
}

export interface ConnectedMarketMakersResponse {
  market_makers: string[]; // Array of UUIDs as strings
}

export interface TradingPair {
  from: Currency;
  to: Currency;
  max_amount: string; // Hex string representing U256
}

export interface MarketMaker {
  market_maker_id: string; // UUID as string
  trading_pairs: TradingPair[];
}

export interface LiquidityResponse {
  market_makers: MarketMaker[];
  timestamp: string; // ISO 8601 datetime
}

export interface ErrorResponse {
  error: string;
}

export interface RfqClientConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * Error class for RFQ client operations
 */
export class RfqClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: ErrorResponse
  ) {
    super(message);
    this.name = "RfqClientError";
  }
}

/**
 * TypeScript client for the RFQ server API
 * Provides access to quote aggregation and market maker information
 */
export class RfqClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;

  constructor(config: RfqClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = config.timeout ?? 10000; // 10s default timeout

    this.headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  /**
   * Performs a fetch request with timeout and error handling
   */
  private async fetchWithTimeout<T>(
    endpoint: string,
    options?: {
      method?: string;
      body?: any;
      params?: URLSearchParams;
    }
  ): Promise<T> {
    const url = options?.params
      ? `${this.baseUrl}${endpoint}?${options.params.toString()}`
      : `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: options?.method ?? "GET",
        signal: controller.signal,
        headers: this.headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        let errorResponse: ErrorResponse | undefined;
        try {
          errorResponse = await response.json();
        } catch {
          // If response is not JSON, use status text
          errorResponse = { error: response.statusText };
        }

        // Set OTC server dead flag on error
        const { setIsOtcServerDead } = useStore.getState();
        setIsOtcServerDead(true);

        throw new RfqClientError(
          errorResponse?.error ?? `HTTP ${response.status}`,
          response.status,
          errorResponse
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RfqClientError) {
        throw error;
      }

      // Set OTC server dead flag on timeout or network errors
      const { setIsOtcServerDead } = useStore.getState();
      setIsOtcServerDead(true);

      if (error instanceof Error && error.name === "AbortError") {
        throw new RfqClientError(`Request timeout after ${this.timeout}ms`);
      }
      throw new RfqClientError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get server status and version information
   */
  async getStatus(): Promise<Status> {
    return this.fetchWithTimeout<Status>("/status");
  }

  /**
   * Request quotes from connected market makers
   */
  async requestQuotes(request: QuoteRequest): Promise<QuoteResponse> {
    return this.fetchWithTimeout<QuoteResponse>("/api/v1/quotes/request", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Get list of connected market makers
   */
  async getConnectedMarketMakers(): Promise<ConnectedMarketMakersResponse> {
    return this.fetchWithTimeout<ConnectedMarketMakersResponse>("/api/v1/market-makers/connected");
  }

  /**
   * Get liquidity information from all market makers
   * Returns available trading pairs and maximum amounts
   */
  async getLiquidity(): Promise<LiquidityResponse> {
    return this.fetchWithTimeout<LiquidityResponse>("/api/v1/liquidity");
  }

  /**
   * Health check endpoint (alias for getStatus)
   */
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.status === "ok";
    } catch {
      return false;
    }
  }
}

/**
 * Functional API helpers for common operations
 */

/**
 * Create a configured RFQ client
 */
export const createRfqClient = (config: RfqClientConfig): RfqClient => new RfqClient(config);

/**
 * Get server status (functional style)
 */
export const getStatus = (client: RfqClient) => (): Promise<Status> => client.getStatus();

/**
 * Request quotes (functional style)
 */
export const requestQuotes =
  (client: RfqClient) =>
  (request: QuoteRequest): Promise<QuoteResponse> =>
    client.requestQuotes(request);

/**
 * Get connected market makers (functional style)
 */
export const getConnectedMarketMakers =
  (client: RfqClient) => (): Promise<ConnectedMarketMakersResponse> =>
    client.getConnectedMarketMakers();

/**
 * Get liquidity information (functional style)
 */
export const getLiquidity = (client: RfqClient) => (): Promise<LiquidityResponse> =>
  client.getLiquidity();

/**
 * Health check (functional style)
 */
export const healthCheck = (client: RfqClient) => (): Promise<boolean> => client.healthCheck();

/**
 * Helper function to create a Lot (currency with amount)
 */
export const createLot = (currency: Currency, amount: string): Lot => ({
  currency,
  amount,
});

/**
 * Helper function to check if a quote has expired
 */
export const isQuoteExpired = (quote: Quote): boolean => {
  const now = new Date();
  const expiresAt = new Date(quote.expires_at);
  return now > expiresAt;
};

/**
 * Helper function to get time until quote expiration in milliseconds
 */
export const getQuoteTimeToExpiration = (quote: Quote): number => {
  const now = new Date();
  const expiresAt = new Date(quote.expires_at);
  return Math.max(0, expiresAt.getTime() - now.getTime());
};

/**
 * Helper function to format lot amount with decimals
 */
export const formatLotAmount = (lot: Lot): string => {
  const amount = BigInt(lot.amount);
  const divisor = BigInt(10 ** lot.currency.decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(lot.currency.decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  return `${wholePart}.${trimmedFractional}`;
};

/**
 * Helper function to parse amount string to base units
 */
export const parseAmountToBaseUnits = (amount: string, decimals: number): string => {
  const [wholePart, fractionalPart = ""] = amount.split(".");
  const paddedFractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const baseUnits = wholePart + paddedFractional;
  return BigInt(baseUnits).toString();
};

/**
 * Helper to create a quote request
 */
export const createQuoteRequest = (
  mode: QuoteMode,
  fromCurrency: Currency,
  toCurrency: Currency,
  amount: string
): QuoteRequest => ({
  mode,
  from: fromCurrency,
  to: toCurrency,
  amount,
});

/**
 * Helper function to convert hex amount to decimal string
 */
export const hexToDecimal = (hexAmount: string): string => {
  return BigInt(hexAmount).toString();
};
