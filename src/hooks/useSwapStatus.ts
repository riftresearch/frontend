import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/utils/store";
import type { RiftSwap } from "@riftresearch/sdk";

// Re-export for consumers that import this type
export type { RiftSwap };

/**
 * Maps SDK chain format to the string format used by the rest of the app.
 * SDK: { kind: "BITCOIN" } | { kind: "EVM", chainId: number }
 * App: "bitcoin" | "ethereum" | "base" | "solana"
 */
function mapChain(chain: { kind: string; chainId?: number }): string {
  if (chain.kind === "BITCOIN") return "bitcoin";
  if (chain.kind === "EVM") {
    switch (chain.chainId) {
      case 1:
        return "ethereum";
      case 8453:
        return "base";
      default:
        return "ethereum";
    }
  }
  return "ethereum";
}

/**
 * Maps SDK token format to the old token format used by the rest of the app.
 * SDK: { kind: "NATIVE", decimals } | { kind: "TOKEN", address, decimals }
 * App: { type: "Native" } | { type: "Address", data: string }
 */
function mapToken(
  token: { kind: string; decimals: number; address?: string }
): { type: "Native" } | { type: "Address"; data: string } {
  if (token.kind === "TOKEN" && token.address) {
    return { type: "Address", data: token.address };
  }
  return { type: "Native" };
}

/**
 * Normalized swap status type that the rest of the app consumes.
 * Maps the Rift SDK's SwapStatusResponse into a shape compatible with existing components.
 */
export type NormalizedSwapStatus = {
  status:
    | "waiting_for_deposit"
    | "deposit_confirming"
    | "initiating_payout"
    | "confirming_payout"
    | "swap_complete"
    | "refunding_user"
    | "failed";
  quote: {
    from: {
      currency: {
        chain: string;
        token: { type: "Native" } | { type: "Address"; data: string };
        decimals: number;
      };
      amount: string;
    };
    to: {
      currency: {
        chain: string;
        token: { type: "Native" } | { type: "Address"; data: string };
        decimals: number;
      };
      amount: string;
    };
  };
  /** User deposit transaction hash (mapped from SDK depositTransaction) */
  depositTransaction?: string;
  /** MM payout transaction hash (mapped from SDK payoutTransaction) */
  payoutTransaction?: string;
  /** Destination address for the swap output */
  destinationAddress?: string;
  /** The raw SDK response for direct access if needed */
  _raw: RiftSwap;
};

/**
 * Maps the new AnalyticsOrderResponse status to the normalized status
 * used throughout the app. Uses tx hash presence to infer sub-states.
 */
function mapStatus(sdkResponse: RiftSwap): NormalizedSwapStatus["status"] {
  switch (sdkResponse.status) {
    case "unfilled":
      return sdkResponse.depositTxHash ? "deposit_confirming" : "waiting_for_deposit";
    case "filled":
      return sdkResponse.payoutTxHash ? "confirming_payout" : "initiating_payout";
    case "settled":
      return "swap_complete";
    case "refunded":
      return "refunding_user";
    case "cancelled":
    case "failed":
      return "failed";
  }
}

/**
 * Maps the Rift SDK AnalyticsOrderResponse into the normalized shape.
 */
function mapSdkResponse(sdkResponse: RiftSwap): NormalizedSwapStatus {
  const sellCurrency = sdkResponse.sellCurrency;
  const buyCurrency = sdkResponse.buyCurrency;

  return {
    status: mapStatus(sdkResponse),
    quote: {
      from: {
        currency: {
          chain: sellCurrency ? mapChain(sellCurrency.chain) : "ethereum",
          token: sellCurrency ? mapToken(sellCurrency.token) : { type: "Native" },
          decimals: sellCurrency?.token.decimals ?? 18,
        },
        amount: sdkResponse.quotedSellAmount ?? "0",
      },
      to: {
        currency: {
          chain: buyCurrency ? mapChain(buyCurrency.chain) : "bitcoin",
          token: buyCurrency ? mapToken(buyCurrency.token) : { type: "Native" },
          decimals: buyCurrency?.token.decimals ?? 8,
        },
        amount: sdkResponse.quotedBuyAmount ?? "0",
      },
    },
    depositTransaction: sdkResponse.depositTxHash ?? undefined,
    payoutTransaction: sdkResponse.payoutTxHash ?? undefined,
    destinationAddress: sdkResponse.destinationAddress ?? undefined,
    _raw: sdkResponse,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Polls the Rift SDK for swap status using sdk.getSwapStatus().
 * Returns a normalized response shape compatible with existing components.
 */
export function useSwapStatus(swapId: string | undefined) {
  const rift = useStore((state) => state.rift);
  const isValidId = !!swapId && UUID_RE.test(swapId);

  const query = useQuery<NormalizedSwapStatus>({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      if (!swapId || !isValidId) {
        throw new Error("No valid swap ID provided");
      }
      if (!rift) {
        throw new Error("Rift SDK not initialized");
      }
      const sdkResponse = await rift.getSwapStatus(swapId);
      return mapSdkResponse(sdkResponse);
    },
    enabled: isValidId && !!rift,
    refetchInterval: 2500,
    // Ensure polling continues even when tab is in background
    refetchIntervalInBackground: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
