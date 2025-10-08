import { useEffect } from "react";
import { useAnalyticsStore } from "@/utils/analyticsStore";
import { AdminSwapItem, SwapDirection, AdminSwapFlowStep } from "@/utils/types";
import { getSwaps } from "@/utils/analyticsClient";

function formatDuration(startMs: number, endMs: number): string {
  const diffSeconds = Math.floor((endMs - startMs) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function mapDbRowToAdminSwap(row: any, btcPriceUsd?: number): AdminSwapItem {
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

  // Parse timestamps for duration calculations
  const createdAt = createdAtMs;
  const userDepositDetectedAt = row?.user_deposit_status?.deposit_detected_at
    ? new Date(row.user_deposit_status.deposit_detected_at).getTime()
    : null;
  const userConfirmedAt = row?.user_deposit_status?.confirmed_at
    ? new Date(row.user_deposit_status.confirmed_at).getTime()
    : null;
  const mmDepositDetectedAt = row?.mm_deposit_status?.deposit_detected_at
    ? new Date(row.mm_deposit_status.deposit_detected_at).getTime()
    : null;
  const mmPrivateKeySentAt = row?.mm_private_key_sent_at
    ? new Date(row.mm_private_key_sent_at).getTime()
    : null;

  // Calculate durations for each step
  // created -> user sent
  const durationCreatedToUserSent =
    userDepositDetectedAt && createdAt
      ? formatDuration(createdAt, userDepositDetectedAt)
      : undefined;

  // user sent -> confs
  const durationUserSentToConfs =
    userConfirmedAt && userDepositDetectedAt
      ? formatDuration(userDepositDetectedAt, userConfirmedAt)
      : undefined;

  // user confs -> mm sent
  const durationUserConfsToMmSent =
    mmDepositDetectedAt && userConfirmedAt
      ? formatDuration(userConfirmedAt, mmDepositDetectedAt)
      : undefined;

  // mm sent -> mm confs
  const durationMmSentToMmConfs =
    mmPrivateKeySentAt && mmDepositDetectedAt
      ? formatDuration(mmDepositDetectedAt, mmPrivateKeySentAt)
      : undefined;

  // Extract transaction hashes
  const userTxHash = row?.user_deposit_status?.tx_hash;
  const mmTxHash = row?.mm_deposit_status?.tx_hash;

  // Extract amounts - user_deposit_status.amount is in hex (wei for ETH tokens)
  // For cbBTC, it's 8 decimals like BTC
  const userDepositAmountHex = row?.user_deposit_status?.amount || "0x0";
  const mmDepositAmountHex = row?.mm_deposit_status?.amount || "0x0";

  // Convert hex to decimal and adjust for 8 decimals (cbBTC/BTC standard)
  const userDepositAmount = parseInt(userDepositAmountHex, 16) / 1e8;
  const mmDepositAmount = parseInt(mmDepositAmountHex, 16) / 1e8;

  // Use the user's deposit amount as the swap amount (in BTC)
  const swapAmountBtc = userDepositAmount || 0.001;
  const swapAmountUsd = btcPriceUsd
    ? swapAmountBtc * btcPriceUsd
    : swapAmountBtc * 64000;

  // Estimate fees (these could come from the quote data if available)
  const riftFeeBtc = swapAmountBtc * 0.001; // 0.1% fee estimate
  const networkFeeUsd = 1.5; // Rough estimate
  const mmFeeUsd = swapAmountUsd * 0.002; // 0.2% MM fee estimate

  // Format confirmation labels based on asset type
  // cbBTC (EVM) needs fewer confirmations, cap at 4+
  // BTC needs more confirmations, cap at 2+ (but show actual until then)
  const userConfsLabel = userConfs >= 4 ? "4+ Confs" : `${userConfs} Confs`;
  const mmConfsLabel = mmConfs >= 2 ? "2+ Confs" : `${mmConfs} Confs`;

  const steps: AdminSwapFlowStep[] = [
    {
      status: "pending",
      label: "Created",
      state: currentIndex > 0 ? "completed" : "inProgress",
      // No duration - this is the starting point
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
      duration: durationCreatedToUserSent, // Time from created -> user sent
      txHash: userTxHash,
      txChain: "ETH", // User sends cbBTC on ETH
    },
    {
      status: "waiting_user_deposit_confirmed",
      label: userConfsLabel,
      state:
        currentIndex > 2
          ? "completed"
          : currentIndex === 2
            ? "inProgress"
            : "notStarted",
      duration: durationUserSentToConfs, // Time from user sent -> confs
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
      duration: durationUserConfsToMmSent, // Time from user confs -> mm sent
      txHash: mmTxHash,
      txChain: "BTC", // MM sends BTC
    },
    {
      status: "waiting_mm_deposit_confirmed",
      label: mmConfsLabel,
      state:
        currentIndex > 4
          ? "completed"
          : currentIndex === 4
            ? "inProgress"
            : "notStarted",
      duration: durationMmSentToMmConfs, // Time from mm sent -> mm confs
    },
    {
      status: "settled",
      label: "Settled",
      state: currentIndex >= 5 ? "completed" : "notStarted",
      // No duration shown for final step
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
    swapInitialAmountBtc: swapAmountBtc,
    swapInitialAmountUsd: swapAmountUsd,
    riftFeeBtc,
    userConfs,
    mmConfs,
    networkFeeUsd,
    mmFeeUsd,
    flow: steps,
    stepTimestamps: {
      created: createdAtMs,
      userDepositDetected: userDepositDetectedAt || undefined,
      userConfirmed: userConfirmedAt || undefined,
      mmDepositDetected: mmDepositDetectedAt || undefined,
      mmPrivateKeySent: mmPrivateKeySentAt || undefined,
    },
  };
}

export function useSwapsFromDb() {
  // Hook is currently unused - SwapHistory handles initial load
  // This hook is kept for potential future use (e.g., WebSocket connections)
  // Polling has been removed to avoid overloading the backend
}
