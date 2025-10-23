/**
 * Swap Helper Functions
 * Contains logic for getting quotes and managing swap flows
 */

import { Asset, TokenData } from "./types";
import { rfqClient, GLOBAL_CONFIG, ZERO_USD_DISPLAY, BITCOIN_DECIMALS } from "./constants";
import { Quote, formatLotAmount, RfqClientError } from "./rfqClient";
import { createUniswapRouter, UniswapQuoteResponse, UniswapRouterError } from "./uniswapRouter";
import { toastError, toastInfo, toastWarning } from "./toast";
import { parseUnits, formatUnits } from "viem";

/**
 * Minimum swap amount in satoshis
 */
const MIN_SWAP_SATS = 3000;

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
const DEFAULT_SLIPPAGE_BPS = 10; // 0.1% = 10 basis points

/**
 * Response from ERC20 to BTC quote combining Uniswap and RFQ
 */
export interface ERC20ToBTCQuoteResponse {
  /** Uniswap quote with pricing information */
  uniswapQuote: UniswapQuoteResponse;
  /** Final BTC output amount (formatted string) */
  btcOutputAmount: string;
  /** RFQ quote for cbBTC -> BTC (needed for OTC swap creation) */
  rfqQuote: Quote;
  /** Earliest expiration timestamp */
  expiresAt: Date;
}

/**
 * Apply slippage to an amount
 *
 * @param amount - The amount to apply slippage to (as BigInt or string)
 * @param slippageBps - Slippage tolerance in basis points (100 bps = 1%)
 * @returns The adjusted amount as a string
 */
export function applySlippage(amount: bigint | string, slippageBps?: number): string {
  const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;
  const slippage = slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const slippageMultiplier = 1 - slippage / 10000;

  return ((amountBigInt * BigInt(Math.floor(slippageMultiplier * 10000))) / 10000n).toString();
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
 */
export async function getCBBTCtoBTCQuote(from_amount: string): Promise<Quote | null> {
  // Check if FAKE_RFQ mode is enabled
  const FAKE_RFQ = process.env.NEXT_PUBLIC_FAKE_RFQ === "true";

  if (FAKE_RFQ) {
    console.log("FAKE_RFQ mode enabled - returning dummy quote");
    const dummyQuote: Quote = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      market_maker_id: "987f6543-e21c-43d2-b654-426614174111",
      from: {
        currency: {
          chain: "ethereum",
          decimals: 8,
          token: {
            type: "Address",
            data: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
          },
        },
        amount: from_amount, // Use the input amount
      },
      to: {
        currency: {
          chain: "bitcoin",
          decimals: 8,
          token: {
            type: "Native",
          },
        },
        amount: from_amount, // 1:1 for testing (in reality would be slightly less due to fees)
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
        mode: "ExactInput",
        amount: from_amount,
        from: {
          chain: "ethereum",
          decimals: 8,
          token: {
            type: "Address",
            // NOTE: Addresses right now need to be checksummed
            data: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
          },
        },
        to: {
          chain: "bitcoin",
          decimals: 8,
          token: {
            type: "Native",
          },
        },
      });
    } catch (error) {
      console.error("RFQ request failed:", error);
      toastInfo({
        title: "Quote Request Failed",
      });
      return null;
    }

    const timeTaken = new Date().getTime() - currentTime;
    const quoteType = (quoteResponse as any)?.quote?.type;

    // if (quoteType !== "success") {
    //   if (from_amount < 2500n) {
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
    // console.log("got quote from RFQ", quoteResponse, "in", timeTaken, "ms");

    return quote;
  } catch (error: unknown) {
    console.error("RFQ request failed:", error);

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
 * This combines Uniswap (ERC20 -> cbBTC) with RFQ (cbBTC -> BTC)
 */
export async function getERC20ToBTCQuote(
  sellToken: string,
  sellAmount: string,
  decimals: number,
  userAddress: string,
  slippageBps?: number,
  validFor?: number
): Promise<ERC20ToBTCQuoteResponse | null> {
  try {
    const uniswapRouter = createUniswapRouter();

    // Step 1: Get Uniswap quote for ERC20/ETH -> cbBTC
    console.log("Getting Uniswap quote for", sellToken, "->", "cbBTC");
    const uniswapQuote = await uniswapRouter.getQuote({
      sellToken,
      sellAmount,
      decimals,
      userAddress,
      slippageBps,
      validFor,
      router: "v3",
    });

    const cbBTCAmount = uniswapQuote.buyAmount;
    console.log("Uniswap quote: will receive", cbBTCAmount, "cbBTC (in base units)");

    // Apply slippage to cbBTC amount for RFQ quote
    const adjustedCbBTCAmount = applySlippage(cbBTCAmount, slippageBps);
    console.log("Adjusted cbBTC amount after slippage:", adjustedCbBTCAmount);

    // Step 2: Get RFQ quote for cbBTC -> BTC using adjusted amount
    const rfqQuote = await getCBBTCtoBTCQuote(adjustedCbBTCAmount);

    if (!rfqQuote) {
      throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
    }

    // Step 3: Format BTC output amount
    // Convert hex string to decimal string
    const btcOutputAmount = formatLotAmount(rfqQuote.to);

    // Step 4: Determine earliest expiration
    const uniswapExpiration = uniswapQuote.expiresAt;
    const rfqExpiration = new Date(rfqQuote.expires_at);
    const expiresAt = uniswapExpiration < rfqExpiration ? uniswapExpiration : rfqExpiration;

    console.log("Combined quote complete:", {
      sellToken,
      sellAmount,
      cbBTCAmount: cbBTCAmount,
      btcOutputAmount,
      expiresAt,
    });

    return {
      uniswapQuote,
      btcOutputAmount,
      rfqQuote,
      expiresAt,
    };
  } catch (error: unknown) {
    console.error("Failed to get ERC20 to BTC quote:", error);

    // Handle specific error types
    if (error instanceof UniswapRouterError) {
      toastError(error, {
        title: "Uniswap Quote Failed",
        description: error.message,
      });
    } else if (error instanceof RfqClientError) {
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
 * Response from ERC20 to BTC quote (exact output) combining RFQ and Uniswap
 */
export interface ERC20ToBTCQuoteExactOutputResponse {
  /** Uniswap quote with pricing information (if needed) */
  uniswapQuote?: UniswapQuoteResponse;
  /** Required ERC20/ETH input amount (formatted string) */
  erc20InputAmount: string;
  /** RFQ quote for cbBTC -> BTC (needed for OTC swap creation) */
  rfqQuote: Quote;
  /** Earliest expiration timestamp */
  expiresAt: Date;
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
 */
export async function getERC20ToBTCQuoteExactOutput(
  btcOutputAmount: string,
  selectedInputToken: TokenData | null,
  userAddress: string,
  slippageBps?: number,
  validFor?: number
): Promise<ERC20ToBTCQuoteExactOutputResponse | null> {
  try {
    if (!selectedInputToken) {
      throw new Error("No input token selected");
    }

    // Convert BTC amount to base units (satoshis)
    const btcAmountInSats = parseUnits(btcOutputAmount, BITCOIN_DECIMALS).toString();

    // Step 1: Get RFQ quote for cbBTC -> BTC using exact output mode
    console.log("Getting RFQ quote (exact output) for", btcAmountInSats, "sats BTC");

    const rfqQuote = await rfqClient.requestQuotes({
      mode: "ExactOutput",
      amount: btcAmountInSats,
      from: {
        chain: "ethereum",
        decimals: 8,
        token: {
          type: "Address",
          data: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        },
      },
      to: {
        chain: "bitcoin",
        decimals: 8,
        token: {
          type: "Native",
        },
      },
    });

    const rfqQuoteData = (rfqQuote as any)?.quote?.data;
    if (!rfqQuoteData) {
      throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
    }

    // The "from" amount is how much cbBTC we need
    const cbBTCAmountNeeded = rfqQuoteData.from.amount;
    console.log("RFQ quote: need", cbBTCAmountNeeded, "cbBTC (in base units)");

    // Check if input token is cbBTC
    const isCbBTC = selectedInputToken.ticker === "cbBTC";

    if (isCbBTC) {
      // For cbBTC, we already have the answer - just format it
      const cbBTCFormatted = formatUnits(BigInt(cbBTCAmountNeeded), 8);
      const expiresAt = new Date(rfqQuoteData.expires_at);

      console.log("Input is cbBTC, returning direct quote:", cbBTCFormatted);

      return {
        erc20InputAmount: cbBTCFormatted,
        rfqQuote: rfqQuoteData,
        expiresAt,
      };
    }

    // Step 2: Get Uniswap quote for ERC20/ETH -> cbBTC using exact output
    const uniswapRouter = createUniswapRouter();
    const buyToken = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"; // cbBTC
    const sellToken = selectedInputToken?.address || "ETH";

    console.log(
      "Getting Uniswap quote (exact output) for",
      sellToken,
      "->",
      cbBTCAmountNeeded,
      "cbBTC"
    );

    const uniswapQuote = await uniswapRouter.getQuote({
      sellToken,
      sellAmount: cbBTCAmountNeeded, // This is actually buyAmount for exact output
      decimals: selectedInputToken.decimals,
      userAddress,
      slippageBps,
      validFor,
      router: "v3",
      tradeType: "output",
    });

    // For exact output, the API returns the required input amount in buyAmount field
    const erc20AmountNeeded = uniswapQuote.buyAmount;
    console.log("Uniswap quote: need", erc20AmountNeeded, "of", sellToken, "(in base units)");

    // Apply slippage by increasing the input amount
    const adjustedInputAmount = applySlippageExactOutput(erc20AmountNeeded, slippageBps);
    console.log("Adjusted input amount after slippage:", adjustedInputAmount);

    // Format the input amount for display
    const erc20InputFormatted = formatUnits(
      BigInt(adjustedInputAmount),
      selectedInputToken.decimals
    );

    // Determine earliest expiration
    const uniswapExpiration = uniswapQuote.expiresAt;
    const rfqExpiration = new Date(rfqQuoteData.expires_at);
    const expiresAt = uniswapExpiration < rfqExpiration ? uniswapExpiration : rfqExpiration;

    console.log("Combined exact output quote complete:", {
      btcOutputAmount,
      erc20InputAmount: erc20InputFormatted,
      expiresAt,
    });

    return {
      uniswapQuote,
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
 * Calculate USD value for an amount based on swap direction and token prices
 * @param amount - The amount to calculate USD value for
 * @param isSwappingForBTC - Whether we're swapping for BTC (true) or from BTC (false)
 * @param selectedInputToken - The selected input token (for ERC20 price lookup)
 * @param ethPrice - Current ETH price in USD
 * @param btcPrice - Current BTC price in USD
 * @param erc20Price - Current ERC20 token price in USD (optional)
 * @param isInputField - Whether this is for the input field (true) or output field (false)
 * @returns Formatted USD value string
 */
export function calculateUsdValue(
  amount: string,
  isSwappingForBTC: boolean,
  selectedInputToken: TokenData | null,
  ethPrice: number | null,
  btcPrice: number | null,
  erc20Price: number | null,
  isInputField: boolean
): string {
  const parsed = parseFloat(amount);

  if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
    return ZERO_USD_DISPLAY;
  }

  let price: number | null = null;

  if (isInputField) {
    // Input field logic
    if (isSwappingForBTC) {
      // Input is ERC20 or ETH
      if (!selectedInputToken || selectedInputToken.ticker === "ETH") {
        price = ethPrice;
      } else if (selectedInputToken.address) {
        price = erc20Price;
      }
    } else {
      // Input is BTC
      price = btcPrice;
    }
  } else {
    // Output field logic
    if (isSwappingForBTC) {
      // Output is BTC
      price = btcPrice;
    } else {
      // Output is ERC20 or ETH
      if (!selectedInputToken || selectedInputToken.ticker === "ETH") {
        price = ethPrice;
      } else if (selectedInputToken.address) {
        price = erc20Price;
      }
    }
  }

  if (price === null) {
    return ZERO_USD_DISPLAY;
  }

  return formatUsdValue(parsed * price);
}
