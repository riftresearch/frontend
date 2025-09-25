import { create } from "zustand";

// Defaults mirror pattern from src/utils/store.ts

export const useAnalyticsStore = create<{
  totalVolume: number;
  setTotalVolume: (value: number) => void;
  totalFeesCollected: number;
  setTotalFeesCollected: (value: number) => void;
  totalSwaps: number;
  setTotalSwaps: (value: number) => void;
  totalUsers: number;
  setTotalUsers: (value: number) => void;
}>((set) => ({
  totalVolume: 43243243224,
  setTotalVolume: (value: number) => set({ totalVolume: value }),
  totalFeesCollected: 43243243,
  setTotalFeesCollected: (value: number) => set({ totalFeesCollected: value }),
  totalSwaps: 14203,
  setTotalSwaps: (value: number) => set({ totalSwaps: value }),
  totalUsers: 2382,
  setTotalUsers: (value: number) => set({ totalUsers: value }),
}));
