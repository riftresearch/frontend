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
 * Maps the Rift SDK SwapStatusResponse into the normalized shape.
 */
function mapSdkResponse(sdkResponse: RiftSwap): NormalizedSwapStatus {
  return {
    status: sdkResponse.status,
    quote: {
      from: {
        currency: {
          chain: mapChain(sdkResponse.quote.from.currency.chain as any),
          token: mapToken(sdkResponse.quote.from.currency.token as any),
          decimals: (sdkResponse.quote.from.currency.token as any).decimals ?? 18,
        },
        amount: sdkResponse.quote.from.expected,
      },
      to: {
        currency: {
          chain: mapChain(sdkResponse.quote.to.currency.chain as any),
          token: mapToken(sdkResponse.quote.to.currency.token as any),
          decimals: (sdkResponse.quote.to.currency.token as any).decimals ?? 8,
        },
        amount: sdkResponse.quote.to.expected,
      },
    },
    depositTransaction: sdkResponse.depositTransaction,
    payoutTransaction: sdkResponse.payoutTransaction,
    destinationAddress: sdkResponse.destinationAddress,
    _raw: sdkResponse,
  };
}

/**
 * Polls the Rift SDK for swap status using sdk.getSwapStatus().
 * Returns a normalized response shape compatible with existing components.
 */
export function useSwapStatus(swapId: string | undefined) {
  const rift = useStore((state) => state.rift);

  console.log("[useSwapStatus] swapId:", swapId, "rift:", rift ? "initialized" : "null");

  const query = useQuery<NormalizedSwapStatus>({
    queryKey: ["swap", swapId],
    queryFn: async () => {
      if (!swapId) {
        throw new Error("No swap ID provided");
      }
      if (!rift) {
        throw new Error("Rift SDK not initialized");
      }
      console.log("[useSwapStatus] Calling rift.getSwapStatus for:", swapId);
      try {
        const sdkResponse = await rift.getSwapStatus(swapId);
        console.log("[useSwapStatus] SDK raw response:", sdkResponse);
        const normalized = mapSdkResponse(sdkResponse);
        console.log("[useSwapStatus] Normalized response:", normalized);
        return normalized;
      } catch (err) {
        console.error("[useSwapStatus] SDK error:", err);
        throw err;
      }
    },
    enabled: !!swapId && !!rift,
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
