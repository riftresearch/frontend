/**
 * Client for the Rift Orders API.
 * Fetches orders from https://api.rift.trade/orders with query param support.
 */

import { GLOBAL_CONFIG } from "./constants";

// ============================================================================
// Types
// ============================================================================

export type OrderStatus =
  | "unfilled"
  | "filled"
  | "cancelled"
  | "settled"
  | "refunded"
  | "failed";

export type OrderType = "market" | "limit";

export type CurrencyChain = {
  kind: string;
  chainId?: number;
};

export type CurrencyToken = {
  kind: string;
  address?: string;
  decimals: number;
};

export type Currency = {
  chain: CurrencyChain;
  token: CurrencyToken;
};

export type ExternalDexStatus = {
  provider: string;
  status: string;
};

export type TeeOtcStatus = {
  status: string;
};

export type TeeSwapperStatus = {
  status: string;
  orderStatus: string;
  refundState: string;
};

export type OrderItem = {
  orderId: string;
  routeType: string;
  orderType: string;
  provider: string;
  path: string[];
  status: OrderStatus;
  senderAddress: string;
  destinationAddress: string;
  refundAddress: string;
  otcSwapId: string | null;
  swapperSwapId: string | null;
  cowOrderUid: string | null;
  sellCurrency: Currency;
  buyCurrency: Currency;
  quoteMode: string;
  quotedSellAmount: string;
  quotedBuyAmount: string;
  quotedMinimumBuyAmount: string | null;
  quotedMaximumSellAmount: string | null;
  executedSellAmount: string | null;
  executedBuyAmount: string | null;
  executedFeeAmount: string | null;
  depositTxHash: string | null;
  payoutTxHash: string | null;
  refundTxHash: string | null;
  rawRouterJson: unknown;
  rawExternalDEXOrderJson: unknown;
  rawOtcJson: unknown;
  rawSwapperJson: unknown;
  externalDexStatus: ExternalDexStatus | null;
  teeOtcStatus: TeeOtcStatus | null;
  teeSwapperStatus: TeeSwapperStatus | null;
  createdAt: string;
  updatedAt: string;
  lastSourceUpdateAt: string | null;
  terminalAt: string | null;
};

export type OrdersResponse = {
  items: OrderItem[];
  nextCursor: string | null;
};

export type OrdersQueryParams = {
  sender?: string;
  destination?: string;
  refund?: string;
  orderType?: OrderType;
  status?: OrderStatus;
  limit?: number;
  cursor?: string;
};

// ============================================================================
// Helpers
// ============================================================================

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

function buildQueryString(params: OrdersQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.sender) {
    searchParams.set("sender", params.sender);
  }
  if (params.destination) {
    searchParams.set("destination", params.destination);
  }
  if (params.refund) {
    searchParams.set("refund", params.refund);
  }
  if (params.orderType) {
    searchParams.set("orderType", params.orderType);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch orders from the API with optional query params
 */
export async function getOrders(
  params: OrdersQueryParams = {}
): Promise<OrdersResponse> {
  const baseUrl = GLOBAL_CONFIG.riftApiUrl;
  const queryString = buildQueryString(params);
  const url = `${baseUrl}/orders${queryString}`;

  const apiKey = getApiKeyFromCookie();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error fetching orders:", errorText);

    if (response.status === 400) {
      throw new Error(`Invalid request: ${errorText}`);
    }
    if (response.status === 401) {
      throw new Error("Authentication failed. Please log in again.");
    }

    throw new Error(`Failed to fetch orders: ${response.status}`);
  }

  const data = await response.json();
  return data as OrdersResponse;
}

/**
 * Fetch all limit orders with pagination support.
 * Automatically fetches all pages using cursor-based pagination.
 */
export async function getAllLimitOrders(
  params: Omit<OrdersQueryParams, "orderType"> = {}
): Promise<OrderItem[]> {
  const allOrders: OrderItem[] = [];
  let cursor: string | undefined = undefined;

  const pageSize = params.limit || 50;

  do {
    const response = await getOrders({
      ...params,
      orderType: "limit",
      limit: pageSize,
      cursor,
    });

    allOrders.push(...response.items);
    cursor = response.nextCursor ?? undefined;
  } while (cursor);

  return allOrders;
}

/**
 * Fetch a single page of limit orders.
 * Returns the response with items and nextCursor for manual pagination.
 */
export async function getLimitOrders(
  params: Omit<OrdersQueryParams, "orderType"> = {}
): Promise<OrdersResponse> {
  return getOrders({
    ...params,
    orderType: "limit",
  });
}
