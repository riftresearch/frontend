export type ChainType = "bitcoin" | "ethereum";

export type TokenIdentifier =
  | { type: "Native" }
  | { type: "Address"; data: string };

export type SwapStatus =
  | "pending_deposits"
  | "deposits_confirmed"
  | "settling"
  | "completed"
  | "failed"
  | "refunding"
  | "refunded";

export interface Currency {
  chain: ChainType;
  token: TokenIdentifier;
  amount?: string; // U256 as string
  decimals: number;
}

export interface Quote {
  id: string; // UUID
  market_maker_id: string; // UUID
  from: Currency;
  to: Currency;
  expires_at: string; // ISO 8601 datetime
  created_at: string; // ISO 8601 datetime
}

/**
 * Helper to create a currency object
 */
export const createCurrency = ({
  chain,
  decimals,
  tokenAddress,
  amount,
}: {
  chain: ChainType;
  decimals: number;
  tokenAddress?: string;
  amount?: string | number | bigint;
}): Currency => ({
  chain,
  token: tokenAddress
    ? { type: "Address", data: tokenAddress }
    : { type: "Native" },
  amount: amount?.toString(),
  decimals,
});

/**
 * Simple UUID v4 generator
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
