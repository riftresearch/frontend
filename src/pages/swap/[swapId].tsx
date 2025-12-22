import React from "react";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { UnifiedTransactionWidget } from "@/components/other/UnifiedTransactionWidget";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { useStore } from "@/utils/store";
import { generateBitcoinURI } from "@/utils/bitcoinUtils";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { hasData } from "@/utils/riftApiClient";

// Map API status to deposit flow state
const mapStatusToDepositFlowState = (status: string) => {
  const statusMap: Record<string, string> = {
    "not-started": "0-not-started",
    pending: "0-not-started",
    waiting_user_deposit_initiated: "1-WaitingUserDepositInitiated",
    waiting_user_deposit_confirmed: "2-WaitingUserDepositConfirmed",
    waiting_mm_deposit_initiated: "3-WaitingMMDepositInitiated",
    waiting_mm_deposit_confirmed: "4-WaitingMMDepositConfirmed",
    settled: "5-Settled",
    refunding_user: "6-RefundingUser",
    refunding_mm: "7-RefundingMM",
    failed: "8-Failed",
    // Legacy support for old status format
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
    countdownValue,
    setCountdownValue,
    transactionConfirmed,
    setTransactionConfirmed,
  } = useStore();

  const [previousState, setPreviousState] = React.useState<string>("0-not-started");
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  useSyncChainIdToStore();
  useBtcEthPrices(); // Fetch BTC/ETH prices on this page

  // Use the swapId from URL params, fallback to store if available
  const currentSwapId = (swapId as string) || swapResponse?.id;

  // Give backend 3 seconds to sync the swap before showing error
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Use swap status hook
  const {
    data: swapStatusInfo,
    isLoading: isLoadingSwapStatus,
    isError: isErrorSwapStatus,
  } = useSwapStatus(currentSwapId);

  // Update deposit flow state based on swap status
  React.useEffect(() => {
    if (swapStatusInfo?.status) {
      // If we successfully loaded swap data, end initial loading
      setIsInitialLoading(false);

      const newDepositFlowState = mapStatusToDepositFlowState(swapStatusInfo.status);

      if (newDepositFlowState !== depositFlowState) {
        console.log(
          `[SwapPage] 🟣 UPDATING depositFlowState: ${depositFlowState} -> ${newDepositFlowState} (API status: ${swapStatusInfo.status})`
        );
        setDepositFlowState(newDepositFlowState as any);
      }
    }
  }, [
    swapStatusInfo?.status,
    depositFlowState,
    setDepositFlowState,
    isLoadingSwapStatus,
    isErrorSwapStatus,
  ]);

  // Set countdown only on initial load for step 1 or step 2, otherwise set to 0 to show loading dots
  React.useEffect(() => {
    // Only run on initial load (when previousState is still initial)
    if (previousState === "0-not-started") {
      if (
        depositFlowState === "1-WaitingUserDepositInitiated" ||
        depositFlowState === "2-WaitingUserDepositConfirmed"
      ) {
        // Start timer on step 1 or step 2
        setCountdownValue(99);
      } else if (depositFlowState !== "0-not-started") {
        // On any other step (3, 4, 5), show loading dots (countdown = 0)
        setCountdownValue(0);
      }
      setPreviousState(depositFlowState);
    }
  }, [depositFlowState, previousState, setCountdownValue]);

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
        mm_deposit_status: hasData(swapStatusInfo.mm_deposit_status)
          ? {
              ...swapStatusInfo.mm_deposit_status,
              amount: swapStatusInfo.mm_deposit_status.amount
                ? parseInt(swapStatusInfo.mm_deposit_status.amount, 16)
                : null,
            }
          : null,
        user_deposit_status: hasData(swapStatusInfo.user_deposit_status)
          ? {
              ...swapStatusInfo.user_deposit_status,
              amount: swapStatusInfo.user_deposit_status.amount
                ? parseInt(swapStatusInfo.user_deposit_status.amount, 16)
                : null,
            }
          : null,
        quote: swapStatusInfo.quote
          ? {
              ...swapStatusInfo.quote,
              from_amount: parseInt(swapStatusInfo.quote.from.amount),
              to_amount: parseInt(swapStatusInfo.quote.to.amount),
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

  // Show loading spinner during initial grace period or while loading
  if (isInitialLoading || (isLoadingSwapStatus && !swapStatusInfo)) {
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
            gap="20px"
          >
            <Spinner color="white" size="xl" />
            <Text
              color="rgba(255, 255, 255, 0.7)"
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              letterSpacing="-0.5px"
            >
              Loading swap details...
            </Text>
          </Flex>
        </Flex>
      </>
    );
  }

  // Show error if swap not found after grace period
  if (!swapStatusInfo && !isLoadingSwapStatus) {
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
            gap="20px"
          >
            <Text
              color={colors.redHover}
              fontSize="20px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              letterSpacing="0.5px"
            >
              SWAP NOT FOUND
            </Text>
            <Text
              color="rgba(255, 255, 255, 0.6)"
              fontSize="14px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              letterSpacing="-0.5px"
              textAlign="center"
              maxW="400px"
            >
              Unable to load swap details. The swap may not exist or may have expired.
            </Text>
          </Flex>
        </Flex>
      </>
    );
  }

  // Check if this is a Bitcoin deposit (BTC -> cbBTC swap)
  const isBitcoinDeposit = swapStatusInfo?.quote?.from.currency.chain === "bitcoin";
  const bitcoinDepositAddress = swapStatusInfo?.deposit_vault_address;
  const bitcoinExpectedAmount = swapStatusInfo?.quote?.from.amount;
  const bitcoinDecimals = swapStatusInfo?.quote?.from.currency.decimals || 8;

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
          <UnifiedTransactionWidget
            swapId={currentSwapId}
            bitcoinAddress={isBitcoinDeposit ? bitcoinDepositAddress : undefined}
            bitcoinAmount={isBitcoinDeposit ? bitcoinAmount : undefined}
            bitcoinUri={isBitcoinDeposit ? bitcoinUri : undefined}
            bitcoinDepositTx={swapStatusInfo?.user_deposit_status?.tx_hash}
          />
        </Flex>
        {process.env.NEXT_PUBLIC_FAKE_OTC === "true" ||
        process.env.NEXT_PUBLIC_FAKE_RFQ === "true" ? null : (
          <TEEStatusFooter />
        )}
      </Flex>
    </>
  );
}
