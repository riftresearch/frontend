import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { RiftLogo } from "@/components/other/RiftLogo";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import OrangeText from "@/components/other/OrangeText";
import { Flex, Text, Box } from "@chakra-ui/react";
import { SwapWidget } from "@/components/swap/SwapWidget";

export default function Home() {
  const { isTablet, isMobile } = useWindowSize();
  useSyncChainIdToStore();
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
              The first trustless <OrangeText>Bitcoin</OrangeText> exchange. See{" "}
              <Box
                as="span"
                // go to https://rift.exchange
                onClick={() => (window.location.href = "https://rift.exchange")}
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
      </Flex>
    </>
  );
}
