/**
 * Typed client for the Rift Swap Router API.
 * Fully self-contained with all types defined inline.
 */

// ============================================================================
// Primitives
// ============================================================================

export type Address = string;
export type U256 = string;

// ============================================================================
// Token & Chain Identifiers
// ============================================================================

export type NativeToken = {
  kind: "NATIVE";
  decimals: number;
};

export type Erc20Token = {
  kind: "TOKEN";
  address: Address;
  decimals: number;
};

export type TokenIdentifier = NativeToken | Erc20Token;

export type BitcoinChain = { kind: "BITCOIN" };
export type SolanaChain = { kind: "SOLANA" };
export type EvmChain = { kind: "EVM"; chainId: number };

export type Chain = BitcoinChain | SolanaChain | EvmChain;

export type Currency = {
  chain: Chain;
  token: TokenIdentifier;
};

// ============================================================================
// Quote Types
// ============================================================================

export type QuoteType = "EXACT_INPUT" | "EXACT_OUTPUT";

export type CurrencyAmount = {
  currency: Currency;
  amount: U256;
};

export type FeesUsd = {
  marketMaker: number;
  protocol: number;
  network: number;
};

export type FeesRaw = {
  liquidityFeeBps: number;
  protocolFeeBps: number;
  networkFeeSats: U256;
};

export type Fees = {
  usd: FeesUsd;
  raw: FeesRaw;
};

// ============================================================================
// Request/Response Types
// ============================================================================

export type QuoteRequest = {
  type: QuoteType;
  from: Currency;
  to: Currency;
  amount: U256;
};

export type QuoteResponse = {
  id: string;
  from: CurrencyAmount;
  to: CurrencyAmount;
  fees: Fees;
  bitcoinMarkPriceUsd: number;
  expiresAt: string;
};

export type SwapRequest = {
  id: string;
  userDestinationAddress: string;
  refundAddress: string;
};

export type ErrorResponse = {
  error: string;
};

export type HealthResponse = {
  status: "ok";
  timestamp: string;
};

// ============================================================================
// System Status Types
// ============================================================================

export type ServiceStatus = "ok" | "offline" | "degraded";

export type RfqStatus = {
  status: ServiceStatus;
  version?: string;
  connectedMarketMakers: number;
  error?: string;
};

export type OtcStatus = {
  status: ServiceStatus;
  version?: string;
  connectedMarketMakers: number;
  error?: string;
};

export type SystemStatusResponse = {
  status: ServiceStatus;
  timestamp: string;
  services: {
    rfq: RfqStatus;
    otc: OtcStatus;
  };
};

// ============================================================================
// Swap Types
// ============================================================================

export type SwapStatus =
  | "waiting_user_deposit_initiated"
  | "waiting_user_deposit_confirmed"
  | "waiting_mm_deposit_initiated"
  | "waiting_mm_deposit_confirmed"
  | "settling"
  | "settled"
  | "refunding_user"
  | "failed";

export type UserDepositStatus = {
  tx_hash: string;
  amount: U256;
  deposit_detected_at: string;
  confirmations: number;
  last_checked: string;
  confirmed_at?: string;
};

export type MMDepositStatus = {
  tx_hash: string;
  amount: U256;
  deposit_detected_at: string;
  confirmations: number;
  last_checked: string;
};

export type SettlementStatus = {
  tx_hash: string;
  broadcast_at: string;
  confirmations: number;
  completed_at?: string;
  fee?: U256;
};

export type LatestRefund = {
  timestamp: string;
  recipient_address: string;
};

export type RealizedSwap = {
  user_input: U256;
  mm_output: U256;
  protocol_fee: U256;
  liquidity_fee: U256;
  network_fee: U256;
};

export type SwapMetadata = {
  start_asset?: string;
};

export type SwapRates = {
  liquidity_fee_bps: number;
  protocol_fee_bps: number;
  network_fee_sats: number;
};

export type SwapFees = {
  liquidity_fee: U256;
  protocol_fee: U256;
  network_fee: U256;
};

export type LotCurrency = {
  chain: "bitcoin" | "ethereum" | "base" | "solana";
  token: { type: "Native" } | { type: "Address"; data: string };
  decimals: number;
};

export type Lot = {
  currency: LotCurrency;
  amount: U256;
};

export type SwapQuote = {
  id: string;
  market_maker_id: string;
  from: Lot;
  to: Lot;
  rates: SwapRates;
  fees: SwapFees;
  min_input: U256;
  max_input: U256;
  affiliate?: string;
  expires_at: string;
  created_at: string;
};

// Helper type for fields that can be empty objects from the API
type MaybeEmpty<T> = T | Record<string, never>;

export type Swap = {
  id: string;
  market_maker_id: string;
  quote: SwapQuote;
  metadata: MaybeEmpty<SwapMetadata>;
  realized?: MaybeEmpty<RealizedSwap>;
  deposit_vault_salt: string;
  deposit_vault_address: string;
  mm_nonce: string;
  user_destination_address: string;
  refund_address: string;
  status: SwapStatus;
  user_deposit_status?: MaybeEmpty<UserDepositStatus>;
  mm_deposit_status?: MaybeEmpty<MMDepositStatus>;
  settlement_status?: MaybeEmpty<SettlementStatus>;
  latest_refund?: MaybeEmpty<LatestRefund>;
  failure_reason?: string | null;
  failure_at?: string | null;
  mm_notified_at?: string | null;
  mm_private_key_sent_at?: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an object has data (is not an empty object).
 * The API returns `{}` for optional fields when they have no data.
 */
export function hasData<T extends object>(obj: T | Record<string, never> | undefined): obj is T {
  return obj !== undefined && Object.keys(obj).length > 0;
}

// ============================================================================
// Result Type
// ============================================================================

export type Result<T, E = ErrorResponse> =
  | { ok: true; data: T }
  | { ok: false; error: E; status: number };

// ============================================================================
// Client Configuration
// ============================================================================

export type RiftApiClientConfig = {
  baseUrl: string;
  /** Optional fetch implementation for custom environments */
  fetch?: typeof globalThis.fetch;
};

// ============================================================================
// Client
// ============================================================================

export class RiftApiClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(config: RiftApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // --------------------------------------------------------------------------
  // System Status
  // --------------------------------------------------------------------------

  /** Check if the API is online */
  async health(): Promise<Result<HealthResponse>> {
    return this.get<HealthResponse>("/health");
  }

  /** Get detailed status of all backend services */
  async status(): Promise<Result<SystemStatusResponse>> {
    return this.get<SystemStatusResponse>("/status");
  }

  // --------------------------------------------------------------------------
  // Swapping
  // --------------------------------------------------------------------------

  /** Get a quote for swapping between BTC and another asset */
  async getQuote(request: QuoteRequest): Promise<Result<QuoteResponse>> {
    return this.post<QuoteResponse>("/quote", request);
  }

  /** Create a swap order from a quote */
  async createOrder(request: SwapRequest): Promise<Result<Swap, ErrorResponse>> {
    return this.post<Swap>("/order", request);
  }

  /** Get the current status of a swap order */
  async getOrder(orderId: string): Promise<Result<Swap>> {
    return this.get<Swap>(`/order/${encodeURIComponent(orderId)}`);
  }

  // --------------------------------------------------------------------------
  // Internal HTTP methods
  // --------------------------------------------------------------------------

  private async get<T>(path: string): Promise<Result<T>> {
    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return { ok: false, error: { error: String(error) }, status: 0 };
    }
  }

  private async post<T>(path: string, body: unknown): Promise<Result<T>> {
    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return { ok: false, error: { error: String(error) }, status: 0 };
    }
  }

  private async handleResponse<T>(response: Response): Promise<Result<T>> {
    const data = await response.json();

    if (response.ok) {
      return { ok: true, data: data as T };
    }

    return {
      ok: false,
      error: data as ErrorResponse,
      status: response.status,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createRiftApiClient(config: RiftApiClientConfig): RiftApiClient {
  return new RiftApiClient(config);
}
