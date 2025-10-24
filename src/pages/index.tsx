import React from "react";
import { Flex, Text, Box } from "@chakra-ui/react";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { RiftLogo } from "@/components/other/RiftLogo";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import OrangeText from "@/components/other/OrangeText";
import { useStore } from "@/utils/store";
import { useRouter } from "next/router";

export default function Home() {
  const { isTablet, isMobile } = useWindowSize();
  const { swapResponse, transactionConfirmed } = useStore();
  const router = useRouter();
  const [isLocalhost, setIsLocalhost] = React.useState(false);

  useSyncChainIdToStore();

  // Check if we're on localhost
  React.useEffect(() => {
    // setIsLocalhost(
    //   typeof window !== "undefined" &&
    //     (window.location.hostname === "localhost" ||
    //       window.location.hostname === "127.0.0.1")
    // );
    setIsLocalhost(true); // for testing app connect on non localhost
  }, []);

  // Redirect to swap page when swap response is available AND transaction is confirmed
  React.useEffect(() => {
    if (swapResponse?.swap_id && transactionConfirmed) {
      router.push(`/swap/${swapResponse.swap_id}`);
    }
  }, [swapResponse?.swap_id, transactionConfirmed, router]);

  // Coming soon page for non-localhost
  if (!isLocalhost) {
    return (
      <>
        <OpenGraph />
        <Flex
          h="100vh"
          width="100%"
          justify="center"
          align="center"
          direction="column"
          backgroundImage="url('/images/rift_background_low.webp')"
          backgroundSize="cover"
          backgroundPosition="center"
        >
          <RiftLogo width={isTablet ? "70" : "390"} height={isTablet ? "30" : "70"} />
          <Text
            mt="40px"
            fontSize={isTablet ? "24px" : "22px"}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color="#fff"
            fontWeight="bold"
            textAlign="center"
          >
            LIVE SWAPPING COMING SOON
          </Text>
        </Flex>
      </>
    );
  }

  // Full application for localhost
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
          <Flex mt="15px"></Flex>
          <RiftLogo width={isTablet ? "70" : "390"} height={isTablet ? "30" : "70"} />

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
              The first peer-to-peer <OrangeText>Bitcoin</OrangeText> trading protocol. See{" "}
              <Box
                as="span"
                // TODO: go to tech architecture thread
                onClick={() => (window.location.href = "https://rift.trade")}
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
        </Flex>
        <TEEStatusFooter />
      </Flex>
    </>
  );
}
