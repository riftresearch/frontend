import React from "react";
import { Flex, Text, Box } from "@chakra-ui/react";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { RiftLogo } from "@/components/other/RiftLogo";
import { TransactionWidget } from "@/components/other/TransactionWidget";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import OrangeText from "@/components/other/OrangeText";
import { useStore } from "@/utils/store";

export default function Home() {
  const { isTablet, isMobile } = useWindowSize();
  const depositFlowState = useStore((state) => state.depositFlowState);
  const setCountdownValue = useStore((state) => state.setCountdownValue);
  const [previousState, setPreviousState] =
    React.useState<string>("0-not-started");
  useSyncChainIdToStore();

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
          {depositFlowState === "0-not-started" ? (
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
