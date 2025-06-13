import { Address } from "viem";

// Types matching the Rust server responses
export type SwapStatus =
  | "PaymentPending"
  | "ChallengePeriod"
  | "Completed"
  | "Refunded";

export type OrderState = "Created" | "Settled" | "Refunded";

export type PaymentState = "Proved" | "Settled";

export type DutchAuctionState = "Created" | "Filled" | "Refunded";

export interface FinalizedTransaction {
  txid: string; // 32-byte hex string
  block_hash: string; // 32-byte hex string
  block_number: number;
}

export interface Order {
  index: number;
  timestamp: number;
  unlockTimestamp: number;
  amount: string; // uint256 as string
  takerFee: string; // uint256 as string
  expectedSats: number;
  bitcoinScriptPubKey: string; // hex string
  designatedReceiver: Address;
  owner: Address;
  salt: string; // 32-byte hex string
  confirmationBlocks: number;
  safeBitcoinBlockHeight: number;
  state: OrderState;
}

export interface ChainAwareOrder {
  order: Order;
  order_block_number: number;
  order_block_hash: string; // 32-byte hex string
  order_txid: string; // 32-byte hex string
}

export interface Payment {
  index: number;
  orderIndex: number;
  orderHash: string; // 32-byte hex string
  paymentBitcoinBlockLeaf: BlockLeaf;
  challengeExpiryTimestamp: number;
  state: PaymentState;
}

export interface ChainAwarePayment {
  payment: Payment;
  creation: FinalizedTransaction;
  settlement?: FinalizedTransaction;
}

export interface OTCSwap {
  order: ChainAwareOrder;
  payments: ChainAwarePayment[];
  refund?: FinalizedTransaction;
}

export interface BlockLeaf {
  height: number;
  block_hash: string; // 32-byte hex string (stored in reverse byte order)
  cumulative_chainwork: string; // 32-byte hex string (stored in reverse byte order)
}

export interface DutchAuctionParams {
  startBtcOut: string; // uint256 as string
  endBtcOut: string; // uint256 as string
  decayBlocks: string; // uint256 as string
  deadline: string; // uint256 as string
  fillerWhitelistContract: Address;
}

export interface BaseCreateOrderParams {
  owner: Address;
  bitcoinScriptPubKey: string; // hex string
  salt: string; // 32-byte hex string
  confirmationBlocks: number;
  safeBlockLeaf: BlockLeaf;
}

export interface DutchAuction {
  index: number;
  baseCreateOrderParams: BaseCreateOrderParams;
  dutchAuctionParams: DutchAuctionParams;
  depositAmount: string; // uint256 as string
  startBlock: string; // uint256 as string
  startTimestamp: string; // uint256 as string
  state: DutchAuctionState;
}

export interface TipProofResponse {
  leaf: BlockLeaf;
  siblings: string[];
  peaks: string[];
}

export interface SwapQuery {
  address: Address;
  page: number;
}

export interface DataEngineClientConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * TypeScript client for the data-engine-server API
 * Provides async/functional/declarative access to swap data and Bitcoin proofs
 */
export class DataEngineClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: DataEngineClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = config.timeout ?? 10000; // 10s default timeout
  }

  /**
   * Performs a fetch request with timeout and error handling
   */
  private async fetchWithTimeout<T>(
    endpoint: string,
    params?: URLSearchParams
  ): Promise<T> {
    const url = params
      ? `${this.baseUrl}${endpoint}?${params.toString()}`
      : `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get swaps for a specific address with pagination
   */
  async getSwapsForAddress(query: SwapQuery): Promise<OTCSwap[]> {
    const params = new URLSearchParams({
      address: query.address,
      page: query.page.toString(),
    });

    return this.fetchWithTimeout<OTCSwap[]>("/swaps", params);
  }

  /**
   * Get the current tip proof
   */
  async getTipProof(): Promise<TipProofResponse> {
    return this.fetchWithTimeout<TipProofResponse>("/tip-proof");
  }

  /**
   * Get the latest contract block number
   */
  async getLatestContractBlock(): Promise<number> {
    return this.fetchWithTimeout<number>("/contract-bitcoin-tip");
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<string> {
    return this.fetchWithTimeout<string>("/health");
  }
}

/**
 * Functional API helpers for common operations
 */

/**
 * Create a configured data engine client
 */
export const createDataEngineClient = (
  config: DataEngineClientConfig
): DataEngineClient => new DataEngineClient(config);

/**
 * Get swaps for address (functional style)
 */
export const getSwapsForAddress =
  (client: DataEngineClient) =>
  (query: SwapQuery): Promise<OTCSwap[]> =>
    client.getSwapsForAddress(query);

/**
 * Get tip proof (functional style)
 */
export const getTipProof =
  (client: DataEngineClient) => (): Promise<TipProofResponse> =>
    client.getTipProof();

/**
 * Get latest contract block (functional style)
 */
export const getLatestContractBlock =
  (client: DataEngineClient) => (): Promise<number> =>
    client.getLatestContractBlock();

/**
 * Health check (functional style)
 */
export const healthCheck = (client: DataEngineClient) => (): Promise<string> =>
  client.healthCheck();
