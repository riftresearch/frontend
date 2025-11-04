/**
 * Esplora API Client for Bitcoin blockchain data
 * https://github.com/Blockstream/esplora/blob/master/API.md
 */

import { GLOBAL_CONFIG } from "./constants";

export interface FeeEstimates {
  [blocks: string]: number; // sat/vB
}

export interface TransactionStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface EsploraClientConfig {
  baseUrl?: string;
  timeout?: number;
}

/**
 * Create an Esplora API client
 */
export function createEsploraClient(config?: EsploraClientConfig) {
  const baseUrl = config?.baseUrl || GLOBAL_CONFIG.esploraUrl;
  const timeout = config?.timeout || 10000;

  /**
   * Fetch fee estimates from Esplora
   * Returns an object with confirmation targets (in blocks) as keys and fee rates (sat/vB) as values
   * Available targets: 1-25, 144, 504, 1008 blocks
   */
  async function getFeeEstimates(): Promise<FeeEstimates> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/fee-estimates`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch fee estimates: ${response.status} ${response.statusText}`);
      }

      const feeEstimates: FeeEstimates = await response.json();
      return feeEstimates;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Fee estimate request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get recommended fee rate for a specific confirmation target
   * @param blocks - Target number of blocks for confirmation (1-25, 144, 504, 1008)
   * @returns Fee rate in sat/vB
   */
  async function getRecommendedFee(blocks: number = 3): Promise<number> {
    const estimates = await getFeeEstimates();

    // Try to get exact target, or find closest available
    if (estimates[blocks.toString()]) {
      return estimates[blocks.toString()];
    }

    // If exact target not available, find closest higher target
    const availableTargets = Object.keys(estimates)
      .map(Number)
      .sort((a, b) => a - b);

    const closestTarget =
      availableTargets.find((target) => target >= blocks) || availableTargets[0];
    return estimates[closestTarget.toString()];
  }

  /**
   * Calculate transaction fee in satoshis
   * @param feeRate - Fee rate in sat/vB
   * @param txSize - Transaction size in vBytes
   * @returns Total fee in satoshis
   */
  function calculateFee(feeRate: number, txSize: number): number {
    return Math.ceil(feeRate * txSize);
  }

  /**
   * Get fee estimates with descriptive labels
   * Returns fast (1 block), medium (3 blocks), and slow (6 blocks) fee rates
   */
  async function getFeeEstimatesLabeled(): Promise<{
    fast: number;
    medium: number;
    slow: number;
  }> {
    const estimates = await getFeeEstimates();

    return {
      fast: estimates["1"] || estimates["2"] || 0,
      medium: estimates["3"] || estimates["4"] || estimates["5"] || 0,
      slow: estimates["6"] || estimates["10"] || estimates["25"] || 0,
    };
  }

  /**
   * Get transaction status
   * @param txid - Transaction ID
   * @returns Transaction status including confirmation status and block height
   */
  async function getTransactionStatus(txid: string): Promise<TransactionStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/tx/${txid}/status`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch transaction status: ${response.status} ${response.statusText}`
        );
      }

      const status: TransactionStatus = await response.json();
      return status;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Transaction status request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the current block height (tip of the chain)
   * @returns Current block height
   */
  async function getBlockHeight(): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/blocks/tip/height`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch block height: ${response.status} ${response.statusText}`);
      }

      const height = await response.text();
      return parseInt(height, 10);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Block height request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get number of confirmations for a transaction
   * @param txid - Transaction ID
   * @returns Number of confirmations (0 if unconfirmed)
   */
  async function getConfirmations(txid: string): Promise<number> {
    try {
      const [status, currentHeight] = await Promise.all([
        getTransactionStatus(txid),
        getBlockHeight(),
      ]);

      if (!status.confirmed || !status.block_height) {
        return 0;
      }

      return currentHeight - status.block_height + 1;
    } catch (error) {
      console.error(`Error getting confirmations for ${txid}:`, error);
      return 0;
    }
  }

  return {
    getFeeEstimates,
    getRecommendedFee,
    calculateFee,
    getFeeEstimatesLabeled,
    getTransactionStatus,
    getBlockHeight,
    getConfirmations,
  };
}

// Export a default instance
export const esploraClient = createEsploraClient();

/**
 * Estimate typical Bitcoin transaction size in vBytes
 * These are rough estimates for common transaction types
 */
export const TYPICAL_TX_SIZES = {
  // P2PKH (legacy)
  P2PKH_INPUT: 148,
  P2PKH_OUTPUT: 34,

  // P2WPKH (native segwit)
  P2WPKH_INPUT: 68,
  P2WPKH_OUTPUT: 31,

  // P2SH (wrapped segwit)
  P2SH_INPUT: 91,
  P2SH_OUTPUT: 32,

  // Base transaction overhead
  BASE_TX_SIZE: 10,
};

/**
 * Estimate transaction size for a refund transaction
 * Assumes 1 input and 1 output (simple refund)
 */
export function estimateRefundTxSize(
  addressType: "legacy" | "segwit" | "wrapped_segwit" = "segwit"
): number {
  const BASE = TYPICAL_TX_SIZES.BASE_TX_SIZE;

  switch (addressType) {
    case "legacy":
      return BASE + TYPICAL_TX_SIZES.P2PKH_INPUT + TYPICAL_TX_SIZES.P2PKH_OUTPUT;
    case "segwit":
      return BASE + TYPICAL_TX_SIZES.P2WPKH_INPUT + TYPICAL_TX_SIZES.P2WPKH_OUTPUT;
    case "wrapped_segwit":
      return BASE + TYPICAL_TX_SIZES.P2SH_INPUT + TYPICAL_TX_SIZES.P2SH_OUTPUT;
    default:
      return BASE + TYPICAL_TX_SIZES.P2WPKH_INPUT + TYPICAL_TX_SIZES.P2WPKH_OUTPUT;
  }
}
