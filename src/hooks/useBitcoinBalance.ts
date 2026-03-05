/**
 * Hook for fetching Bitcoin wallet balance using Esplora API
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchUserUtxos, getUtxoBalance } from "@/utils/bitcoinTransactionHelpers";

/**
 * Basic validation for Bitcoin address format
 * Returns true if the address looks like a valid Bitcoin address
 */
function isValidBitcoinAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Trim whitespace
  const trimmed = address.trim();
  if (trimmed.length === 0) return false;

  // Check for valid Bitcoin address prefixes
  // P2PKH (legacy): starts with 1, length 25-34
  // P2SH: starts with 3, length 25-34
  // Bech32 (native segwit): starts with bc1, length 42-62
  // Bech32m (taproot): starts with bc1p, length 62
  if (trimmed.startsWith("1") || trimmed.startsWith("3")) {
    return trimmed.length >= 25 && trimmed.length <= 34;
  }
  if (trimmed.startsWith("bc1")) {
    return trimmed.length >= 42 && trimmed.length <= 62;
  }
  // Testnet addresses (for development)
  if (trimmed.startsWith("m") || trimmed.startsWith("n") || trimmed.startsWith("2")) {
    return trimmed.length >= 25 && trimmed.length <= 34;
  }
  if (trimmed.startsWith("tb1")) {
    return trimmed.length >= 42 && trimmed.length <= 62;
  }

  return false;
}

export interface UseBitcoinBalanceResult {
  /** Balance in satoshis */
  balanceSats: number;
  /** Balance in BTC (sats / 100,000,000) */
  balanceBtc: number;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a refetch */
  refetch: () => void;
}

const SATS_PER_BTC = 100_000_000;
const REFRESH_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Fetch and track Bitcoin balance for a given address
 * @param address - Bitcoin address to fetch balance for (null to skip fetching)
 * @returns Balance info, loading state, and refetch function
 */
export function useBitcoinBalance(address: string | null): UseBitcoinBalanceResult {
  const [balanceSats, setBalanceSats] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);
  // Track the current address to handle rapid changes
  const currentAddressRef = useRef<string | null>(address);

  const fetchBalance = useCallback(async (addr: string) => {
    if (!addr) return;

    // Validate address format before making API call
    if (!isValidBitcoinAddress(addr)) {
      console.warn("Invalid Bitcoin address format, skipping fetch:", addr);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const utxos = await fetchUserUtxos(addr);
      const balance = getUtxoBalance(utxos);

      // Only update state if still mounted and address hasn't changed
      if (isMountedRef.current && currentAddressRef.current === addr) {
        setBalanceSats(balance);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch Bitcoin balance:", err);
      if (isMountedRef.current && currentAddressRef.current === addr) {
        setError(err instanceof Error ? err.message : "Failed to fetch balance");
        // Don't reset balance on error - keep showing last known balance
      }
    } finally {
      if (isMountedRef.current && currentAddressRef.current === addr) {
        setIsLoading(false);
      }
    }
  }, []);

  // Manual refetch function
  const refetch = useCallback(() => {
    if (address) {
      fetchBalance(address);
    }
  }, [address, fetchBalance]);

  // Fetch balance when address changes
  useEffect(() => {
    currentAddressRef.current = address;

    if (!address) {
      setBalanceSats(0);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchBalance(address);

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (currentAddressRef.current === address) {
        fetchBalance(address);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [address, fetchBalance]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    balanceSats,
    balanceBtc: balanceSats / SATS_PER_BTC,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch balances for multiple Bitcoin addresses
 * Useful for WalletPanel where we need to show balance for each BTC wallet
 */
export function useBitcoinBalances(addresses: string[]): Record<string, UseBitcoinBalanceResult> {
  const [balances, setBalances] = useState<
    Record<string, { sats: number; loading: boolean; error: string | null }>
  >({});
  const isMountedRef = useRef(true);

  const fetchAllBalances = useCallback(async () => {
    if (addresses.length === 0) return;

    // Filter out invalid addresses
    const validAddresses = addresses.filter((addr) => isValidBitcoinAddress(addr));
    if (validAddresses.length === 0) {
      console.warn("No valid Bitcoin addresses to fetch balances for");
      return;
    }

    // Initialize loading states
    const initialState: Record<string, { sats: number; loading: boolean; error: string | null }> =
      {};
    validAddresses.forEach((addr) => {
      initialState[addr] = { sats: balances[addr]?.sats ?? 0, loading: true, error: null };
    });
    setBalances(initialState);

    // Fetch all balances in parallel
    const results = await Promise.all(
      validAddresses.map(async (addr) => {
        try {
          const utxos = await fetchUserUtxos(addr);
          const balance = getUtxoBalance(utxos);
          return { addr, sats: balance, error: null };
        } catch (err) {
          console.error(`Failed to fetch balance for ${addr}:`, err);
          return { addr, sats: 0, error: err instanceof Error ? err.message : "Failed to fetch" };
        }
      })
    );

    if (!isMountedRef.current) return;

    // Update state with results
    const newBalances: Record<string, { sats: number; loading: boolean; error: string | null }> =
      {};
    results.forEach(({ addr, sats, error }) => {
      newBalances[addr] = { sats, loading: false, error };
    });
    setBalances(newBalances);
  }, [addresses.join(",")]); // Re-run when addresses array changes

  useEffect(() => {
    isMountedRef.current = true;
    fetchAllBalances();

    const intervalId = setInterval(fetchAllBalances, REFRESH_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchAllBalances]);

  // Build result object
  const result: Record<string, UseBitcoinBalanceResult> = {};
  addresses.forEach((addr) => {
    const data = balances[addr] || { sats: 0, loading: false, error: null };
    result[addr] = {
      balanceSats: data.sats,
      balanceBtc: data.sats / SATS_PER_BTC,
      isLoading: data.loading,
      error: data.error,
      refetch: fetchAllBalances,
    };
  });

  return result;
}
