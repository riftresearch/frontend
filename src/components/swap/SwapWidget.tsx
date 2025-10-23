import { Flex } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { opaqueBackgroundColor } from "@/utils/constants";
import { useTDXAttestation } from "@/hooks/useTDXAttestation";
import useWindowSize from "@/hooks/useWindowSize";
import { SwapInputAndOutput } from "./SwapInputAndOutput";
import { SwapButton } from "./SwapButton";

export const SwapWidget = () => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const { isValidTEE, isLoading: teeAttestationLoading } = useTDXAttestation();
  const { isMobile } = useWindowSize();
  const router = useRouter();

  // Styling constants
  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Flex
      direction="column"
      align="center"
      py={isMobile ? "20px" : "27px"}
      w={isMobile ? "100%" : "630px"}
      borderRadius="30px"
      {...opaqueBackgroundColor}
      borderBottom={borderColor}
      borderLeft={borderColor}
      borderTop={borderColor}
      borderRight={borderColor}
    >
      <Flex w="91.5%" direction="column">
        <SwapInputAndOutput />
        <SwapButton />
      </Flex>
    </Flex>
  );
};
