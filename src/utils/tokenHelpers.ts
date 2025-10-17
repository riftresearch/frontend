/**
 * Token Helper Functions
 * Utilities for token validation and calculations
 */

/**
 * Minimum swap amount in satoshis
 */
const MIN_SWAP_SATS = 3000;

/**
 * Satoshis per Bitcoin
 */
const SATS_PER_BTC = 100_000_000;

/**
 * Check if a USD value is above the minimum swap threshold
 * Minimum is 3000 satoshis worth of value
 *
 * @param usdValue - The USD value to check
 * @param bitcoinPrice - The current price of Bitcoin in USD
 * @returns true if the value is above the minimum threshold
 */
export function isAboveMinSwap(usdValue: number, bitcoinPrice: number): boolean {
  if (!bitcoinPrice || bitcoinPrice <= 0) {
    return false;
  }

  // Calculate the value of 3000 sats in USD
  const minValueUsd = (MIN_SWAP_SATS / SATS_PER_BTC) * bitcoinPrice;

  return usdValue >= minValueUsd;
}

/**
 * Get the minimum swap value in USD based on current Bitcoin price
 *
 * @param bitcoinPrice - The current price of Bitcoin in USD
 * @returns The minimum swap value in USD
 */
export function getMinSwapValueUsd(bitcoinPrice: number): number {
  if (!bitcoinPrice || bitcoinPrice <= 0) {
    return 0;
  }

  return (MIN_SWAP_SATS / SATS_PER_BTC) * bitcoinPrice;
}
