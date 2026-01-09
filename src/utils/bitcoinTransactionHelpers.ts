/**
 * Bitcoin Transaction Helpers
 * Utilities for building and broadcasting Bitcoin transactions for auto-send functionality
 */

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { GLOBAL_CONFIG } from "./constants";
import { esploraClient, TYPICAL_TX_SIZES } from "./esploraClient";

// Initialize the ECC library for bitcoinjs-lib
// This is required for v6+ to perform cryptographic operations
bitcoin.initEccLib(ecc);

/**
 * UTXO structure from Esplora API
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Parameters for building a deposit PSBT
 */
export interface BuildDepositPsbtParams {
  userAddress: string;
  depositAddress: string;
  amountSats: number;
  utxos: UTXO[];
  feeRate: number; // sat/vB
}

/**
 * Result of building a PSBT
 */
export interface BuildPsbtResult {
  psbtBase64: string;
  psbtHex: string;
  fee: number;
  inputTotal: number;
  changeAmount: number;
}

/**
 * Fetch UTXOs for a Bitcoin address from Esplora API
 * @param address - Bitcoin address to fetch UTXOs for
 * @returns Array of UTXOs
 */
export async function fetchUserUtxos(address: string): Promise<UTXO[]> {
  const utxosUrl = `${GLOBAL_CONFIG.esploraUrl}/address/${address}/utxo`;

  const response = await fetch(utxosUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs: ${response.status} ${response.statusText}`);
  }

  const utxos: UTXO[] = await response.json();
  return utxos;
}

/**
 * Get total balance from UTXOs
 * @param utxos - Array of UTXOs
 * @returns Total balance in satoshis
 */
export function getUtxoBalance(utxos: UTXO[]): number {
  return utxos.reduce((sum, utxo) => sum + utxo.value, 0);
}

/**
 * Check if user has sufficient balance for a transaction
 * @param utxos - Array of UTXOs
 * @param amountSats - Amount to send in satoshis
 * @param estimatedFee - Estimated fee in satoshis
 * @returns true if sufficient balance
 */
export function hasSufficientBalance(
  utxos: UTXO[],
  amountSats: number,
  estimatedFee: number
): boolean {
  const totalBalance = getUtxoBalance(utxos);
  return totalBalance >= amountSats + estimatedFee;
}

/**
 * Estimate transaction size for a given number of inputs and outputs
 * Assumes P2WPKH (native SegWit) addresses
 * @param numInputs - Number of inputs
 * @param numOutputs - Number of outputs (typically 2: destination + change)
 * @returns Estimated size in vBytes
 */
export function estimateTransactionSize(numInputs: number, numOutputs: number): number {
  return (
    TYPICAL_TX_SIZES.BASE_TX_SIZE +
    numInputs * TYPICAL_TX_SIZES.P2WPKH_INPUT +
    numOutputs * TYPICAL_TX_SIZES.P2WPKH_OUTPUT
  );
}

/**
 * Select UTXOs for a transaction using a simple greedy algorithm
 * @param utxos - Available UTXOs
 * @param targetAmount - Target amount in satoshis (including fee)
 * @returns Selected UTXOs
 */
export function selectUtxos(utxos: UTXO[], targetAmount: number): UTXO[] {
  // Sort UTXOs by value (largest first) for efficiency
  const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);

  const selected: UTXO[] = [];
  let total = 0;

  for (const utxo of sortedUtxos) {
    selected.push(utxo);
    total += utxo.value;

    if (total >= targetAmount) {
      break;
    }
  }

  return selected;
}

/**
 * Detect the address type from a Bitcoin address
 * @param address - Bitcoin address
 * @returns Address type string
 */
function detectAddressType(address: string): "p2wpkh" | "p2sh" | "p2pkh" | "p2tr" | "unknown" {
  if (address.startsWith("bc1q") || address.startsWith("tb1q") || address.startsWith("bcrt1q")) {
    return "p2wpkh";
  }
  if (address.startsWith("bc1p") || address.startsWith("tb1p") || address.startsWith("bcrt1p")) {
    return "p2tr";
  }
  if (address.startsWith("3") || address.startsWith("2")) {
    return "p2sh";
  }
  if (address.startsWith("1") || address.startsWith("m") || address.startsWith("n")) {
    return "p2pkh";
  }
  return "unknown";
}

/**
 * Get the network from an address
 * @param address - Bitcoin address
 * @returns Bitcoin network
 */
function getNetworkFromAddress(address: string): bitcoin.Network {
  if (address.startsWith("bcrt1")) {
    return bitcoin.networks.regtest;
  }
  if (
    address.startsWith("tb1") ||
    address.startsWith("m") ||
    address.startsWith("n") ||
    address.startsWith("2")
  ) {
    return bitcoin.networks.testnet;
  }
  return bitcoin.networks.bitcoin;
}

/**
 * Fetch raw transaction hex for a UTXO input
 * Required for non-SegWit inputs
 * @param txid - Transaction ID
 * @returns Raw transaction hex
 */
async function fetchRawTransaction(txid: string): Promise<string> {
  const url = `${GLOBAL_CONFIG.esploraUrl}/tx/${txid}/hex`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch raw transaction: ${response.status}`);
  }
  return response.text();
}

/**
 * Build a PSBT for depositing Bitcoin to the vault address
 * @param params - Build parameters
 * @returns PSBT in base64 and hex format, along with fee info
 */
export async function buildDepositPsbt(params: BuildDepositPsbtParams): Promise<BuildPsbtResult> {
  const { userAddress, depositAddress, amountSats, utxos, feeRate } = params;

  const network = getNetworkFromAddress(userAddress);
  const userAddressType = detectAddressType(userAddress);

  // Initial fee estimate (will refine after selecting UTXOs)
  let estimatedInputs = 1;
  let estimatedSize = estimateTransactionSize(estimatedInputs, 2);
  let estimatedFee = Math.ceil(feeRate * estimatedSize);

  // Select UTXOs
  let selectedUtxos = selectUtxos(utxos, amountSats + estimatedFee);

  // Refine fee estimate based on actual inputs
  estimatedSize = estimateTransactionSize(selectedUtxos.length, 2);
  estimatedFee = Math.ceil(feeRate * estimatedSize);

  // Re-select if needed with updated fee
  const inputTotal = getUtxoBalance(selectedUtxos);
  if (inputTotal < amountSats + estimatedFee) {
    selectedUtxos = selectUtxos(utxos, amountSats + estimatedFee);
    estimatedSize = estimateTransactionSize(selectedUtxos.length, 2);
    estimatedFee = Math.ceil(feeRate * estimatedSize);
  }

  const finalInputTotal = getUtxoBalance(selectedUtxos);
  if (finalInputTotal < amountSats + estimatedFee) {
    throw new Error(
      `Insufficient balance. Required: ${amountSats + estimatedFee} sats, Available: ${finalInputTotal} sats`
    );
  }

  // Calculate change
  const changeAmount = finalInputTotal - amountSats - estimatedFee;

  // Dust threshold for change output (546 sats is standard dust limit)
  const DUST_THRESHOLD = 546;
  const hasChange = changeAmount > DUST_THRESHOLD;

  // If no change, recalculate fee (one less output)
  let finalFee = estimatedFee;
  if (!hasChange) {
    estimatedSize = estimateTransactionSize(selectedUtxos.length, 1);
    finalFee = Math.ceil(feeRate * estimatedSize);
    // Extra sats go to fee
  }

  // Create PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Add inputs
  for (const utxo of selectedUtxos) {
    const inputData: any = {
      hash: utxo.txid,
      index: utxo.vout,
    };

    if (userAddressType === "p2wpkh") {
      // Native SegWit - need witnessUtxo
      const script = bitcoin.address.toOutputScript(userAddress, network);
      inputData.witnessUtxo = {
        script,
        value: utxo.value,
      };
    } else if (userAddressType === "p2sh") {
      // Wrapped SegWit or P2SH - need nonWitnessUtxo
      const rawTx = await fetchRawTransaction(utxo.txid);
      inputData.nonWitnessUtxo = Buffer.from(rawTx, "hex");
    } else if (userAddressType === "p2pkh") {
      // Legacy - need nonWitnessUtxo
      const rawTx = await fetchRawTransaction(utxo.txid);
      inputData.nonWitnessUtxo = Buffer.from(rawTx, "hex");
    } else if (userAddressType === "p2tr") {
      // Taproot - need witnessUtxo and tapInternalKey
      const script = bitcoin.address.toOutputScript(userAddress, network);
      inputData.witnessUtxo = {
        script,
        value: utxo.value,
      };
      // Note: Taproot signing will be handled by the wallet
    }

    psbt.addInput(inputData);
  }

  // Add output to deposit address
  psbt.addOutput({
    address: depositAddress,
    value: amountSats,
  });

  // Add change output if not dust
  if (hasChange) {
    psbt.addOutput({
      address: userAddress,
      value: changeAmount,
    });
  }

  // Return PSBT in multiple formats
  return {
    psbtBase64: psbt.toBase64(),
    psbtHex: psbt.toHex(),
    fee: hasChange ? estimatedFee : finalFee,
    inputTotal: finalInputTotal,
    changeAmount: hasChange ? changeAmount : 0,
  };
}

/**
 * Broadcast a signed Bitcoin transaction via Esplora API
 * @param txHex - Signed transaction in hex format
 * @returns Transaction ID
 */
export async function broadcastBitcoinTransaction(txHex: string): Promise<string> {
  const url = `${GLOBAL_CONFIG.esploraUrl}/tx`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: txHex,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to broadcast transaction: ${errorText}`);
  }

  const txid = await response.text();
  return txid;
}

/**
 * Get recommended fee rate for the transaction
 * @param priority - Fee priority ("fast" | "medium" | "slow")
 * @returns Fee rate in sat/vB
 */
export async function getRecommendedFeeRate(
  priority: "fast" | "medium" | "slow" = "medium"
): Promise<number> {
  const feeEstimates = await esploraClient.getFeeEstimatesLabeled();
  return feeEstimates[priority];
}

/**
 * Prepare a Bitcoin deposit transaction
 * This is a convenience function that combines all steps
 * @param userAddress - User's Bitcoin address
 * @param depositAddress - Vault deposit address
 * @param amountSats - Amount to deposit in satoshis
 * @param feePriority - Fee priority
 * @returns PSBT ready for signing
 */
export async function prepareDepositTransaction(
  userAddress: string,
  depositAddress: string,
  amountSats: number,
  feePriority: "fast" | "medium" | "slow" = "medium"
): Promise<BuildPsbtResult & { utxos: UTXO[]; feeRate: number }> {
  // Fetch UTXOs
  const utxos = await fetchUserUtxos(userAddress);

  if (utxos.length === 0) {
    throw new Error("No UTXOs available for this address");
  }

  // Get fee rate
  const feeRate = await getRecommendedFeeRate(feePriority);

  // Build PSBT
  const psbtResult = await buildDepositPsbt({
    userAddress,
    depositAddress,
    amountSats,
    utxos,
    feeRate,
  });

  return {
    ...psbtResult,
    utxos,
    feeRate,
  };
}
