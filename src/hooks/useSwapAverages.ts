import { useQuery } from "@tanstack/react-query";

interface AverageData {
  count: number;
  averages: {
    amount_sats: number;
    amount_btc: string;
    amount_usd: string;
    protocol_fee_sats: number;
    protocol_fee_usd: string;
    network_fee_sats: number;
    network_fee_usd: string;
    liquidity_fee_sats: number;
    liquidity_fee_usd: string;
    time_created_to_user_sent_ms: number;
    time_user_sent_to_confs_ms: number;
    time_user_confs_to_mm_sent_ms: number;
    time_mm_sent_to_mm_confs_ms: number;
    time_full_ms: number;
    time_full_seconds: number;
  };
  updated_at: string;
}

interface SwapAveragesResponse {
  btc_to_eth: AverageData;
  eth_to_btc: AverageData;
  combined: AverageData;
}

const ANALYTICS_API_URL = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:8081";

async function fetchSwapAverages(): Promise<SwapAveragesResponse> {
  const response = await fetch(`${ANALYTICS_API_URL}/api/averages`);
  if (!response.ok) {
    throw new Error("Failed to fetch swap averages");
  }
  return response.json();
}

export function useSwapAverages(enabled: boolean = false) {
  return useQuery({
    queryKey: ["swap-averages"],
    queryFn: fetchSwapAverages,
    enabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute when enabled
  });
}
