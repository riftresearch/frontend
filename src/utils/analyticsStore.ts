import { create } from "zustand";
import {
  AdminSwapItem,
  SwapDirection,
  MarketMaker,
  ErrorLogItem,
} from "./types";

function randomHex(len: number) {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// FOR TESTING ONLY, GENERATE DUMMY SWAPS
// function generateDummyAdminSwaps(count: number): AdminSwapItem[] {
//   const now = Date.now();
//   const list: AdminSwapItem[] = [];
//   const btcPriceUsd = 64000; // rough price for fake data conversion
//   for (let i = 0; i < count; i++) {
//     const minutesAgo = i * 7 + Math.floor(Math.random() * 5); // staggered
//     // Generate a random USD amount between $20 and $10,000,000
//     const usd = Math.floor(Math.random() * (10_000_000 - 20 + 1)) + 20;
//     const btc = usd / btcPriceUsd;
//     const riftFeeBtc = btc * 0.01; // 1% fee
//     const networkFeeUsd = Number((1 + Math.random() * 5).toFixed(2));
//     const mmFeeUsd = Number((3 + Math.random() * 10).toFixed(2));
//     const userBadge = i % 2 === 0 ? "cbBTC" : "BTC"; // alternate direction
//     const mmBadge = userBadge === "cbBTC" ? "BTC" : "cbBTC";
//     const chain = i % 3 === 0 ? "ETH" : "BASE"; // mix between ETH and BASE

//     // Direction mapping: user sends cbBTC (EVM asset) => EVM_TO_BTC; user sends BTC => BTC_TO_EVM
//     const direction: SwapDirection =
//       userBadge === "cbBTC" ? "EVM_TO_BTC" : "BTC_TO_EVM";

//     // Step definitions in order
//     const stepsBase: Array<{
//       kind:
//         | "swap_created"
//         | "user_sent"
//         | "user_confs"
//         | "mm_sent"
//         | "mm_confs"
//         | "settled";
//       label: string;
//       badge?: "BTC" | "cbBTC";
//     }> = [
//       { kind: "swap_created", label: "Swap Created" },
//       { kind: "user_sent", label: "User Sent", badge: userBadge },
//       { kind: "user_confs", label: `${2 + (i % 3)} Confs` },
//       { kind: "mm_sent", label: "MM Sent", badge: mmBadge },
//       { kind: "mm_confs", label: `${2 + (i % 3)}+ Confs` },
//       { kind: "settled", label: "Settled" },
//     ];

//     const maxIndex = stepsBase.length - 1; // include settled
//     let completedCount = (i % 4) + 2; // 2..5 completed including settled sometimes
//     if (completedCount > maxIndex) completedCount = maxIndex; // cap

//     const inProgressIndex = completedCount < maxIndex ? completedCount : -1;

//     const flow = stepsBase.map((s, idx) => {
//       let state: "notStarted" | "inProgress" | "completed" = "notStarted";
//       if (idx < completedCount) state = "completed";
//       else if (idx === inProgressIndex) state = "inProgress";
//       const duration =
//         state === "completed"
//           ? `${Math.floor(Math.random() * 2)}:${(
//               10 + Math.floor(Math.random() * 50)
//             )
//               .toString()
//               .padStart(2, "0")}`
//           : undefined;
//       return {
//         kind: s.kind,
//         label: s.label,
//         duration,
//         badge: s.badge,
//         state,
//       } as any;
//     });

//     list.push({
//       id: `swap_${i + 1}`,
//       swapCreationTimestamp: now - minutesAgo * 60 * 1000,
//       evmAccountAddress: `0x${randomHex(40)}`,
//       chain,
//       direction,
//       swapInitialAmountUsd: usd,
//       swapInitialAmountBtc: btc,
//       riftFeeBtc,
//       networkFeeUsd,
//       mmFeeUsd,
//       flow,
//     });
//   }
//   return list.sort((a, b) => b.swapCreationTimestamp - a.swapCreationTimestamp);
// }

function generateDummyMMs(): MarketMaker[] {
  return [
    {
      mmName: "Rift MM Alpha",
      currentEthBalance: 134.2183,
      currentCbbtcBalance: 14.478334,
      currentBtcBalance: 13.478334,
    },
    {
      mmName: "Rift MM Beta",
      currentEthBalance: 89.1234,
      currentCbbtcBalance: 7.5567,
      currentBtcBalance: 5.6789,
    },
    {
      mmName: "Rift MM Gamma",
      currentEthBalance: 210.005,
      currentCbbtcBalance: 24.0012,
      currentBtcBalance: 18.3345,
    },
  ];
}

function generateDummyErrorLogs(): ErrorLogItem[] {
  const now = Date.now();
  return [
    {
      timestamp: now - 20 * 60 * 1000,
      title: "ATTESTATION_ERROR",
      message:
        "qtt.rs – line 344 – The frontend attestation has failed, please check attestor service.",
    },
    {
      timestamp: now - 20 * 60 * 1000,
      title: "ATTESTATION_ERROR",
      message:
        "qtt.rs – line 344 – The frontend attestation has failed, please check attestor service.",
    },
    {
      timestamp: now - 20 * 60 * 1000,
      title: "QUOTE_ERROR",
      message:
        "LOG: The frontend quote has failed, please check the RFQ server.",
    },
  ];
}

export const useAnalyticsStore = create<{
  totalVolume: number;
  setTotalVolume: (value: number) => void;
  totalFeesCollected: number;
  setTotalFeesCollected: (value: number) => void;
  totalUsers: number;
  setTotalUsers: (value: number) => void;
  adminSwaps: AdminSwapItem[];
  setAdminSwaps: (items: AdminSwapItem[]) => void;
  addAdminSwap: (item: AdminSwapItem) => void;
  marketMakers: MarketMaker[];
  setMarketMakers: (mms: MarketMaker[]) => void;
  errorLogs: ErrorLogItem[];
  setErrorLogs: (logs: ErrorLogItem[]) => void;
}>((set) => ({
  totalVolume: 43243243224,
  setTotalVolume: (value: number) => set({ totalVolume: value }),
  totalFeesCollected: 43243243,
  setTotalFeesCollected: (value: number) => set({ totalFeesCollected: value }),
  totalUsers: 2382,
  setTotalUsers: (value: number) => set({ totalUsers: value }),
  // Start with no swaps; they will be populated by the DB hook
  adminSwaps: [],
  setAdminSwaps: (items: AdminSwapItem[]) => set({ adminSwaps: items }),
  addAdminSwap: (item: AdminSwapItem) =>
    set((s) => {
      if (s.adminSwaps.some((x) => x.id === item.id)) return {};
      return { adminSwaps: [item, ...s.adminSwaps] };
    }),
  marketMakers: generateDummyMMs(),
  setMarketMakers: (mms: MarketMaker[]) => set({ marketMakers: mms }),
  errorLogs: generateDummyErrorLogs(),
  setErrorLogs: (logs: ErrorLogItem[]) => set({ errorLogs: logs }),
}));
