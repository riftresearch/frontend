import { satsToBtc } from "./swapHelpers";
import { AdminSwapFlowStep, AdminSwapItem, SwapDirection, AnalyticsSwapData } from "./types";

export type AnalyticsPagination = {
  total: number;
  limit: number;
  offset: number;
};

export type AnalyticsSwapsResponse<TSwap = any> = {
  swaps: TSwap[];
  pagination: AnalyticsPagination;
};

const DEFAULT_API_URL = "http://localhost:3000";

export const ANALYTICS_API_URL = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || DEFAULT_API_URL;

/**
 * Get admin API key from cookies
 */
function getApiKeyFromCookie(): string {
  if (typeof document === "undefined") {
    return "";
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "admin_api_key") {
      return value;
    }
  }

  return "";
}

export async function getSwaps(
  page: number = 0,
  pageSize: number = 10,
  filter?: "all" | "completed" | "in-progress" | "created" | "failed"
): Promise<AnalyticsSwapsResponse> {
  try {
    const offset = page * pageSize;
    let url = `${ANALYTICS_API_URL}/api/swaps?limit=${pageSize}&offset=${offset}`;

    // Add filter parameter if specified
    if (filter && filter !== "all") {
      const status = filter === "in-progress" ? "in_progress" : filter;
      url += `&status=${status}`;
    }

    const apiKey = getApiKeyFromCookie();

    console.log("url", url);
    console.log("API Key from cookie:", apiKey ? "***" + apiKey.slice(-4) : "NOT SET");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // console.log("response", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response body:", errorText);

      // Dynamic import to avoid circular dependency
      const { toastError } = await import("./toast");

      if (response.status === 401) {
        toastError(null, {
          title: "Authentication Failed",
          description: "Your session may have expired. Please log in again.",
        });
      } else if (response.status === 404) {
        toastError(null, {
          title: "Analytics Server Error",
          description: "Swaps endpoint not found. Please contact support.",
        });
      } else {
        toastError(null, {
          title: "Failed to Fetch Swaps",
          description: `Server returned ${response.status}. Please try again.`,
        });
      }

      throw new Error(`Failed to fetch swaps: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // console.log("Swaps data received:", JSON.stringify(data, null, 2));

    return data;
  } catch (error: any) {
    // Handle network errors
    if (error.message && !error.message.includes("Failed to fetch swaps")) {
      const { toastError } = await import("./toast");
      toastError(null, {
        title: "Network Error",
        description: "Could not connect to analytics server. Please check your connection.",
      });
    }

    throw error;
  }
}

/**
 * Get a single swap by ID
 */
export async function getSwap(swapId: string): Promise<AnalyticsSwapData> {
  try {
    const url = `${ANALYTICS_API_URL}/api/swap/${swapId}`;
    const apiKey = getApiKeyFromCookie();

    console.log("Fetching swap:", swapId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response body:", errorText);

      // Dynamic import to avoid circular dependency
      const { toastError } = await import("./toast");

      if (response.status === 401) {
        toastError(null, {
          title: "Authentication Failed",
          description: "Your session may have expired. Please log in again.",
        });
      } else if (response.status === 404) {
        toastError(null, {
          title: "Swap Not Found",
          description: "The swap you're looking for does not exist.",
        });
      } else {
        toastError(null, {
          title: "Failed to Fetch Swap",
          description: `Server returned ${response.status}. Please try again.`,
        });
      }

      throw new Error(`Failed to fetch swap: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Swap data received:", data.swap);

    return data.swap;
  } catch (error: any) {
    // Handle network errors
    if (error.message && !error.message.includes("Failed to fetch swap")) {
      const { toastError } = await import("./toast");
      toastError(null, {
        title: "Network Error",
        description: "Could not connect to analytics server. Please check your connection.",
      });
    }

    throw error;
  }
}

export function formatDuration(startMs: number, endMs: number): string {
  const diffSeconds = Math.floor((endMs - startMs) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function mapDbRowToAdminSwap(row: any): AdminSwapItem {
  // [0] Parse created_at timestamp and BTC price at swap time
  const createdAtMs = new Date(row.created_at).getTime();
  const btcPriceUsd = row.bitcoin_usd_at_swap_time || 0;

  // [1] Determine swap direction from quote.from_chain (defaults to EVM_TO_BTC)
  let direction: SwapDirection = "EVM_TO_BTC";
  console.log("row.quote?.from_chain", row.quote?.from_chain);
  if (row.quote?.from_chain) {
    direction =
      row.quote.from_chain === "bitcoin"
        ? "BTC_TO_EVM"
        : row.quote.from_chain === "ethereum"
          ? "EVM_TO_BTC"
          : "UNKNOWN";
  } else {
    console.log("⚠️ No quote.from_chain, not defaulting");
    direction = "UNKNOWN";
  }

  // [2] Define status order and find current step index
  const status: string = (row.status || "pending") as string;
  const order: Array<AdminSwapFlowStep["status"]> = [
    "pending",
    "waiting_user_deposit_initiated",
    "waiting_user_deposit_confirmed",
    "waiting_mm_deposit_initiated",
    "waiting_mm_deposit_confirmed",
    "settled",
  ];
  const currentIndex = Math.max(0, order.indexOf(status as any));
  const userConfs = Number(row?.user_deposit_status?.confirmations || 0);
  const mmConfs = Number(row?.mm_deposit_status?.confirmations || 0);

  // [3] Parse timestamps for duration calculations
  const createdAt = createdAtMs;
  const userDepositDetectedAt = row?.user_deposit_status?.deposit_detected_at
    ? new Date(row.user_deposit_status.deposit_detected_at).getTime()
    : null;
  const userConfirmedAt = row?.user_deposit_status?.confirmed_at
    ? new Date(row.user_deposit_status.confirmed_at).getTime()
    : null;
  const mmDepositDetectedAt = row?.mm_deposit_status?.deposit_detected_at
    ? new Date(row.mm_deposit_status.deposit_detected_at).getTime()
    : null;
  const mmPrivateKeySentAt = row?.mm_private_key_sent_at
    ? new Date(row.mm_private_key_sent_at).getTime()
    : null;

  // [4] Calculate duration between each swap step
  const durationCreatedToUserSent =
    userDepositDetectedAt && createdAt
      ? formatDuration(createdAt, userDepositDetectedAt)
      : undefined;
  const durationUserSentToConfs =
    userConfirmedAt && userDepositDetectedAt
      ? formatDuration(userDepositDetectedAt, userConfirmedAt)
      : undefined;
  const durationUserConfsToMmSent =
    mmDepositDetectedAt && userConfirmedAt
      ? formatDuration(userConfirmedAt, mmDepositDetectedAt)
      : undefined;
  const durationMmSentToMmConfs =
    mmPrivateKeySentAt && mmDepositDetectedAt
      ? formatDuration(mmDepositDetectedAt, mmPrivateKeySentAt)
      : undefined;

  // [5] Extract transaction hashes
  const userTxHash = row?.user_deposit_status?.tx_hash;
  const mmTxHash = row?.mm_deposit_status?.tx_hash;

  // [6] Extract hex amounts from deposit status
  const userDepositAmountHex = row?.user_deposit_status?.amount || "0x0";
  // const mmDepositAmountHex = row?.mm_deposit_status?.amount || "0x0";

  // [7] Convert hex amounts to BTC decimals (8 decimals for cbBTC/BTC)
  const userDepositAmountBtc = parseFloat(satsToBtc(parseInt(userDepositAmountHex)));
  // const mmDepositAmountBtc = parseFloat(satsToBtc(parseInt(mmDepositAmountHex)));

  // console.log("💰 Amounts & data:", {
  //   userDepositAmountBtc,
  //   mmDepositAmountBtc,
  //   direction: direction,
  // });

  // [8] Calculate swap amounts in BTC and USD
  // If no user deposit yet, fall back to quote from_amount (which is the intended swap amount)
  let swapAmountBtc = userDepositAmountBtc || 0;
  if (swapAmountBtc === 0 && row.quote?.from_amount && row.quote?.from_decimals) {
    // from_amount is in the smallest unit (e.g., sats), convert to BTC
    swapAmountBtc = parseFloat(satsToBtc(parseInt(row.quote.from_amount)));
  }
  const swapAmountUsd = btcPriceUsd !== undefined ? swapAmountBtc * btcPriceUsd : 0;

  // [9] Extract fees from quote.fee_schedule (in sats)
  const protocolFeeSats = row.quote?.fee_schedule?.protocol_fee_sats || 0;
  const liquidityFeeSats = row.quote?.fee_schedule?.liquidity_fee_sats || 0;
  const networkFeeSats = row.quote?.fee_schedule?.network_fee_sats || 0;

  // [10] Convert fees to BTC and USD
  const riftFeeSats = protocolFeeSats;
  const mmFeeBtc = parseFloat(satsToBtc(liquidityFeeSats));
  const mmFeeUsd = btcPriceUsd !== undefined ? mmFeeBtc * btcPriceUsd : 0;
  const networkFeeBtc = parseFloat(satsToBtc(networkFeeSats));
  const networkFeeUsd = btcPriceUsd !== undefined ? networkFeeBtc * btcPriceUsd : 0;

  // [10] Parse start_asset metadata FIRST (for EVM->BTC swaps) so we can use it for asset badges
  let startAssetMetadata = undefined;
  const startAssetString = row.metadata?.start_asset || row.start_asset;

  if (startAssetString && typeof startAssetString === "string") {
    try {
      const parsed = JSON.parse(startAssetString);
      if (parsed && typeof parsed === "object") {
        startAssetMetadata = {
          ticker: parsed.ticker || "",
          address: parsed.address || "",
          icon: parsed.icon,
          amount: parsed.amount || "0",
          decimals: parsed.decimals || 18,
        };
      }
    } catch (e) {
      console.warn("Failed to parse start_asset metadata:", e);
    }
  }

  // [11] Determine asset types and chains based on swap direction
  // Use metadata ticker for EVM->BTC swaps if available
  let userAsset: string =
    direction === "BTC_TO_EVM" ? "BTC" : startAssetMetadata?.ticker || "cbBTC";
  let userAssetIconUrl: string | undefined =
    direction === "EVM_TO_BTC" ? startAssetMetadata?.icon : undefined;
  const mmAsset: string = direction === "BTC_TO_EVM" ? "cbBTC" : "BTC";
  const userTxChain: "ETH" | "BTC" = direction === "BTC_TO_EVM" ? "BTC" : "ETH";
  const mmTxChain: "ETH" | "BTC" = direction === "BTC_TO_EVM" ? "ETH" : "BTC";

  // [12] Format confirmation labels (cbBTC caps at 4+, BTC caps at 2+)
  const userConfsLabel =
    userAsset === "cbBTC"
      ? userConfs >= 4
        ? "4+ Confs"
        : `${userConfs} Confs`
      : userConfs >= 2
        ? "2+ Confs"
        : `${userConfs} Confs`;
  const mmConfsLabel =
    mmAsset === "cbBTC"
      ? mmConfs >= 4
        ? "4+ Confs"
        : `${mmConfs} Confs`
      : mmConfs >= 2
        ? "2+ Confs"
        : `${mmConfs} Confs`;

  // [13] Build flow steps array with state, duration, and transaction data
  const steps: AdminSwapFlowStep[] = [
    {
      status: "pending",
      label: "Created",
      state: currentIndex > 0 ? "completed" : "inProgress",
    },
    {
      status: "waiting_user_deposit_initiated",
      label: "User Sent",
      state: currentIndex > 1 ? "completed" : currentIndex === 1 ? "inProgress" : "notStarted",
      badge: userAsset,
      badgeIconUrl: userAssetIconUrl,
      duration: durationCreatedToUserSent,
      txHash: userTxHash,
      txChain: userTxChain,
    },
    {
      status: "waiting_user_deposit_confirmed",
      label: userConfsLabel,
      state: currentIndex > 2 ? "completed" : currentIndex === 2 ? "inProgress" : "notStarted",
      duration: durationUserSentToConfs,
    },
    {
      status: "waiting_mm_deposit_initiated",
      label: "MM Sent",
      state: currentIndex > 3 ? "completed" : currentIndex === 3 ? "inProgress" : "notStarted",
      badge: mmAsset,
      duration: durationUserConfsToMmSent,
      txHash: mmTxHash,
      txChain: mmTxChain,
    },
    {
      status: "waiting_mm_deposit_confirmed",
      label: mmConfsLabel,
      state: currentIndex > 4 ? "completed" : currentIndex === 4 ? "inProgress" : "notStarted",
      duration: durationMmSentToMmConfs,
    },
    {
      status: "settled",
      label: "Settled",
      state: currentIndex >= 5 ? "completed" : "notStarted",
    },
  ];

  // [14] Determine EVM chain (ETH or BASE) from quote.to_chain
  const evmChain: "ETH" | "BASE" = row.quote?.to_chain === "base" ? "BASE" : "ETH";

  // [15] Return complete AdminSwapItem with all calculated data
  return {
    statusTesting: status,
    id: row.id,
    swapCreationTimestamp: createdAtMs,
    evmAccountAddress:
      row.user_evm_account_address ||
      row.user_deposit_address ||
      "0x0000000000000000000000000000000000000000",
    chain: evmChain,
    direction,
    swapInitialAmountBtc: swapAmountBtc,
    swapInitialAmountUsd: swapAmountUsd,
    riftFeeSats,
    userConfs,
    mmConfs,
    networkFeeUsd,
    mmFeeUsd,
    flow: steps,
    stepTimestamps: {
      created: createdAtMs,
      userDepositDetected: userDepositDetectedAt || undefined,
      userConfirmed: userConfirmedAt || undefined,
      mmDepositDetected: mmDepositDetectedAt || undefined,
      mmPrivateKeySent: mmPrivateKeySentAt || undefined,
    },
    startAssetMetadata,
    rawData: row,
  };
}
