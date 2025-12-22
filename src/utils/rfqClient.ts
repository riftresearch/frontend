/**
 * TypeScript client for the RFQ (Request for Quote) server API
 * Provides async/functional/declarative access to quote aggregation services
 */

import { useStore } from "./store";

// Types matching the Rust server responses

export type ChainType = "bitcoin" | "ethereum" | "base";
export type ChainTypeBroadcast = "Bitcoin" | "Ethereum" | "Base";

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
   * Performs a single fetch attempt with timeout
   */
  private async fetchAttempt<T>(
    url: string,
    controller: AbortController,
    options?: {
      method?: string;
      body?: any;
    }
  ): Promise<T> {
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

      throw new RfqClientError(
        errorResponse?.error ?? `HTTP ${response.status}`,
        response.status,
        errorResponse
      );
    }

    return await response.json();
  }

  /**
   * Performs a fetch request with timeout, retry logic, and error handling
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

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

    const { setOtcRetryCount, setIsRetryingOtcServer, setIsOtcServerDead } = useStore.getState();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        // Set retrying flag on retry attempts (not on first attempt)
        if (attempt > 0) {
          console.log(
            `RFQ retry attempt ${attempt}/${MAX_RETRIES}, waiting ${RETRY_DELAYS[attempt - 1]}ms...`
          );
          setIsRetryingOtcServer(true);
          setOtcRetryCount(attempt);

          // Wait before retry with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
        }

        const result = await this.fetchAttempt<T>(url, controller, options);

        // Success! Clear all error flags
        setIsOtcServerDead(false);
        setIsRetryingOtcServer(false);
        setOtcRetryCount(0);

        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error : new Error("Unknown error");

        // If this was the last attempt, mark server as dead
        if (attempt === MAX_RETRIES) {
          console.error(`RFQ request failed after ${MAX_RETRIES} retries`);
          setIsOtcServerDead(true);
          setIsRetryingOtcServer(false);
          setOtcRetryCount(0);

          if (error instanceof RfqClientError) {
            throw error;
          }
          if (error instanceof Error && error.name === "AbortError") {
            throw new RfqClientError(`Request timeout after ${this.timeout}ms`);
          }
          throw new RfqClientError(lastError.message);
        }

        // Continue to next retry attempt
        console.log(
          `RFQ request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), will retry...`
        );
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new RfqClientError(lastError?.message ?? "All retry attempts failed");
  }

  /**
   * Get server status and version information
   */
  async getStatus(): Promise<Status> {
    return this.fetchWithTimeout<Status>("/status");
  }

  /**
   * Get liquidity information from all market makers
   * Returns available trading pairs and maximum amounts
   */
  async getLiquidity(): Promise<LiquidityResponse> {
    return this.fetchWithTimeout<LiquidityResponse>("/api/v2/liquidity");
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
