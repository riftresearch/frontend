import React from "react";
import { Flex } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TransactionWidget } from "@/components/other/TransactionWidget";
import { BitcoinTransactionWidget } from "@/components/other/BitcoinTransactionWidget";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { useStore } from "@/utils/store";
import { generateBitcoinURI } from "@/utils/bitcoinUtils";

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

  const [previousState, setPreviousState] = React.useState<string>("0-not-started");
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
      const newDepositFlowState = mapStatusToDepositFlowState(swapStatusInfo.status);
      if (newDepositFlowState !== depositFlowState) {
        setDepositFlowState(newDepositFlowState as any);
      }
    }
  }, [swapStatusInfo?.status, depositFlowState, setDepositFlowState]);

  // Set countdown based on current step
  React.useEffect(() => {
    // Only update countdown when step changes or on initial load
    if (depositFlowState !== previousState) {
      // Map step to countdown value
      const countdownMap: Record<string, number> = {
        "1-WaitingUserDepositInitiated": 120,
        "2-WaitingUserDepositConfirmed": 100,
        "3-WaitingMMDepositInitiated": 60,
      };

      const newCountdown = countdownMap[depositFlowState];
      if (newCountdown !== undefined) {
        setCountdownValue(newCountdown);
      }

      setPreviousState(depositFlowState);
    }
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
      console.log("New Swap status", {
        ...swapStatusInfo,
        mm_deposit: swapStatusInfo.mm_deposit
          ? {
              ...swapStatusInfo.mm_deposit,
              deposit_amount: swapStatusInfo.mm_deposit.deposit_amount
                ? parseInt(swapStatusInfo.mm_deposit.deposit_amount, 16)
                : null,
              expected_amount: swapStatusInfo.mm_deposit.expected_amount
                ? parseInt(swapStatusInfo.mm_deposit.expected_amount, 16)
                : null,
            }
          : null,
        user_deposit: swapStatusInfo.user_deposit
          ? {
              ...swapStatusInfo.user_deposit,
              deposit_amount: swapStatusInfo.user_deposit.deposit_amount
                ? parseInt(swapStatusInfo.user_deposit.deposit_amount, 16)
                : null,
              expected_amount: swapStatusInfo.user_deposit.expected_amount
                ? parseInt(swapStatusInfo.user_deposit.expected_amount, 16)
                : null,
            }
          : null,
      });
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

  // Check if this is a Bitcoin deposit (BTC -> cbBTC swap)
  const isBitcoinDeposit = swapStatusInfo?.user_deposit?.chain === "Bitcoin";
  const bitcoinDepositAddress = swapStatusInfo?.user_deposit?.address;
  const bitcoinExpectedAmount = swapStatusInfo?.user_deposit?.expected_amount;
  const bitcoinDecimals = swapStatusInfo?.user_deposit?.decimals || 8;

  // Generate Bitcoin URI and amount for QR code
  let bitcoinUri = "";
  let bitcoinAmount = 0;
  if (isBitcoinDeposit && bitcoinDepositAddress && bitcoinExpectedAmount) {
    const amount = BigInt(bitcoinExpectedAmount);
    bitcoinAmount = Number(amount) / Math.pow(10, bitcoinDecimals);
    bitcoinUri = generateBitcoinURI(bitcoinDepositAddress, bitcoinAmount, "Rift Swap");
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
        <Flex justify="center" align="center" direction="column" minH="calc(100vh - 80px)" p="4">
          {isBitcoinDeposit && bitcoinDepositAddress ? (
            <BitcoinTransactionWidget
              address={bitcoinDepositAddress}
              amount={bitcoinAmount}
              bitcoinUri={bitcoinUri}
              depositTx={swapStatusInfo?.user_deposit?.deposit_tx}
            />
          ) : (
            <TransactionWidget swapId={currentSwapId} />
          )}
        </Flex>
      </Flex>
    </>
  );
}
