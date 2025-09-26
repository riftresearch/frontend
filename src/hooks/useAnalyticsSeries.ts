import { useMemo } from "react";
import raw from "@/data/minute_analytics.json";

type Timeframe = "1h" | "1d" | "1m" | "3m" | "1y" | "all";

interface SeriesPoint {
  time: number; // unix ms
  volumeUsd: number;
  txns: number;
}

export function useAnalyticsSeries(timeframe: Timeframe) {
  const data = raw as unknown as {
    start: string;
    intervalMinutes: number;
    volumeUsd: number[];
    txns: number[];
  };

  return useMemo(() => {
    const startMs = new Date(data.start).getTime();
    const stepMs = data.intervalMinutes * 60 * 1000;

    const points: SeriesPoint[] = data.volumeUsd.map((v, i) => ({
      time: startMs + i * stepMs,
      volumeUsd: v,
      txns: data.txns[i] ?? 0,
    }));

    // Helper to slice by timeframe
    const now = points.at(-1)?.time ?? startMs;
    const ranges: Record<Timeframe, number> = {
      "1h": 60,
      "1d": 1440,
      "1m": 43200, // 30d approx
      "3m": 129600, // 90d
      "1y": 525600, // 365d
      all: Infinity,
    };

    const minutes = ranges[timeframe];
    const fromTime =
      minutes === Infinity ? -Infinity : now - minutes * 60 * 1000;
    const sliced = points.filter((p) => p.time >= fromTime);

    // Bucket size per timeframe (in minutes)
    const bucketMinutesMap: Record<Timeframe, number> = {
      "1h": 1, // minute bars
      "1d": 30, // 30-minute bars
      "1m": 1440, // daily bars (30)
      "3m": 1440, // daily bars (90)
      "1y": 10080, // weekly bars (~52)
      all: 1440, // daily bars
    };
    const bucketMs = bucketMinutesMap[timeframe] * 60 * 1000;

    // Aggregate into fixed-size buckets to avoid partial leading buckets inflating the count
    const bucketCount = (() => {
      if (minutes === Infinity) {
        const first = points[0]?.time ?? now;
        return Math.max(1, Math.ceil((now - first) / bucketMs));
      }
      return Math.max(1, Math.ceil(minutes / bucketMinutesMap[timeframe]));
    })();

    const alignedFrom =
      minutes === Infinity
        ? Math.floor((points[0]?.time ?? now) / bucketMs) * bucketMs
        : now - minutes * 60 * 1000;

    const bucketed: SeriesPoint[] = new Array(bucketCount)
      .fill(null)
      .map((_, i) => {
        const startT = alignedFrom + i * bucketMs;
        const endT = startT + bucketMs;
        let vol = 0;
        let tx = 0;
        for (let j = 0; j < sliced.length; j++) {
          const t = sliced[j].time;
          if (t >= startT && t < endT) {
            vol += sliced[j].volumeUsd;
            tx += sliced[j].txns;
          }
        }
        return { time: startT, volumeUsd: vol, txns: tx };
      })
      .filter((b) => b.volumeUsd > 0 || b.txns > 0);

    // Aggregations
    const totalVolume = bucketed.reduce((a, b) => a + b.volumeUsd, 0);
    const totalTxns = bucketed.reduce((a, b) => a + b.txns, 0);

    // Normalize txn bar heights so tallest txn is never more than 1/5th of max volume
    const maxVolume = Math.max(1, ...bucketed.map((p) => p.volumeUsd));
    const maxTxns = Math.max(1, ...bucketed.map((p) => p.txns));
    const txnScale = (0.2 * maxVolume) / maxTxns; // scale to 1/5th (20%) of max volume

    const normalized = bucketed.map((p) => ({
      ...p,
      txnsNormalized: p.txns * txnScale,
    }));

    return {
      points: normalized,
      totalVolume,
      totalTxns,
      maxVolume,
      maxTxns,
    };
  }, [timeframe]);
}

export type { Timeframe };
