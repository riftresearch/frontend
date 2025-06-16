import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { Flex, Text } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { ChartContainer } from "@/components/charts/ChartContainer";
import {
  CumulativeVolumeChart,
  DailyVolumeChart,
} from "@/components/charts/SimpleCharts";
import { SwapHistory } from "@/components/charts/SwapHistory";

const SwapWidget = dynamic(
  () =>
    import("@/components/swap/SwapWidget").then((mod) => ({
      default: mod.SwapWidget,
    })),
  {
    ssr: false,
  }
);

export default function Home() {
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
        zIndex={0}
      >
        <Navbar />
        <Flex direction={"column"} align="center" w="100%" h="100%" mt="105px">
          {/* LOGOS & TEXT */}
          <Flex direction={"column"} align="center" mt={"10px"} w="100%"></Flex>
          {/* CHARTS */}
          <Flex
            w="100%"
            mt="25px"
            maxW="1100px"
            gap="12px"
            align="center"
            justify="center"
            direction="column"
          >
            <Flex w="100%" direction="row" gap="12px">
              <ChartContainer title="Cumulative Volume" value="$21.23B">
                <CumulativeVolumeChart />
              </ChartContainer>
              <ChartContainer title="Daily Volume" value="$707M">
                <DailyVolumeChart />
              </ChartContainer>
            </Flex>
          </Flex>
          <Flex
            w="100%"
            maxW="1100px"
            align={"center"}
            justify={"center"}
            mt="18px"
          >
            <SwapHistory />
          </Flex>
        </Flex>
      </Flex>
    </>
  );
}
