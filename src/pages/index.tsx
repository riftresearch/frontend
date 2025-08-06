import React from "react";
import { Flex, Text, Box } from "@chakra-ui/react";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { RiftLogo } from "@/components/other/RiftLogo";
import { TransactionWidget } from "@/components/other/TransactionWidget";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import OrangeText from "@/components/other/OrangeText";
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

export default function Home() {
  const { isTablet, isMobile } = useWindowSize();
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

  // Use swap status hook
  const {
    data: swapStatusInfo,
    isLoading: isLoadingSwapStatus,
    isError: isErrorSwapStatus,
  } = useSwapStatus(swapResponse?.swap_id);

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
      setCountdownValue(10);
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
          {depositFlowState === "0-not-started" || !transactionConfirmed ? (
            <>
              <Flex mt="15px"></Flex>
              <RiftLogo
                width={isTablet ? "70" : "390"}
                height={isTablet ? "30" : "70"}
              />

              <Flex
                flexDir={"column"}
                textAlign={"center"}
                userSelect={"none"}
                fontSize={isTablet ? "12px" : "15px"}
                mt={"18px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={"#c3c3c3"}
                cursor={"default"}
                fontWeight={"normal"}
                gap={"0px"}
              >
                <Text mt="15px" mb="25px">
                  The first trustless <OrangeText>Bitcoin</OrangeText> bridge.
                  See{" "}
                  <Box
                    as="span"
                    // go to https://rift.exchange
                    onClick={() =>
                      (window.location.href = "https://rift.exchange")
                    }
                    style={{
                      textDecoration: "underline",
                      cursor: "pointer !important",
                    }}
                    fontWeight={"bold"}
                  >
                    how it works
                  </Box>
                </Text>
              </Flex>
              <SwapWidget />
            </>
          ) : (
            <TransactionWidget />
          )}
        </Flex>
      </Flex>
    </>
  );
}
