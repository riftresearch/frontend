import { useEffect } from "react";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { AdminSwapItem, SwapDirection, AdminSwapFlowStep } from "@/utils/types";

// Basic Postgres listener using WebSocket relay (server required). For demo purposes,
// we'll poll + use server-sent events if available.

const DB_URL = process.env.NEXT_PUBLIC_OTC_DB_URL || "";

function mapDbRowToAdminSwap(row: any): AdminSwapItem {
  const createdAtMs = new Date(row.created_at).getTime();
  const direction: SwapDirection = "EVM_TO_BTC";

  // Raw status passthrough using ordered steps from the DB model
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

  const steps: AdminSwapFlowStep[] = [
    {
      status: "pending",
      label: "Created",
      state: currentIndex > 0 ? "completed" : "inProgress",
    },
    {
      status: "waiting_user_deposit_initiated",
      label: "User Sent",
      state:
        currentIndex > 1
          ? "completed"
          : currentIndex === 1
            ? "inProgress"
            : "notStarted",
      badge: "cbBTC",
    },
    {
      status: "waiting_user_deposit_confirmed",
      label: `${userConfs} Confs`,
      state:
        currentIndex > 2
          ? "completed"
          : currentIndex === 2
            ? "inProgress"
            : "notStarted",
    },
    {
      status: "waiting_mm_deposit_initiated",
      label: "MM Sent",
      state:
        currentIndex > 3
          ? "completed"
          : currentIndex === 3
            ? "inProgress"
            : "notStarted",
      badge: "BTC",
    },
    {
      status: "waiting_mm_deposit_confirmed",
      label: `${mmConfs}+ Confs`,
      state:
        currentIndex > 4
          ? "completed"
          : currentIndex === 4
            ? "inProgress"
            : "notStarted",
    },
    {
      status: "settled",
      label: "Settled",
      state: currentIndex >= 5 ? "completed" : "notStarted",
    },
  ];

  return {
    statusTesting: status,
    id: row.id,
    swapCreationTimestamp: createdAtMs,
    evmAccountAddress:
      row.user_evm_account_address ||
      row.user_deposit_address ||
      "0x0000000000000000000000000000000000000000",
    chain: "ETH",
    direction,
    swapInitialAmountBtc: 0.001,
    swapInitialAmountUsd: 64,
    riftFeeBtc: 0.00001,
    userConfs,
    mmConfs,
    networkFeeUsd: 1.23,
    mmFeeUsd: 4.86,
    flow: steps,
  };
}

export function useSwapsFromDb() {
  const setAdminSwaps = useAnalyticsStore((s) => s.setAdminSwaps);
  const addAdminSwap = useAnalyticsStore((s) => s.addAdminSwap);

  useEffect(() => {
    if (!DB_URL) return;

    let stop = false;

    async function initialFetch() {
      try {
        const res = await fetch(`/api/swaps?db=${encodeURIComponent(DB_URL)}`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped: AdminSwapItem[] = (data || []).map(mapDbRowToAdminSwap);
        if (!stop) setAdminSwaps(mapped);
      } catch (e) {
        // silent
      }
    }

    let pollId: any;
    function startPolling() {
      pollId = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/swaps/latest?db=${encodeURIComponent(DB_URL)}`
          );
          if (!res.ok) return;
          const latest = await res.json();
          if (latest) addAdminSwap(mapDbRowToAdminSwap(latest));
        } catch {}
      }, 1000); // poll every second
    }

    initialFetch();
    startPolling();

    return () => {
      stop = true;
      if (pollId) clearInterval(pollId);
    };
  }, [setAdminSwaps, addAdminSwap]);
}
