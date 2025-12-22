/**
 * Swap Helper Functions
 * Contains logic for getting quotes and managing swap flows
 */

import { TokenData } from "./types";
import { riftApiClient, ZERO_USD_DISPLAY, BITCOIN_DECIMALS, MIN_SWAP_SATS } from "./constants";
import { toastError, toastInfo, toastWarning } from "./toast";
import { parseUnits, formatUnits } from "viem";
import { validateBitcoinPayoutAddressWithNetwork } from "./bitcoinUtils";
import { useStore } from "./store";
import { CowSwapClient } from "./cowswapClient";
import type { QuoteResults } from "@cowprotocol/sdk-trading";
import { PriceQuality } from "@cowprotocol/cow-sdk";
import {
  Currency,
  QuoteResponse,
  CurrencyAmount,
  QuoteRequest,
  QuoteType,
  FeesUsd,
} from "./riftApiClient";

// Re-export PriceQuality for convenience
export { PriceQuality };

/**
 * Calculate dynamic slippage based on notional swap size (USD)
 * Smaller swaps get higher slippage tolerance to ensure execution
 *
 * @param usdValue - The USD value of the swap
 * @returns Slippage in basis points (100 bps = 1%)
 */
export function getSlippageBpsForNotional(usdValue: number): number {
  if (usdValue < 10) return 200; // 2%
  if (usdValue < 25) return 100; // 1%
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

/**
 * Response from ERC20 to BTC quote combining CowSwap and RFQ
 * Supports both exact input and exact output modes
 */
export interface ERC20ToBTCQuoteResponse {
  /** CowSwap quote with pricing information (optional for cbBTC direct swaps) */
  cowswapQuote?: QuoteResults;
  /** Final BTC output amount (formatted string) - for exact input mode */
  btcOutputAmount?: string;
  /** Required ERC20/ETH input amount (formatted string) - for exact output mode */
  erc20InputAmount?: string;
  /** RFQ quote for cbBTC -> BTC (needed for OTC swap creation) */
  rfqQuote: QuoteResponse;
  /** Earliest expiration timestamp */
  expiresAt: Date;
}

/**
 * Fee breakdown overview for a swap
 */
export interface FeeOverview {
  erc20Fee: {
    fee: string;
    description: string;
  };
  networkFee: {
    fee: string;
    description: string;
  };
  protocolFee: {
    fee: string;
    description: string;
  };
  totalFees: string;
}

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
 * Calculate fee breakdown for a swap using the new fees.usd structure.
 * When CowSwap is involved, calculates the swap fee as the difference between
 * input value (ERC20) and output value (cbBTC).
 *
 * @param rfqFeesUsd - Fee breakdown in USD from the RFQ quote (protocol, network, marketMaker)
 * @param cowswapQuote - Optional CowSwap quote (when ERC20 -> cbBTC step is involved)
 * @param sellTokenPrice - Price of the sell token in USD (needed to convert CowSwap fee)
 * @param sellTokenDecimals - Decimals of the sell token
 * @param bitcoinPrice - Price of Bitcoin in USD (needed to calculate cbBTC output value)
 * @returns Fee breakdown with USD values
 */
export function calculateFees(
  rfqFeesUsd: FeesUsd,
  cowswapQuote?: QuoteResults | null,
  sellTokenPrice?: number,
  sellTokenDecimals?: number,
  bitcoinPrice?: number
): FeeOverview {
  const networkFeeUSD = rfqFeesUsd.network;
  const protocolFeeUSD = rfqFeesUsd.protocol;
  const marketMakerFeeUSD = rfqFeesUsd.marketMaker;

  // Calculate CowSwap fee as the difference between input value and output value
  // This represents the cost of routing through CowSwap (slippage + DEX fees)
  let swapFeeUSD = 0;
  if (cowswapQuote && sellTokenPrice && sellTokenDecimals !== undefined && bitcoinPrice) {
    const sellAmount = cowswapQuote.amountsAndCosts.afterSlippage.sellAmount;
    const buyAmount = cowswapQuote.amountsAndCosts.afterSlippage.buyAmount;

    // Calculate USD values
    const erc20InValue = parseFloat(formatUnits(sellAmount, sellTokenDecimals)) * sellTokenPrice;
    const cbBTCOutValue = parseFloat(formatUnits(buyAmount, BITCOIN_DECIMALS)) * bitcoinPrice;

    // The swap fee is the difference (what you lose in the swap)
    swapFeeUSD = Math.max(0, erc20InValue - cbBTCOutValue);
  }

  // Total swap fee includes CowSwap routing fee + market maker fee
  const erc20FeeUSD = swapFeeUSD + marketMakerFeeUSD;

  // Calculate total fees
  const totalFeesUSD = networkFeeUSD + protocolFeeUSD + erc20FeeUSD;
  const feeOverview: FeeOverview = {
    erc20Fee: {
      fee: formatUsdValue(erc20FeeUSD),
      description: "Swap Fee",
    },
    networkFee: {
      fee: formatUsdValue(networkFeeUSD),
      description: "Gas Fee",
    },
    protocolFee: {
      fee: formatUsdValue(protocolFeeUSD),
      description: "Rift Fee",
    },
    totalFees: formatUsdValue(totalFeesUSD),
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
 * Build the Currency object for cbBTC on a given chain.
 */
function buildCbBTCCurrency(chainId: number): Currency {
  return {
    chain: { kind: "EVM", chainId },
    token: {
      kind: "TOKEN",
      address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
    },
  };
}

/**
 * Build the Currency object for native Bitcoin.
 */
function buildBTCCurrency(): Currency {
  return {
    chain: { kind: "BITCOIN" },
    token: {
      kind: "NATIVE",
      decimals: 8,
    },
  };
}

/**
 * Get quote for cbBTC <-> BTC using the Rift API.
 *
 * @param amount - The amount (either input cbBTC or output BTC depending on mode)
 * @param mode - "ExactInput" for specifying cbBTC input, "ExactOutput" for specifying BTC output
 * @param isSwappingForBTC - Whether swapping ERC20 for BTC (true) or BTC for ERC20 (false)
 * @param chainId - Chain ID (1 for Ethereum mainnet, 8453 for Base) - defaults to mainnet
 * @returns QuoteResponse object or null if failed
 */
export async function callRFQ(
  amount: string,
  mode: "ExactInput" | "ExactOutput" = "ExactInput",
  isSwappingForBTC: boolean,
  chainId: number = 1
): Promise<QuoteResponse | null> {
  // Check if FAKE_RFQ mode is enabled
  const FAKE_RFQ = process.env.NEXT_PUBLIC_FAKE_RFQ === "true";

  const cbBTCCurrency = buildCbBTCCurrency(chainId);
  const btcCurrency = buildBTCCurrency();

  const fromCurrency = isSwappingForBTC ? cbBTCCurrency : btcCurrency;
  const toCurrency = isSwappingForBTC ? btcCurrency : cbBTCCurrency;

  if (FAKE_RFQ) {
    // Return a dummy quote for testing
    const dummyQuote: QuoteResponse = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      from: {
        currency: fromCurrency,
        amount: amount,
      },
      to: {
        currency: toCurrency,
        amount: amount,
      },
      fees: {
        usd: {
          marketMaker: 0.5,
          protocol: 0.1,
          network: 0.2,
        },
        raw: {
          liquidityFeeBps: 10,
          protocolFeeBps: 5,
          networkFeeSats: "200",
        },
      },
      bitcoinMarkPriceUsd: 100000,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    return dummyQuote;
  }

  try {
    const currentTime = Date.now();

    const quoteType: QuoteType = mode === "ExactInput" ? "EXACT_INPUT" : "EXACT_OUTPUT";

    const request: QuoteRequest = {
      type: quoteType,
      from: fromCurrency,
      to: toCurrency,
      amount,
    };

    const result = await riftApiClient.getQuote(request);

    const timeTaken = Date.now() - currentTime;

    if (!result.ok) {
      console.error("RFQ request failed:", result.error);

      // Set OTC server dead flag on error
      const { setIsOtcServerDead } = useStore.getState();
      setIsOtcServerDead(true);

      const description = result.error?.error ?? "Service temporarily unavailable";
      toastError(new Error(description), {
        title: "Quote Request Failed",
        description,
      });
      return null;
    }

    console.log("got quote from RFQ", result.data, "in", timeTaken, "ms");
    return result.data;
  } catch (error: unknown) {
    console.error("RFQ request failed:", error);

    // Set OTC server dead flag on error
    const { setIsOtcServerDead } = useStore.getState();
    setIsOtcServerDead(true);

    const description = error instanceof Error ? error.message : "Service temporarily unavailable";

    toastError(error, {
      title: "Quote Request Failed",
      description,
    });

    return null;
  }
}

/**
 * Get combined quote for ERC20/ETH -> BTC
 * This combines CowSwap (ERC20 -> cbBTC) with RFQ (cbBTC -> BTC)
 * For cbBTC input, skips CowSwap and goes direct to RFQ
 * @param priceQuality - CowSwap price quality (FAST for quick quotes, OPTIMAL for best price)
 * @param chainId - Chain ID (1 for Ethereum mainnet, 8453 for Base)
 */
export async function getERC20ToBTCQuote(
  sellToken: string,
  amountIn: string,
  decimals: number,
  userAddress: string,
  slippageBps?: number,
  validFor?: number,
  cowswapClient: CowSwapClient | null = null,
  priceQuality: PriceQuality = PriceQuality.OPTIMAL,
  chainId: number = 1
): Promise<ERC20ToBTCQuoteResponse | null> {
  try {
    // Check if input token is cbBTC
    const isCbBTC = sellToken.toLowerCase() === "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";

    if (isCbBTC) {
      // For cbBTC, skip CowSwap and go directly to RFQ
      console.log("Input is cbBTC, using direct RFQ quote, chainId:", chainId);

      const rfqQuote = await callRFQ(amountIn, "ExactInput", true, chainId);

      if (!rfqQuote) {
        throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
      }

      // Format BTC output amount using the new helper
      const btcOutputAmount = formatCurrencyAmount(rfqQuote.to);
      const expiresAt = new Date(rfqQuote.expiresAt);

      console.log("Input is cbBTC, returning direct quote:", btcOutputAmount);

      return {
        btcOutputAmount,
        rfqQuote,
        expiresAt,
      };
    }

    // For non-cbBTC tokens, use CowSwap + RFQ flow
    console.log("Getting CowSwap quote for", sellToken, "->", "cbBTC");

    // Check if cowswapClient is available
    if (!cowswapClient) {
      console.error("CowSwap client not available");
      throw new Error("CowSwap client not available");
    }

    // Map chainId to CowSwap supported chain ID
    const cowswapChainId = chainId === 8453 ? 8453 : 1;

    const cowswapResponse = await cowswapClient.getQuote({
      sellToken,
      sellAmount: amountIn,
      decimals,
      slippageBps,
      validFor,
      userAddress,
      priceQuality,
      chainId: cowswapChainId as any,
    });

    console.log("cowswapQuote", cowswapResponse, "priceQuality:", priceQuality);

    const cbBTCAmount = cowswapResponse.amountsAndCosts.afterSlippage.buyAmount.toString();
    // Calculate expiration from tradeParameters.validFor
    const validForSeconds = cowswapResponse.tradeParameters.validFor || 120;
    const routerExpiration = new Date(Date.now() + validForSeconds * 1000);

    // Step 2: Get RFQ quote for cbBTC -> BTC using cbBTC amount
    const rfqQuote = await callRFQ(cbBTCAmount, "ExactInput", true, chainId);

    if (!rfqQuote) {
      throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
    }

    // Step 3: Format BTC output amount using the new helper
    const btcOutputAmount = formatCurrencyAmount(rfqQuote.to);

    // Step 4: Determine earliest expiration
    const rfqExpiration = new Date(rfqQuote.expiresAt);
    const expiresAt = routerExpiration < rfqExpiration ? routerExpiration : rfqExpiration;

    // Clear "no routes" error on successful quote
    const { setHasNoRoutesError } = useStore.getState();
    setHasNoRoutesError(false);

    return {
      cowswapQuote: cowswapResponse,
      btcOutputAmount,
      rfqQuote,
      expiresAt,
    };
  } catch (error: unknown) {
    console.error("Failed to get ERC20 to BTC quote:", error);

    if ((error as Error).message === "Insufficient balance to fulfill quote") {
      throw new Error("Insufficient balance to fulfill quote");
    }

    const description = error instanceof Error ? error.message : "Unknown error occurred";
    toastError(error, {
      title: "Quote Failed",
      description,
    });

    return null;
  }
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
 * @param selectedInputToken - The token to convert for
 * @returns BigInt representation of the amount in base units, or undefined on error
 */
export function convertInputAmountToFullDecimals(
  amount: string,
  selectedInputToken: TokenData | null
): bigint | undefined {
  try {
    if (!selectedInputToken) {
      console.error("No input token selected");
      return undefined;
    }
    return parseUnits(amount, selectedInputToken.decimals);
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
 * Get combined quote for ERC20/ETH -> BTC using exact output
 * User specifies desired BTC output, we calculate required input
 * @param priceQuality - CowSwap price quality (FAST for quick quotes, OPTIMAL for best price)
 * @param chainId - Chain ID (1 for Ethereum mainnet, 8453 for Base)
 */
export async function getERC20ToBTCQuoteExactOutput(
  btcOutputAmount: string,
  selectedInputToken: TokenData | null,
  userAddress: string,
  slippageBps?: number,
  validFor?: number,
  cowswapClient: CowSwapClient | null = null,
  priceQuality: PriceQuality = PriceQuality.OPTIMAL,
  chainId: number = 1
): Promise<ERC20ToBTCQuoteResponse | null> {
  try {
    if (!selectedInputToken) {
      throw new Error("No input token selected");
    }

    // Convert BTC amount to base units (satoshis)
    const btcAmountInSats = parseUnits(btcOutputAmount, BITCOIN_DECIMALS).toString();

    // Step 1: Get RFQ quote for cbBTC -> BTC using exact output mode
    const rfqQuoteData = await callRFQ(btcAmountInSats, "ExactOutput", true, chainId);

    if (!rfqQuoteData) {
      throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
    }

    // The "from" amount is how much cbBTC we need
    const cbBTCAmountNeeded = rfqQuoteData.from.amount;

    // Check if input token is cbBTC
    const isCbBTC = selectedInputToken.ticker === "cbBTC";

    const cbBTCFormatted = formatUnits(BigInt(cbBTCAmountNeeded), 8);
    if (isCbBTC) {
      // For cbBTC, we already have the answer - just format it
      const expiresAt = new Date(rfqQuoteData.expiresAt);

      console.log("Input is cbBTC, returning direct quote:", cbBTCFormatted);

      return {
        erc20InputAmount: cbBTCFormatted,
        rfqQuote: rfqQuoteData,
        expiresAt,
      };
    }

    // Step 2: Get CowSwap quote for ERC20/ETH -> cbBTC using exact output
    const sellToken = selectedInputToken.address;

    console.log(
      "Getting CowSwap quote (exact output) for",
      sellToken,
      "->",
      cbBTCFormatted,
      "cbBTC"
    );

    // Check if cowswapClient is available
    if (!cowswapClient) {
      console.error("CowSwap client not available");
      throw new Error("CowSwap client not available");
    }

    // Map chainId to CowSwap supported chain ID
    const cowswapChainId = chainId === 8453 ? 8453 : 1;

    const cowswapResponse = await cowswapClient.getQuote({
      sellToken,
      buyAmount: BigInt(cbBTCAmountNeeded).toString(),
      decimals: selectedInputToken.decimals,
      slippageBps,
      validFor,
      userAddress,
      priceQuality,
      chainId: cowswapChainId as any,
    });

    console.log(
      "cowswapQuote",
      cowswapResponse,
      "priceQuality:",
      priceQuality,
      "chainId:",
      chainId
    );

    // For exact output, sellAmount tells us how much input token we need
    const erc20AmountNeeded = cowswapResponse.amountsAndCosts.afterSlippage.sellAmount.toString();
    const erc20InputFormatted = formatUnits(BigInt(erc20AmountNeeded), selectedInputToken.decimals);
    // Calculate expiration from tradeParameters.validFor
    const validForSeconds = cowswapResponse.tradeParameters.validFor || 120;
    const routerExpiration = new Date(Date.now() + validForSeconds * 1000);

    // Determine earliest expiration
    const rfqExpiration = new Date(rfqQuoteData.expiresAt);
    const expiresAt = routerExpiration < rfqExpiration ? routerExpiration : rfqExpiration;

    console.log("Combined exact output quote complete:", {
      btcOutputAmount,
      erc20InputAmount: erc20InputFormatted,
      expiresAt,
    });

    // Clear "no routes" error on successful quote
    const { setHasNoRoutesError } = useStore.getState();
    setHasNoRoutesError(false);

    return {
      cowswapQuote: cowswapResponse,
      erc20InputAmount: erc20InputFormatted,
      rfqQuote: rfqQuoteData,
      expiresAt,
    };
  } catch (error: unknown) {
    console.error("Failed to get ERC20 to BTC quote (exact output):", error);

    const description = error instanceof Error ? error.message : "Unknown error occurred";
    toastError(error, {
      title: "Quote Failed",
      description,
    });

    return null;
  }
}

/**
 * Calculate USD value for an amount based on token ticker
 * @param amount - The amount to calculate USD value for
 * @param ticker - The token ticker (e.g., "BTC", "ETH", "USDC")
 * @param ethPrice - Current ETH price in USD
 * @param btcPrice - Current BTC price in USD
 * @param erc20Price - Current ERC20 token price in USD (optional)
 * @returns Formatted USD value string
 */
export function calculateUsdValue(
  amount: string,
  ticker: string,
  ethPrice: number | null,
  btcPrice: number | null,
  erc20Price: number | null
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
    price = erc20Price;
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
 * @param erc20Price - Current ERC20 token price in USD (optional)
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
  erc20Price: number | null,
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
    erc20Price
  );

  return `1 BTC = ${formattedRate} ${ticker}`;
}

/**
 * Validate payout address based on swap direction
 * @param address - The address to validate
 * @param isSwappingForBTC - Whether we're swapping for BTC (true) or for ERC20 (false)
 * @returns Validation result with isValid flag and optional network mismatch details
 */
export function validatePayoutAddress(
  address: string,
  isSwappingForBTC: boolean
): { isValid: boolean; networkMismatch?: boolean; detectedNetwork?: string } {
  if (!address) {
    return { isValid: false };
  }

  if (!isSwappingForBTC) {
    // For BTC -> ERC20 swaps, validate Ethereum address for payout
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return {
      isValid: ethAddressRegex.test(address),
    };
  } else {
    // For ERC20 -> BTC swaps, validate Bitcoin address for payout
    const validation = validateBitcoinPayoutAddressWithNetwork(address, "mainnet");
    return validation;
  }
}
