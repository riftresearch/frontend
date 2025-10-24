import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { Flex } from "@chakra-ui/react";
import { UserSwapHistory } from "@/components/activity/UserSwapHistory";

export default function History() {
  useSyncChainIdToStore();

  return (
    <>
      <OpenGraph />
      <Flex
        minH="100vh"
        width="100%"
        direction="column"
        backgroundImage="url('/images/rift_background_low.webp')"
        backgroundSize="cover"
        backgroundPosition="center"
        zIndex={0}
      >
        <Navbar />
        <Flex
          direction="column"
          align="center"
          justify="center"
          alignSelf="center"
          w="100%"
          maxW="1400px"
          px="20px"
          py="20px"
          flex="1"
        >
          <UserSwapHistory />
        </Flex>
      </Flex>
    </>
  );
}
