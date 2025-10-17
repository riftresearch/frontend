/**
 * Swap Helper Functions
 * Contains logic for getting quotes and managing swap flows
 */

import { Asset } from "./types";
import { rfqClient, GLOBAL_CONFIG } from "./constants";
import { Quote, formatLotAmount, RfqClientError } from "./rfqClient";
import { createCowSwapClient, CowSwapOrder, CowSwapError } from "./cowswapClient";
import { toastError, toastInfo } from "./toast";

/**
 * Response from ERC20 to BTC quote combining CowSwap and RFQ
 */
export interface ERC20ToBTCQuoteResponse {
  /** CowSwap order ready for signing */
  cowswapOrder: CowSwapOrder;
  /** Final BTC output amount (formatted string) */
  btcOutputAmount: string;
  /** RFQ quote for cbBTC -> BTC (needed for OTC swap creation) */
  rfqQuote: Quote;
  /** Earliest expiration timestamp */
  expiresAt: Date;
}

/**
 * Get quote for cbBTC -> BTC using RFQ server
 * This is the original getQuote function from SwapWidget, renamed
 */
export async function getCBBTCtoBTCQuote(from_amount: string): Promise<Quote | null> {
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
    console.log("got quote from RFQ", quoteResponse, "in", timeTaken, "ms");

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
 * This combines CowSwap (ERC20 -> cbBTC) with RFQ (cbBTC -> BTC)
 */
export async function getERC20ToBTCQuote(
  sellToken: string,
  sellAmount: string,
  userAddress: string,
  slippageBps?: number,
  validFor?: number
): Promise<ERC20ToBTCQuoteResponse | null> {
  try {
    const cowswapClient = createCowSwapClient();

    // Step 1: Get CowSwap quote for ERC20/ETH -> cbBTC
    console.log("Getting CowSwap quote for", sellToken, "->", "cbBTC");
    const cowswapQuote = await cowswapClient.getQuote({
      sellToken,
      sellAmount,
      userAddress,
      slippageBps,
      validFor,
    });

    const cbBTCAmount = cowswapQuote.buyAmount;
    console.log("CowSwap quote: will receive", cbBTCAmount, "cbBTC (in base units)");

    // Step 2: Get RFQ quote for cbBTC -> BTC
    const rfqQuote = await getCBBTCtoBTCQuote(cbBTCAmount);

    console.log("RFQ quote:", rfqQuote);
    if (!rfqQuote) {
      throw new Error("Failed to get RFQ quote for cbBTC -> BTC");
    }

    // Step 3: Build CowSwap order (receiver will be set later to OTC deposit address)
    const cowswapOrder = await cowswapClient.buildOrder({
      sellToken,
      sellAmount,
      userAddress,
      slippageBps,
      validFor,
    });

    // Step 4: Format BTC output amount
    // Convert hex string to decimal string
    const btcOutputAmount = formatLotAmount(rfqQuote.to);

    // Step 5: Determine earliest expiration
    const cowswapExpiration = cowswapOrder.expiresAt;
    const rfqExpiration = new Date(rfqQuote.expires_at);
    const expiresAt = cowswapExpiration < rfqExpiration ? cowswapExpiration : rfqExpiration;

    console.log("Combined quote complete:", {
      sellToken,
      sellAmount,
      cbBTCAmount: cbBTCAmount,
      btcOutputAmount,
      expiresAt,
    });

    return {
      cowswapOrder,
      btcOutputAmount,
      rfqQuote,
      expiresAt,
    };
  } catch (error: unknown) {
    console.error("Failed to get ERC20 to BTC quote:", error);

    // Handle specific error types
    if (error instanceof CowSwapError) {
      toastError(error, {
        title: "CowSwap Quote Failed",
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
 * Poll CowSwap order status until filled or expired
 */
export async function pollCowSwapOrderStatus(
  orderUid: string,
  maxAttempts: number = 120, // 10 minutes with 5s intervals
  intervalMs: number = 5000
): Promise<"filled" | "expired" | "cancelled" | "unknown"> {
  const cowswapClient = createCowSwapClient();

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await cowswapClient.getOrderStatus(orderUid);

      console.log(`Order ${orderUid} status: ${status} (attempt ${i + 1}/${maxAttempts})`);

      // Check for terminal states
      if (status === "fulfilled" || status === "filled") {
        return "filled";
      }
      if (status === "expired") {
        return "expired";
      }
      if (status === "cancelled") {
        return "cancelled";
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error("Error polling order status:", error);
      // Continue polling even on errors
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return "unknown";
}
