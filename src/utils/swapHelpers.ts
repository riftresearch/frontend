/**
 * Swap Helper Functions
 * Contains logic for getting quotes and managing swap flows
 */

import { TokenData } from "./types";
import {
  rfqClient,
  ZERO_USD_DISPLAY,
  BITCOIN_DECIMALS,
  PERMIT2_ADDRESS,
  UNIVERSAL_ROUTER_ADDRESS,
  MIN_SWAP_SATS,
} from "./constants";
import { Quote, formatLotAmount, RfqClientError, Currency } from "./rfqClient";
import { toastError, toastInfo, toastWarning } from "./toast";
import { parseUnits, formatUnits } from "viem";
import { validateBitcoinPayoutAddressWithNetwork } from "./bitcoinUtils";
import {
  AllowanceTransfer,
  MaxAllowanceTransferAmount,
  type PermitSingle,
} from "@uniswap/permit2-sdk";
import { useStore } from "./store";
import { CowSwapClient } from "./cowswapClient";
import type { QuoteResults } from "@cowprotocol/sdk-trading";
import { PriceQuality } from "@cowprotocol/cow-sdk";

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
  if (usdValue < 100) return 25; // 0.25%
  if (usdValue < 250) return 10; // 0.1%
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
  rfqQuote: Quote;
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
 * Calculate fee breakdown for a swap
 *
 * @param rfqNetworkFee - Network fee in satoshis from RFQ
 * @param rfqProtocolFee - Protocol fee in satoshis from RFQ
 * @param cbBTCOut - cbBTC output amount (in base units)
 * @param erc20In - ERC20 input amount (in base units)
 * @param erc20Price - Price of ERC20 token in USD
 * @param bitcoinPrice - Price of Bitcoin in USD
 * @returns Fee breakdown with USD values
 */
export function calculateFees(
  rfqNetworkFee: number,
  rfqProtocolFee: number,
  cbBTCOut: string,
  erc20In: string,
  erc20Price: number,
  bitcoinPrice: number,
  decimals: number
): FeeOverview {
  // Convert network fee from satoshis to BTC and then to USD
  const networkFeeBTC = parseFloat(formatUnits(BigInt(rfqNetworkFee), BITCOIN_DECIMALS));
  const networkFeeUSD = networkFeeBTC * bitcoinPrice;

  // Convert protocol fee from satoshis to BTC and then to USD
  const protocolFeeBTC = parseFloat(formatUnits(BigInt(rfqProtocolFee), BITCOIN_DECIMALS));
  const protocolFeeUSD = protocolFeeBTC * bitcoinPrice;

  // Calculate ERC20 fee: erc20In * erc20Price - cbBTCOut * bitcoinPrice
  const erc20InValue = parseFloat(formatUnits(BigInt(erc20In), decimals)) * erc20Price;
  const cbBTCOutValue = parseFloat(formatUnits(BigInt(cbBTCOut), BITCOIN_DECIMALS)) * bitcoinPrice;
  const erc20FeeUSD = erc20InValue - cbBTCOutValue;

  // Calculate total fees
  const totalFeesUSD = networkFeeUSD + protocolFeeUSD + erc20FeeUSD;
  const feeOverview: FeeOverview = {
    erc20Fee: {
      fee: formatUsdValue(erc20FeeUSD),
      description: "cbBTC Fee",
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
 * Get quote for cbBTC -> BTC using RFQ server
 * This is the original getQuote function from SwapWidget, renamed
 *
 * @param amount - The amount (either input cbBTC or output BTC depending on mode)
 * @param mode - "ExactInput" for specifying cbBTC input, "ExactOutput" for specifying BTC output
 * @returns Quote object or null if failed
 */
export async function callRFQ(
  amount: string,
  mode: "ExactInput" | "ExactOutput" = "ExactInput",
  isSwappingForBTC: boolean
): Promise<Quote | null> {
  // Check if FAKE_RFQ mode is enabled
  const FAKE_RFQ = process.env.NEXT_PUBLIC_FAKE_RFQ === "true";

  const CBBTC_CURRENCY = {
    chain: "ethereum",
    decimals: 8,
    token: {
      type: "Address",
      data: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    },
  } as Currency;

  const BTC_CURRENCY = {
    chain: "bitcoin",
    decimals: 8,
    token: {
      type: "Native",
    },
  } as Currency;

  const fromCurrency = isSwappingForBTC ? CBBTC_CURRENCY : BTC_CURRENCY;
  const toCurrency = isSwappingForBTC ? BTC_CURRENCY : CBBTC_CURRENCY;

  if (FAKE_RFQ) {
    // console.log(`FAKE_RFQ mode enabled - returning dummy quote (${mode})`);
    const dummyQuote: Quote = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      market_maker_id: "987f6543-e21c-43d2-b654-426614174111",
      from: {
        currency: fromCurrency,
        amount: amount, // 1:1 for testing
      },
      to: {
        currency: toCurrency,
        amount: amount, // 1:1 for testing
      },
      fee_schedule: {
        protocol_fee_sats: 100,
        liquidity_fee_sats: 50,
        network_fee_sats: 200,
      },
      expires_at: new Date(Date.now() + 60000).toISOString(), // Expires in 1 minute
      created_at: new Date().toISOString(),
    };

    return dummyQuote;
  }

  try {
    const currentTime = new Date().getTime();

    let quoteResponse: any;
    try {
      quoteResponse = await rfqClient.requestQuotes({
        mode,
        amount,
        from: fromCurrency,
        to: toCurrency,
      });
    } catch (error) {
      console.error("RFQ request failed:", error);

      // Set OTC server dead flag on error
      const { setIsOtcServerDead } = useStore.getState();
      setIsOtcServerDead(true);

      toastInfo({
        title: "Quote Request Failed",
      });
      return null;
    }

    const timeTaken = new Date().getTime() - currentTime;
    const quoteType = (quoteResponse as any)?.quote?.type;

    // if (quoteType !== "success") {
    //   if (amount < 2500n) {
    //     // this is probably just too small so no one quoted
    //     toastInfo({
    //       title: "Amount too little",
    //       description: "The amount is too little to be quoted",
    //     });
    //     return null;
    //   } else {
    //     toastInfo({
    //       title: "Insufficient liquidity",
    //       description: "No market makers have sufficient liquidity to quote this swap",
    //     });
    //     return null;
    //   }
    // }

    // if we're here, we have a success quote
    const quote = (quoteResponse as any).quote.data;
    console.log("got quote from RFQ", quoteResponse, "in", timeTaken, "ms");

    return quote;
  } catch (error: unknown) {
    console.error("RFQ request failed:", error);

    // Set OTC server dead flag on error
    const { setIsOtcServerDead } = useStore.getState();
    setIsOtcServerDead(true);

    // Normalize error message
    const description = (() => {
      if (error instanceof RfqClientError) {
        return error.response?.error ?? error.message;
      }
      if (typeof error === "object" && error !== null) {
        const maybeMsg = (error as { message?: unknown }).message;
        if (typeof maybeMsg === "string" && maybeMsg.length > 0) {
          return maybeMsg;
        }
      }
      return "Service temporarily unavailable";
    })();

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
 */
export async function getERC20ToBTCQuote(
  sellToken: string,
  amountIn: string,
  decimals: number,
  userAddress: string,
  slippageBps?: number,
  validFor?: number,
  cowswapClient: CowSwapClient | null = null,
  priceQuality: PriceQuality = PriceQuality.OPTIMAL
): Promise<ERC20ToBTCQuoteResponse | null> {
  try {
    // Check if input token is cbBTC
    const isCbBTC = sellToken.toLowerCase() === "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";

    if (isCbBTC) {
      // For cbBTC, skip CowSwap and go directly to RFQ
      console.log("Input is cbBTC, using direct RFQ quote");

      const rfqQuote = await callRFQ(amountIn, "ExactInput", true);

      if (!rfqQuote) {
        throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
      }

      if (rfqQuote.toString() === "Insufficient balance to fulfill quote") {
        console.log("rfqQuote", rfqQuote);
        throw new Error("Insufficient balance to fulfill quote");
      }

      // Format BTC output amount
      const btcOutputAmount = formatLotAmount(rfqQuote.to);
      const expiresAt = new Date(rfqQuote.expires_at);

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

    const cowswapResponse = await cowswapClient.getQuote({
      sellToken,
      sellAmount: amountIn,
      decimals,
      slippageBps,
      validFor,
      userAddress,
      priceQuality,
    });

    console.log("cowswapQuote", cowswapResponse, "priceQuality:", priceQuality);

    const cbBTCAmount = cowswapResponse.amountsAndCosts.afterSlippage.buyAmount.toString();
    // Calculate expiration from tradeParameters.validFor
    const validForSeconds = cowswapResponse.tradeParameters.validFor || 120;
    const routerExpiration = new Date(Date.now() + validForSeconds * 1000);

    // Step 2: Get RFQ quote for cbBTC -> BTC using cbBTC amount
    const rfqQuote = await callRFQ(cbBTCAmount, "ExactInput", true);

    if (!rfqQuote) {
      throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
    }

    if (rfqQuote.toString() === "Insufficient balance to fulfill quote") {
      console.log("rfqQuote", rfqQuote);
      throw new Error("Insufficient balance to fulfill quote");
    }

    // Step 3: Format BTC output amount
    const btcOutputAmount = formatLotAmount(rfqQuote.to);

    // Step 4: Determine earliest expiration
    const rfqExpiration = new Date(rfqQuote.expires_at);
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

    // Handle specific error types
    if (error instanceof RfqClientError) {
      toastError(error, {
        title: "RFQ Quote Failed",
        description: error.message,
      });
    } else if ((error as Error).message === "Insufficient balance to fulfill quote") {
      throw new Error("Insufficient balance to fulfill quote");
    } else {
      const description = error instanceof Error ? error.message : "Unknown error occurred";
      toastError(error, {
        title: "Quote Failed",
        description,
      });
    }

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
 */
export async function getERC20ToBTCQuoteExactOutput(
  btcOutputAmount: string,
  selectedInputToken: TokenData | null,
  userAddress: string,
  slippageBps?: number,
  validFor?: number,
  cowswapClient: CowSwapClient | null = null,
  priceQuality: PriceQuality = PriceQuality.OPTIMAL
): Promise<ERC20ToBTCQuoteResponse | null> {
  try {
    if (!selectedInputToken) {
      throw new Error("No input token selected");
    }

    // Convert BTC amount to base units (satoshis)
    const btcAmountInSats = parseUnits(btcOutputAmount, BITCOIN_DECIMALS).toString();

    // Step 1: Get RFQ quote for cbBTC -> BTC using exact output mode
    const rfqQuoteData = await callRFQ(btcAmountInSats, "ExactOutput", true);

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
      const expiresAt = new Date(rfqQuoteData.expires_at);

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

    const cowswapResponse = await cowswapClient.getQuote({
      sellToken,
      buyAmount: BigInt(cbBTCAmountNeeded).toString(),
      decimals: selectedInputToken.decimals,
      slippageBps,
      validFor,
      userAddress,
      priceQuality,
    });

    console.log("cowswapQuote", cowswapResponse, "priceQuality:", priceQuality);

    // For exact output, sellAmount tells us how much input token we need
    const erc20AmountNeeded = cowswapResponse.amountsAndCosts.afterSlippage.sellAmount.toString();
    const erc20InputFormatted = formatUnits(BigInt(erc20AmountNeeded), selectedInputToken.decimals);
    // Calculate expiration from tradeParameters.validFor
    const validForSeconds = cowswapResponse.tradeParameters.validFor || 120;
    const routerExpiration = new Date(Date.now() + validForSeconds * 1000);

    // Determine earliest expiration
    const rfqExpiration = new Date(rfqQuoteData.expires_at);
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

    // Handle specific error types
    if (error instanceof RfqClientError) {
      toastError(error, {
        title: "RFQ Quote Failed",
        description: error.message,
      });
    } else {
      const description = error instanceof Error ? error.message : "Unknown error occurred";
      toastError(error, {
        title: "Quote Failed",
        description,
      });
    }

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

/**
 * Build Permit2 permit data for signing
 * @param nonce - Current nonce from Permit2 contract
 * @param tokenAddress - Address of the token to permit
 * @param userAddress - Address of the user signing the permit
 * @param chainId - Chain ID for the permit
 * @returns Object containing permit and dataToSign for wagmi's signTypedData
 */
export function buildPermitDataToSign(
  nonce: number,
  tokenAddress: string,
  userAddress: string,
  chainId: number
) {
  // Set expiration to 30 days from now
  const allowanceExpiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Set signature deadline to 30 minutes from now
  const sigDeadline = Math.floor(Date.now() / 1000) + 30 * 60;

  const permit: PermitSingle = {
    details: {
      token: tokenAddress,
      amount: MaxAllowanceTransferAmount.toString(), // 2^160-1
      expiration: allowanceExpiration, // uint48
      nonce: Number(nonce), // uint48
    },
    spender: UNIVERSAL_ROUTER_ADDRESS,
    sigDeadline,
  };

  const { domain, types, values } = AllowanceTransfer.getPermitData(
    permit,
    PERMIT2_ADDRESS,
    chainId
  );

  return {
    permit,
    dataToSign: {
      domain: domain as any,
      types,
      primaryType: "PermitSingle" as const,
      message: values as any,
      account: userAddress as `0x${string}`,
    },
  };
}
