/**
 * Swap Helper Functions
 * Contains logic for getting quotes and managing swap flows
 */

import { TokenData, FeeOverview } from "./types";
import { ZERO_USD_DISPLAY, BITCOIN_DECIMALS, MIN_SWAP_SATS } from "./constants";

/**
 * Parse a formatted USD string (e.g. "$1,234.56") into a numeric value.
 * Returns null if the string cannot be parsed.
 */
function parseUsdString(usdString: string): number | null {
  const cleaned = usdString.replace(/[^0-9.\-]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Calculate price impact between input and output USD values.
 * Returns the percentage change from input to output.
 * A negative result means the user receives less value (typical slippage/fees).
 *
 * @param inputUsd - Formatted input USD string (e.g. "$1,000.00")
 * @param outputUsd - Formatted output USD string (e.g. "$900.00")
 * @returns Object with `percent` (number) and `display` (formatted string like "-10.00%"), or null if not calculable
 */
export function calculatePriceImpact(
  inputUsd: string,
  outputUsd: string
): { percent: number; display: string } | null {
  const inputValue = parseUsdString(inputUsd);
  const outputValue = parseUsdString(outputUsd);

  if (inputValue === null || outputValue === null || inputValue === 0) {
    return null;
  }

  const percent = ((outputValue - inputValue) / inputValue) * 100;

  // Format: show sign, 2 decimal places
  const sign = percent > 0 ? "+" : "";
  const display = `${sign}${percent.toFixed(2)}%`;

  return { percent, display };
}
import { toastWarning } from "./toast";
import { parseUnits, formatUnits } from "viem";
import { validateBitcoinPayoutAddressWithNetwork } from "./bitcoinUtils";
import {
  CurrencyAmount,
} from "./riftApiClient";

/**
 * Calculate dynamic slippage based on notional swap size (USD)
 * Smaller swaps get higher slippage tolerance to ensure execution
 *
 * @param usdValue - The USD value of the swap
 * @returns Slippage in basis points (100 bps = 1%)
 */
export function getSlippageBpsForNotional(usdValue: number): number {
  if (usdValue < 10) return 300; // 2%
  if (usdValue < 25) return 200; // 1%
  if (usdValue < 250) return 50; // 0.5%
  if (usdValue < 1000) return 10; // 0.1%
  return 5; // 0.05%
}

/**
 * Fetch gas parameters from the API
 * @param chainId - The chain ID to fetch gas params for
 * @returns Gas parameters (maxFeePerGas, maxPriorityFeePerGas) or undefined on error
 */
export async function fetchGasParams(
  chainId: number | undefined
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | undefined> {
  try {
    if (!chainId) {
      console.warn("No chainId available for gas params");
      return undefined;
    }

    const response = await fetch(`/api/eth-gas?chainId=${chainId}`);

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to fetch gas params:", error);
      toastWarning({
        title: "Gas Estimation Failed",
        description: "Using default gas settings",
      });
      return undefined;
    }

    const data = await response.json();

    return {
      maxFeePerGas: BigInt(data.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(data.maxPriorityFeePerGas),
    };
  } catch (error) {
    console.error("Error fetching gas params:", error);
    toastWarning({
      title: "Gas Estimation Failed",
      description: "Using default gas settings",
    });
    return undefined;
  }
}

/**
 * Satoshis per Bitcoin
 */
const SATS_PER_BTC = 100_000_000;

/**
 * Default slippage in basis points
 */
const DEFAULT_SLIPPAGE_BPS = 0; // 0.1% = 10 basis points


// FeeOverview is now in types.ts

/**
 * Apply slippage to an amount
 *
 * @param amount - The amount to apply slippage to (as BigInt or string)
 * @param slippageBps - Slippage tolerance in basis points (100 bps = 1%)
 * @returns The adjusted amount as a string
 */
export function applySlippage(amount: bigint | string, slippageBps?: number): string {
  if (slippageBps === 0) {
    return amount.toString();
  }

  const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;
  const slippage = slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const slippageMultiplier = 1 - slippage / 10000;

  return ((amountBigInt * BigInt(Math.floor(slippageMultiplier * 10000))) / 10000n).toString();
}

/**
 * Format a CurrencyAmount to a human-readable decimal string.
 * Uses the token's decimals from the currency definition.
 *
 * @param currencyAmount - The CurrencyAmount object from the API
 * @returns Formatted amount as a decimal string
 */
export function formatCurrencyAmount(currencyAmount: CurrencyAmount): string {
  const decimals = currencyAmount.currency.token.decimals;
  return formatUnits(BigInt(currencyAmount.amount), decimals);
}

/**
 * Build a FeeOverview from the SDK quote fees object.
 *
 * Expected shape of `fees`:
 * {
 *   rift: {
 *     network:   { amount, currency, usd },
 *     liquidity: { amount, currency, usd },
 *     protocol:  { amount, currency, usd },
 *   },
 *   totalUsd: number,
 * }
 *
 * @param fees - The `fees` object from the SDK quote response
 * @returns FeeOverview ready for display
 */
export function buildFeeOverview(fees: {
  rift: {
    network: { usd: number };
    protocol: { usd: number };
  };
  totalUsd: number;
}): FeeOverview {
  const feeOverview: FeeOverview = {
    gasFee: {
      fee: formatUsdValue(fees.rift.network.usd),
      description: "Gas Fee",
    },
    riftFee: {
      fee: formatUsdValue(fees.rift.protocol.usd),
      description: "Rift Fee",
    },
    totalFees: formatUsdValue(fees.totalUsd),
  };
  console.log("feeOverview", feeOverview);
  return feeOverview;
}

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


/**
 * Truncates a numeric string to a maximum of 8 decimal places
 * @param amount - The amount string to truncate
 * @returns The truncated amount or the original if it has 8 or fewer decimal places
 */
export function truncateAmount(amount: string): string {
  const parts = amount.split(".");
  if (parts.length === 2 && parts[1].length > 8) {
    return `${parts[0]}.${parts[1].substring(0, 8)}`;
  }
  return amount;
}

/**
 * Format a number as USD currency
 * @param value - The value to format
 * @returns Formatted USD string
 */
export function formatUsdValue(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Convert satoshis to BTC
 * @param sats - Amount in satoshis
 * @returns Formatted BTC amount as string
 */
export function satsToBtc(sats: number): string {
  return formatUnits(BigInt(sats), BITCOIN_DECIMALS);
}

/**
 * Convert BTC to satoshis
 * @param btc - Amount in BTC (as string or number)
 * @returns Amount in satoshis as bigint
 */
export function btcToSats(btc: string | number): bigint {
  return parseUnits(btc.toString(), BITCOIN_DECIMALS);
}

/**
 * Convert input amount to full decimals (base units)
 * @param amount - The amount to convert
 * @param inputToken - The token to convert for
 * @returns BigInt representation of the amount in base units, or undefined on error
 */
export function convertInputAmountToFullDecimals(
  amount: string,
  inputToken: TokenData | null
): bigint | undefined {
  try {
    if (!inputToken) {
      console.error("No input token selected");
      return undefined;
    }
    return parseUnits(amount, inputToken.decimals);
  } catch (error) {
    console.error("Error converting input amount to full decimals:", error);
    return undefined;
  }
}

/**
 * Apply slippage for exact output (increases input amount)
 *
 * @param amount - The input amount to apply slippage to (as BigInt or string)
 * @param slippageBps - Slippage tolerance in basis points (100 bps = 1%)
 * @returns The adjusted amount as a string
 */
export function applySlippageExactOutput(amount: bigint | string, slippageBps?: number): string {
  const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;
  const slippage = slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const slippageMultiplier = 1 + slippage / 10000;

  return ((amountBigInt * BigInt(Math.floor(slippageMultiplier * 10000))) / 10000n).toString();
}


/**
 * Calculate USD value for an amount based on token ticker
 * @param amount - The amount to calculate USD value for
 * @param ticker - The token ticker (e.g., "BTC", "ETH", "USDC")
 * @param ethPrice - Current ETH price in USD
 * @param btcPrice - Current BTC price in USD
 * @param tokenPrice - Current token price in USD (optional, used for non-ETH/BTC tokens)
 * @returns Formatted USD value string
 */
export function calculateUsdValue(
  amount: string,
  ticker: string,
  ethPrice: number | null,
  btcPrice: number | null,
  tokenPrice: number | null
): string {
  const parsed = parseFloat(amount);

  if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
    return ZERO_USD_DISPLAY;
  }

  let price: number | null = null;

  if (ticker === "BTC") {
    price = btcPrice;
  } else if (ticker === "ETH") {
    price = ethPrice;
  } else if (ticker === "cbBTC") {
    price = btcPrice;
  } else {
    price = tokenPrice;
  }

  if (price === null) {
    return ZERO_USD_DISPLAY;
  }

  return formatUsdValue(parsed * price);
}

/**
 * Calculate exchange rate normalized to 1 BTC with USD value
 * @param isSwappingForBTC - Whether swapping for BTC (true) or from BTC (false)
 * @param inputAmount - Input amount (already formatted as decimal string)
 * @param outputAmount - Output amount (already formatted as decimal string)
 * @param ethPrice - Current ETH price in USD
 * @param btcPrice - Current BTC price in USD
 * @param tokenPrice - Current token price in USD (optional, used for non-ETH/BTC tokens)
 * @param ticker - Token ticker for the non-BTC asset
 * @param decimals - Token decimals for the non-BTC asset
 * @returns Formatted exchange rate string: "1 BTC = X ticker ($Y)"
 */
export function calculateExchangeRate(
  isSwappingForBTC: boolean,
  inputAmount: string,
  outputAmount: string,
  ethPrice: number | null,
  btcPrice: number | null,
  tokenPrice: number | null,
  ticker: string
): string {
  const inputParsed = parseFloat(inputAmount);
  const outputParsed = parseFloat(outputAmount);

  // Validate inputs
  if (
    !inputAmount ||
    !outputAmount ||
    !Number.isFinite(inputParsed) ||
    !Number.isFinite(outputParsed) ||
    inputParsed <= 0 ||
    outputParsed <= 0
  ) {
    return `1 BTC = -- ${ticker}`;
  }

  let exchangeRate: number;

  if (isSwappingForBTC) {
    // Swapping for BTC: input is ERC20/ETH, output is BTC
    // Calculate how much input needed for 1 BTC
    exchangeRate = inputParsed / outputParsed;
  } else {
    // Swapping from BTC: input is BTC, output is ERC20/ETH
    // Calculate how much output received for 1 BTC
    exchangeRate = outputParsed / inputParsed;
  }

  // Format to max 5 decimal places, removing trailing zeros
  const formattedRate = parseFloat(exchangeRate.toFixed(5)).toString();

  // Calculate USD value of the exchange rate
  const usdValue = calculateUsdValue(
    exchangeRate.toString(),
    ticker,
    ethPrice,
    btcPrice,
    tokenPrice
  );

  return `1 BTC = ${formattedRate} ${ticker}`;
}

/**
 * Validate payout address based on swap direction
 * @param address - The address to validate
 * @param isBitcoinDestination - Whether the destination is Bitcoin (true) or EVM (false)
 * @returns Validation result with isValid flag and optional network mismatch details
 */
export function validatePayoutAddress(
  address: string,
  isBitcoinDestination: boolean
): { isValid: boolean; networkMismatch?: boolean; detectedNetwork?: string } {
  if (!address) {
    return { isValid: false };
  }

  if (!isBitcoinDestination) {
    // For swaps to EVM, validate Ethereum address for payout
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return {
      isValid: ethAddressRegex.test(address),
    };
  } else {
    // For swaps to Bitcoin, validate Bitcoin address for payout
    const validation = validateBitcoinPayoutAddressWithNetwork(address, "mainnet");
    return validation;
  }
}

