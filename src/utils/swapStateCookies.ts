/**
 * Utility functions for persisting swap state in browser cookies
 * This allows the swap interface to remember the user's token selections
 * and swap direction across page refreshes.
 */

import { TokenData } from "./types";

const SWAP_STATE_COOKIE = "rift_swap_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export interface SwapStateCookie {
  /** Whether user is swapping TO BTC (true) or FROM BTC (false) */
  isSwappingForBTC: boolean;
  /** Selected input token data */
  selectedInputToken: TokenData | null;
  /** Selected output token data */
  selectedOutputToken: TokenData | null;
  /** Timestamp when state was saved */
  savedAt: number;
}

/**
 * Save current swap state to cookies
 */
export function saveSwapStateToCookie(state: Omit<SwapStateCookie, "savedAt">): void {
  if (typeof document === "undefined") return;

  try {
    const cookieData: SwapStateCookie = {
      ...state,
      savedAt: Date.now(),
    };

    // Serialize to JSON and encode for safe cookie storage
    const serialized = encodeURIComponent(JSON.stringify(cookieData));

    // Set cookie with 30 day expiry
    document.cookie = `${SWAP_STATE_COOKIE}=${serialized}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch (error) {
    console.error("Failed to save swap state to cookie:", error);
  }
}

/**
 * Load swap state from cookies
 * Returns null if no state exists or if state is invalid/expired
 */
export function loadSwapStateFromCookie(): SwapStateCookie | null {
  if (typeof document === "undefined") return null;

  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === SWAP_STATE_COOKIE && value) {
        // Decode and parse JSON
        const decoded = decodeURIComponent(value);
        const parsed = JSON.parse(decoded) as SwapStateCookie;

        // Validate the structure
        if (typeof parsed.isSwappingForBTC === "boolean" && typeof parsed.savedAt === "number") {
          // Optional: Check if state is too old (e.g., > 30 days)
          const daysSinceSaved = (Date.now() - parsed.savedAt) / (1000 * 60 * 60 * 24);
          if (daysSinceSaved > 30) {
            // State is stale, clear it
            clearSwapStateCookie();
            return null;
          }

          return parsed;
        }
      }
    }
  } catch (error) {
    console.error("Failed to load swap state from cookie:", error);
  }

  return null;
}

/**
 * Clear swap state from cookies
 */
export function clearSwapStateCookie(): void {
  if (typeof document === "undefined") return;

  document.cookie = `${SWAP_STATE_COOKIE}=; path=/; max-age=0`;
}

/**
 * Check if swap state exists in cookies
 */
export function hasSwapStateCookie(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name] = cookie.trim().split("=");
    if (name === SWAP_STATE_COOKIE) {
      return true;
    }
  }

  return false;
}
