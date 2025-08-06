import { Flex, Text, Box } from "@chakra-ui/react";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { RiftLogo } from "@/components/other/RiftLogo";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import useWindowSize from "@/hooks/useWindowSize";
import { FONT_FAMILIES } from "@/utils/font";
import OrangeText from "@/components/other/OrangeText";
import { useStore } from "@/utils/store";

export default function Home() {
  const { isTablet, isMobile } = useWindowSize();
  const depositFlowState = useStore((state) => state.depositFlowState);
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
            <Box
              w={isMobile ? "100%" : "930px"}
              h="600px"
              borderRadius="30px"
              boxShadow="0 9px 31.3px #42285B"
              backdropFilter="blur(9px)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
              _before={{
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: "30px",
                padding: "5px",
                background:
                  "linear-gradient(100deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "xor",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
              }}
            >
              <Box
                w="100%"
                h="50%"
                borderRadius="30px"
                position="absolute"
                top="0px"
                background="linear-gradient(100deg, rgba(171, 125, 255, 0.32) 1.46%, rgba(0, 26, 144, 0.30) 98.72%)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                _before={{
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: "30px",
                  padding: "3px",
                  background:
                    "linear-gradient(100deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "xor",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                }}
              >
                <Text
                  color="white"
                  fontSize="14px"
                  fontFamily="Nostromo"
                  position="relative"
                  zIndex={1}
                >
                  Small Rectangle
                </Text>
              </Box>
              <Text
                color="white"
                fontSize="18px"
                fontFamily="Nostromo"
                position="relative"
                zIndex={1}
              >
                Deposit Flow Active
              </Text>
            </Box>
          )}
        </Flex>
      </Flex>
    </>
  );
}
