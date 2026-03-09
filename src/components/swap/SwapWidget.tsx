import { Flex } from "@chakra-ui/react";
import { opaqueBackgroundColor } from "@/utils/constants";
import useWindowSize from "@/hooks/useWindowSize";
import { SwapInputAndOutput } from "./SwapInputAndOutput";
import { SwapButton } from "./SwapButton";
import { LimitOrderPanel } from "./LimitOrderPanel";
import { LimitOrderButton } from "./LimitOrderButton";
import { OrderModeToggle } from "./OrderModeToggle";
import { useStore } from "@/utils/store";

export const SwapWidget = () => {
  const { isMobile } = useWindowSize();
  const orderMode = useStore((s) => s.orderMode);

  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

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
        <OrderModeToggle />
        {orderMode === "market" ? (
          <>
            <SwapInputAndOutput />
            <SwapButton />
          </>
        ) : (
          <>
            <LimitOrderPanel />
            <LimitOrderButton />
          </>
        )}
      </Flex>
    </Flex>
  );
};
