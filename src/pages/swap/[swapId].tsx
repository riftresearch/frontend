import React from "react";
import { Flex } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TransactionWidget } from "@/components/other/TransactionWidget";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { useStore } from "@/utils/store";

// Map API status to deposit flow state
const mapStatusToDepositFlowState = (status: string) => {
  const statusMap: Record<string, string> = {
    "not-started": "0-not-started",
    WaitingUserDepositInitiated: "1-WaitingUserDepositInitiated",
    WaitingUserDepositConfirmed: "2-WaitingUserDepositConfirmed",
    WaitingMMDepositInitiated: "3-WaitingMMDepositInitiated",
    WaitingMMDepositConfirmed: "4-WaitingMMDepositConfirmed",
    Settled: "5-Settled",
    RefundingUser: "6-RefundingUser",
    RefundingMM: "7-RefundingMM",
    Failed: "8-Failed",
  };

  return statusMap[status] || "0-not-started";
};

export default function SwapPage() {
  const router = useRouter();
  const { swapId } = router.query;
  const {
    depositFlowState,
    setDepositFlowState,
    swapResponse,
    setCountdownValue,
    transactionConfirmed,
    setTransactionConfirmed,
  } = useStore();

  const [previousState, setPreviousState] =
    React.useState<string>("0-not-started");
  useSyncChainIdToStore();

  // Use the swapId from URL params, fallback to store if available
  const currentSwapId = (swapId as string) || swapResponse?.swap_id;

  // Use swap status hook
  const {
    data: swapStatusInfo,
    isLoading: isLoadingSwapStatus,
    isError: isErrorSwapStatus,
  } = useSwapStatus(currentSwapId);

  // Update deposit flow state based on swap status
  React.useEffect(() => {
    if (swapStatusInfo?.status) {
      const newDepositFlowState = mapStatusToDepositFlowState(
        swapStatusInfo.status
      );
      if (newDepositFlowState !== depositFlowState) {
        setDepositFlowState(newDepositFlowState as any);
      }
    }
  }, [swapStatusInfo?.status, depositFlowState, setDepositFlowState]);

  // Reset countdown only when starting deposit flow (0 -> 1)
  React.useEffect(() => {
    if (
      depositFlowState === "1-WaitingUserDepositInitiated" &&
      previousState === "0-not-started"
    ) {
      setCountdownValue(60);
    }
    setPreviousState(depositFlowState);
  }, [depositFlowState, setCountdownValue, previousState]);

  // Reset transaction confirmed state when going back to not-started
  React.useEffect(() => {
    if (depositFlowState === "0-not-started") {
      setTransactionConfirmed(false);
    }
  }, [depositFlowState, setTransactionConfirmed]);

  // Debug logging
  React.useEffect(() => {
    if (swapStatusInfo) {
      console.log("Current time", new Date().toISOString());
      console.log("New Swap status", swapStatusInfo);
    }
  }, [swapStatusInfo]);

  // Redirect to home if no swap ID is available
  React.useEffect(() => {
    if (router.isReady && !currentSwapId) {
      router.push("/");
    }
  }, [router.isReady, currentSwapId, router]);

  // Show loading or redirect if no swap ID
  if (!currentSwapId) {
    return null;
  }

  return (
    <>
      <OpenGraph />

      <Flex
        h="100vh"
        width="100%"
        direction="column"
        backgroundImage="url('/images/rift_background_low.webp')"
        backgroundSize="cover"
        backgroundPosition="center"
      >
        <Navbar />
        <Flex
          justify="center"
          align="center"
          direction="column"
          minH="calc(100vh - 80px)"
          p="4"
        >
          <TransactionWidget swapId={currentSwapId} />
        </Flex>
      </Flex>
    </>
  );
}
