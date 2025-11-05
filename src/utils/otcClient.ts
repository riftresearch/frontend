/**
 * TypeScript client for the OTC Server API
 * Provides typed access to swap creation and management endpoints
 */

import { randomBytes } from "crypto";
import { Quote } from "./rfqClient";
import { useStore } from "./store";

// Types matching the Rust server structures

export interface Metadata {
  affiliate?: string;
  start_asset?: string;
}

export interface CreateSwapRequest {
  quote: Quote;
  user_destination_address: string;
  user_evm_account_address: string;
  metadata?: Metadata;
}

export interface CreateSwapResponse {
  swap_id: string; // UUID
  deposit_address: string;
  deposit_chain: string;
  expected_amount: string; // U256 as string
  decimals: number;
  token: string;
  expires_at: string; // ISO 8601 datetime
}

export interface DepositInfo {
  address: string;
  chain: string;
  expected_amount: string; // U256 as string
  decimals: number;
  token: string;
  deposit_tx?: string;
  deposit_amount?: string; // U256 as string
  deposit_detected_at?: string; // ISO 8601 datetime
  deposit_confirmed_at?: string; // ISO 8601 datetime
}

export interface SwapResponse {
  id: string; // UUID
  quote_id: string; // UUID
  status: string;
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
  user_deposit: DepositInfo;
  mm_deposit: DepositInfo;
}

export interface ConnectedMarketMakersResponse {
  market_makers: string[]; // Array of UUIDs
}

export interface RefundPayload {
  swap_id: string; // UUID as string
  refund_recipient: string;
  refund_transaction_fee: string; // U256 as string
}

export interface RefundSwapRequest {
  payload: RefundPayload;
  signature: number[]; // byte array (Vec<u8> in Rust)
}

export type RefundSwapReason =
  | "MarketMakerNeverInitiatedDeposit"
  | "MarketMakerDepositNeverConfirmed";

export interface RefundSwapResponse {
  swap_id: string; // UUID of the refunded swap
  reason: RefundSwapReason; // Why refund was allowed
  tx_data: string; // Hex-encoded signed transaction (ready to broadcast)
  tx_chain: "bitcoin" | "ethereum"; // Which chain to broadcast on
}

export interface OTCServerClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface TDXQuoteResponse {
  // The attestation quote in hexadecimal format
  quote: string;
  // The event log associated with the quote
  event_log: string;
}

export interface FullyQualifiedTDXQuote {
  challenge_hex: string;
  tdx_response: TDXQuoteResponse;
}

export class OTCServerError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: string
  ) {
    super(`OTC Server Error: ${status} ${statusText}${body ? `: ${body}` : ""}`);
    this.name = "OTCServerError";
  }
}

/**
 * OTC Server API Client
 * Provides async/typed access to the OTC server endpoints
 */
export class OTCServerClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;

  constructor(config: OTCServerClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = config.timeout ?? 30000; // 30s default timeout
    this.headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  /**
   * Performs a single fetch attempt with timeout
   */
  private async fetchAttempt<T>(
    url: string,
    controller: AbortController,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...this.headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("OTC Server Error:", errorText);

      throw new OTCServerError(response.status, response.statusText, errorText);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    // For non-JSON responses (like health check)
    return (await response.text()) as unknown as T;
  }

  /**
   * Performs a fetch request with timeout, retry logic, and error handling
   */
  private async fetchWithTimeout<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

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
            `OTC retry attempt ${attempt}/${MAX_RETRIES}, waiting ${RETRY_DELAYS[attempt - 1]}ms...`
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
          console.error(`OTC request failed after ${MAX_RETRIES} retries`);
          setIsOtcServerDead(true);
          setIsRetryingOtcServer(false);
          setOtcRetryCount(0);

          if (error instanceof OTCServerError) {
            throw error;
          }
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Request timeout after ${this.timeout}ms`);
          }
          throw error;
        }

        // Continue to next retry attempt
        console.log(
          `OTC request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), will retry...`
        );
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error(lastError?.message ?? "All retry attempts failed");
  }

  /**
   * Health check endpoint
   */
  async getStatus(): Promise<string> {
    return this.fetchWithTimeout<string>("/status");
  }

  async getBestHash(chain: string): Promise<string> {
    const response = await this.fetchWithTimeout<{ block_hash: string }>(
      `/api/v1/chains/${chain}/best-hash`
    );

    if (!response || typeof response !== "object") {
      throw new Error(`Invalid response structure for chain ${chain}`);
    }

    if (!response.block_hash) {
      throw new Error(`Missing block_hash field for chain ${chain}`);
    }

    return response.block_hash;
  }

  /**
   * Create a new swap from a quote
   */
  async createSwap(request: CreateSwapRequest): Promise<CreateSwapResponse> {
    return this.fetchWithTimeout<CreateSwapResponse>("/api/v1/swaps", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Get swap details by ID
   */
  async getSwap(swapId: string): Promise<SwapResponse> {
    return this.fetchWithTimeout<SwapResponse>(`/api/v1/swaps/${swapId}`);
  }

  async getTDXQoute(): Promise<FullyQualifiedTDXQuote> {
    const challengeHex = randomBytes(32).toString("hex");
    return {
      challenge_hex: challengeHex,
      tdx_response: await this.fetchWithTimeout<TDXQuoteResponse>(
        `/api/v1/tdx/quote?challenge_hex=${challengeHex}`
      ),
    };
  }

  /**
   * Get list of currently connected market makers
   */
  async getConnectedMarketMakers(): Promise<ConnectedMarketMakersResponse> {
    return this.fetchWithTimeout<ConnectedMarketMakersResponse>("/api/v1/market-makers/connected");
  }

  /**
   * Request a refund for a failed swap
   */
  async refundSwap(request: RefundSwapRequest): Promise<RefundSwapResponse> {
    return this.fetchWithTimeout<RefundSwapResponse>("/api/v1/refund", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Poll for swap status updates
   * Returns when swap reaches a terminal state or timeout is reached
   */
  async waitForSwapCompletion(
    swapId: string,
    options?: {
      pollingInterval?: number; // ms between polls (default: 5000)
      maxWaitTime?: number; // max time to wait in ms (default: 600000 = 10 min)
      onStatusChange?: (status: string) => void;
    }
  ): Promise<SwapResponse> {
    const pollingInterval = options?.pollingInterval ?? 5000;
    const maxWaitTime = options?.maxWaitTime ?? 600000;
    const startTime = Date.now();
    let lastStatus: string | undefined;

    while (Date.now() - startTime < maxWaitTime) {
      const swap = await this.getSwap(swapId);

      if (swap.status !== lastStatus) {
        lastStatus = swap.status;
        options?.onStatusChange?.(swap.status);
      }

      // Terminal states
      if (["completed", "failed", "refunded"].includes(swap.status)) {
        return swap;
      }

      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }

    throw new Error(`Timeout waiting for swap ${swapId} to complete`);
  }
}

/**
 * Functional API helpers for common operations
 */

/**
 * Create a configured OTC server client
 */
export const createOTCClient = (config: OTCServerClientConfig): OTCServerClient =>
  new OTCServerClient(config);

/**
 * Get server status (functional style)
 */
export const getStatus = (client: OTCServerClient) => (): Promise<string> => client.getStatus();

/**
 * Create swap (functional style)
 */
export const createSwap =
  (client: OTCServerClient) =>
  (request: CreateSwapRequest): Promise<CreateSwapResponse> =>
    client.createSwap(request);

/**
 * Get swap (functional style)
 */
export const getSwap =
  (client: OTCServerClient) =>
  (swapId: string): Promise<SwapResponse> =>
    client.getSwap(swapId);

/**
 * Get connected market makers (functional style)
 */
export const getConnectedMarketMakers =
  (client: OTCServerClient) => (): Promise<ConnectedMarketMakersResponse> =>
    client.getConnectedMarketMakers();

/**
 * Wait for swap completion (functional style)
 */
export const waitForSwapCompletion =
  (client: OTCServerClient) =>
  (
    swapId: string,
    options?: {
      pollingInterval?: number;
      maxWaitTime?: number;
      onStatusChange?: (status: string) => void;
    }
  ): Promise<SwapResponse> =>
    client.waitForSwapCompletion(swapId, options);

/**
 * Example usage:
 *
 * ```typescript
 * // Create client
 * const client = createOTCServerClient({
 *   baseUrl: "http://localhost:8080",
 *   timeout: 30000,
 * });
 *
 * // Check server status
 * const status = await client.getStatus();
 *
 * // Create a swap
 * const quote = createQuote({
 *   marketMakerId: "123e4567-e89b-12d3-a456-426614174000",
 *   from: createCurrency("Bitcoin", "100000000", 8), // 1 BTC in sats
 *   to: createCurrency("Ethereum", "1000000000000000000", 18), // 1 ETH in wei
 *   expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
 * });
 *
 * const swapResponse = await client.createSwap({
 *   quote,
 *   user_destination_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9",
 *   user_refund_address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
 * });
 *
 * // Poll for completion
 * const completedSwap = await client.waitForSwapCompletion(
 *   swapResponse.swap_id,
 *   {
 *     pollingInterval: 3000,
 *     onStatusChange: (status) => console.log(`Status: ${status}`),
 *   }
 * );
 * ```
 */
