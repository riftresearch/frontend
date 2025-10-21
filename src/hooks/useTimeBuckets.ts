import { useQuery } from "@tanstack/react-query";
import { ANALYTICS_API_URL } from "@/utils/analyticsClient";

// Bucket type configuration
export type BucketType =
  | "last_30_mins"
  | "last_hour"
  | "last_day"
  | "last_week"
  | "last_month"
  | "last_year"
  | "all_time";

// Time bucket configuration mapping
export const BUCKET_CONFIG: Record<BucketType, { chunk_size: number; window_size: number | null }> =
  {
    last_30_mins: { chunk_size: 60, window_size: 1800 }, // 1 min chunks, 30 min window
    last_hour: { chunk_size: 120, window_size: 3600 }, // 2 min chunks, 1 hour window
    last_day: { chunk_size: 3600, window_size: 86400 }, // 1 hour chunks, 24 hour window
    last_week: { chunk_size: 21600, window_size: 604800 }, // 6 hour chunks, 7 day window
    last_month: { chunk_size: 86400, window_size: 2592000 }, // 24 hour chunks, 30 day window
    last_year: { chunk_size: 864000, window_size: 31536000 }, // 10 day chunks, 365 day window
    all_time: { chunk_size: 864000, window_size: null }, // 10 day chunks, no pruning
  };

// Response types
interface TimeBucketChunk {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
  volume: number; // Volume in satoshis
  volume_usd: number; // Volume in USD
  swap_count: number;
}

interface TimeBucketsResponse {
  bucketType: BucketType;
  chunks: TimeBucketChunk[];
  totalVolume: number; // Total volume in satoshis
  totalVolumeUSD: number; // Total volume in USD (from backend)
  totalSwaps: number;
  chunkSize: number;
  windowSize: number | null;
}

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

/**
 * Fetch time bucket data from the analytics API
 */
async function fetchTimeBuckets(bucketType: BucketType): Promise<TimeBucketsResponse> {
  const apiKey = getApiKeyFromCookie();
  const url = `${ANALYTICS_API_URL}/api/time-buckets/${bucketType}`;

  console.log(`[useTimeBuckets] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[useTimeBuckets] Error response: ${response.status} - ${errorText}`);

    // Dynamic import to avoid circular dependency
    const { toastError } = await import("@/utils/toast");

    if (response.status === 401) {
      toastError(null, {
        title: "Authentication Failed",
        description: "Your session may have expired. Please log in again.",
      });
    } else {
      toastError(null, {
        title: "Failed to Fetch Volume Data",
        description: `Server returned ${response.status}. Please try again.`,
      });
    }

    throw new Error(`Failed to fetch time buckets: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[useTimeBuckets] Received ${data.chunks?.length || 0} chunks for ${bucketType}`);
  console.log("[useTimeBuckets] Full response:", data);
  console.log("[useTimeBuckets] totalVolume:", data.totalVolume);
  console.log("[useTimeBuckets] total_volume_usd:", data.total_volume_usd);
  console.log("[useTimeBuckets] totalVolumeUSD:", data.totalVolumeUSD);
  console.log("[useTimeBuckets] totalVolumeUsd:", data.totalVolumeUsd);
  return data;
}

/**
 * Hook to fetch and manage time bucket data for volume charts
 */
export function useTimeBuckets(bucketType: BucketType) {
  const query = useQuery({
    queryKey: ["timeBuckets", bucketType],
    queryFn: () => fetchTimeBuckets(bucketType),
    refetchInterval: 60000, // Refetch every 60 seconds (manual refetch on swap completion provides real-time updates)
    retry: 2,
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  // Transform the data for chart consumption
  const chartData =
    query.data?.chunks.map((chunk) => ({
      time: chunk.start * 1000, // Convert to milliseconds
      label: formatChunkLabel(chunk.start * 1000, bucketType),
      volume: chunk.volume, // Keep in satoshis
      volumeUsd: chunk.volume_usd, // Use backend-calculated USD
      txns: chunk.swap_count,
      txnsNormalized: 0, // Will be calculated in the component
    })) || [];

  // Calculate max values for scaling
  const maxVolume = Math.max(1, ...chartData.map((d) => d.volume));
  const maxVolumeUsd = Math.max(1, ...chartData.map((d) => d.volumeUsd));
  const maxTxns = Math.max(1, ...chartData.map((d) => d.txns));

  return {
    points: chartData,
    totalVolume: query.data?.totalVolume || 0,
    totalVolumeUsd: query.data?.totalVolumeUSD || 0,
    totalTxns: query.data?.totalSwaps || 0,
    maxVolume,
    maxVolumeUsd,
    maxTxns,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Format chunk label based on bucket type
 */
function formatChunkLabel(timestamp: number, bucketType: BucketType): string {
  const d = new Date(timestamp);
  const two = (n: number) => n.toString().padStart(2, "0");

  switch (bucketType) {
    case "last_30_mins":
    case "last_hour":
      // Show time for minute/hour views
      return `${two(d.getHours())}:${two(d.getMinutes())}`;

    case "last_day":
      // Show hour for day view
      return `${two(d.getHours())}:00`;

    case "last_week":
      // Show day and hour for week view
      return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:00`;

    case "last_month":
    case "last_year":
    case "all_time":
      // Show date for longer views
      return `${d.getMonth() + 1}/${d.getDate()}`;

    default:
      return d.toLocaleDateString();
  }
}
