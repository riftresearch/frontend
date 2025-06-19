import { Address } from "viem";

/**
 * Converts a u8 array to a hex string with 0x prefix
 */
export function u8ArrayToHex(arr: number[]): `0x${string}` {
  return `0x${arr.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Parses raw API response data containing u8 arrays into properly typed hex strings
 */
export function parseOTCSwapResponse(rawSwap: any): OTCSwap {
  return {
    order: {
      order: {
        ...rawSwap.order.order,
        bitcoinScriptPubKey: Array.isArray(
          rawSwap.order.order.bitcoinScriptPubKey
        )
          ? u8ArrayToHex(rawSwap.order.order.bitcoinScriptPubKey)
          : rawSwap.order.order.bitcoinScriptPubKey,
        salt: Array.isArray(rawSwap.order.order.salt)
          ? u8ArrayToHex(rawSwap.order.order.salt)
          : rawSwap.order.order.salt,
      },
      order_block_number: rawSwap.order.order_block_number,
      order_block_hash: Array.isArray(rawSwap.order.order_block_hash)
        ? u8ArrayToHex(rawSwap.order.order_block_hash)
        : rawSwap.order.order_block_hash,
      order_txid: Array.isArray(rawSwap.order.order_txid)
        ? u8ArrayToHex(rawSwap.order.order_txid)
        : rawSwap.order.order_txid,
    },
    payments: rawSwap.payments.map((payment: any) => ({
      payment: {
        ...payment.payment,
        orderHash: Array.isArray(payment.payment.orderHash)
          ? u8ArrayToHex(payment.payment.orderHash)
          : payment.payment.orderHash,
      },
      creation: {
        ...payment.creation,
        txid: Array.isArray(payment.creation.txid)
          ? u8ArrayToHex(payment.creation.txid)
          : payment.creation.txid,
        block_hash: Array.isArray(payment.creation.block_hash)
          ? u8ArrayToHex(payment.creation.block_hash)
          : payment.creation.block_hash,
      },
      settlement: payment.settlement
        ? {
            ...payment.settlement,
            txid: Array.isArray(payment.settlement.txid)
              ? u8ArrayToHex(payment.settlement.txid)
              : payment.settlement.txid,
            block_hash: Array.isArray(payment.settlement.block_hash)
              ? u8ArrayToHex(payment.settlement.block_hash)
              : payment.settlement.block_hash,
          }
        : undefined,
    })),
    refund: rawSwap.refund
      ? {
          ...rawSwap.refund,
          txid: Array.isArray(rawSwap.refund.txid)
            ? u8ArrayToHex(rawSwap.refund.txid)
            : rawSwap.refund.txid,
          block_hash: Array.isArray(rawSwap.refund.block_hash)
            ? u8ArrayToHex(rawSwap.refund.block_hash)
            : rawSwap.refund.block_hash,
        }
      : undefined,
  };
}

/**
 * Parses raw TipProofResponse containing u8 arrays into properly typed hex strings
 */
export function parseTipProofResponse(rawTipProof: any): TipProofResponse {
  return {
    leaf: {
      height: rawTipProof.leaf.height,
      block_hash: Array.isArray(rawTipProof.leaf.block_hash)
        ? rawTipProof.leaf.block_hash
        : rawTipProof.leaf.block_hash,
      cumulative_chainwork: Array.isArray(rawTipProof.leaf.cumulative_chainwork)
        ? rawTipProof.leaf.cumulative_chainwork
        : rawTipProof.leaf.cumulative_chainwork,
    },
    siblings: rawTipProof.siblings,
    peaks: rawTipProof.peaks,
    mmr_root: rawTipProof.mmr_root,
  };
}

// Types matching the Rust server responses
export type SwapStatus =
  | "PaymentPending"
  | "ChallengePeriod"
  | "Completed"
  | "Refunded";

export type OrderState = number;

export type PaymentState = number;

export type DutchAuctionState = number;

export interface FinalizedTransaction {
  txid: `0x${string}`; // 32-byte hex string
  block_hash: `0x${string}`; // 32-byte hex string
  block_number: number;
}

export interface Order {
  index: number;
  timestamp: number;
  unlockTimestamp: number;
  amount: string; // uint256 as string
  takerFee: string; // uint256 as string
  expectedSats: number;
  bitcoinScriptPubKey: `0x${string}`; // hex string
  designatedReceiver: Address;
  owner: Address;
  salt: `0x${string}`; // 32-byte hex string
  confirmationBlocks: number;
  safeBitcoinBlockHeight: number;
  state: OrderState;
}

export interface ChainAwareOrder {
  order: Order;
  order_block_number: number;
  order_block_hash: `0x${string}`; // 32-byte hex string
  order_txid: `0x${string}`; // 32-byte hex string
}

export interface Payment {
  index: number;
  orderIndex: number;
  orderHash: `0x${string}`; // 32-byte hex string
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

export interface BlockLeafReturn {
  height: number;
  block_hash: number[]; // 32-byte array (stored in reverse byte order)
  cumulative_chainwork: number[]; // 32-byte array (stored in reverse byte order)
}

export interface BlockLeaf {
  height: number;
  block_hash: `0x${string}`;
  cumulative_chainwork: `0x${string}`;
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
  bitcoinScriptPubKey: `0x${string}`; // hex string
  salt: `0x${string}`; // 32-byte hex string
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
  leaf: BlockLeafReturn;
  siblings: number[][]; // Array of 32-byte arrays
  peaks: number[][]; // Array of 32-byte arrays
  mmr_root: number[]; // 32-byte array
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

    const rawSwaps = await this.fetchWithTimeout<any[]>("/swaps", params);
    return rawSwaps.map(parseOTCSwapResponse);
  }

  /**
   * Get the current tip proof
   */
  async getTipProof(): Promise<TipProofResponse> {
    const rawTipProof = await this.fetchWithTimeout<any>("/tip-proof");
    return parseTipProofResponse(rawTipProof);
  }

  /**
   * Get the latest contract block number
   */
  async getLatestContractBlock(): Promise<number> {
    return this.fetchWithTimeout<number>("/contract-bitcoin-tip");
  }

  /**
   * Get order by order index
   */
  async getOrder(orderIndex: number): Promise<OTCSwap | null> {
    const params = new URLSearchParams({
      order_index: orderIndex.toString(),
    });

    const rawSwap = await this.fetchWithTimeout<any>("/order", params);
    return rawSwap ? parseOTCSwapResponse(rawSwap) : null;
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
 * Get order by order index (functional style)
 */
export const getOrder =
  (client: DataEngineClient) =>
  (orderIndex: number): Promise<OTCSwap | null> =>
    client.getOrder(orderIndex);

/**
 * Health check (functional style)
 */
export const healthCheck = (client: DataEngineClient) => (): Promise<string> =>
  client.healthCheck();
