import { Box, Text } from "@chakra-ui/react";
import { CountdownTimer } from "./CountdownTimer";
import useWindowSize from "@/hooks/useWindowSize";
import { useStore } from "@/utils/store";
import { useState, useEffect } from "react";

export function TransactionWidget() {
  const { isMobile } = useWindowSize();
  const depositFlowState = useStore((state) => state.depositFlowState);
  const [showStepsText, setShowStepsText] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);

  const getDisplayText = () => {
    switch (depositFlowState) {
      case "0-not-started":
        return "Ready to Begin";
      case "1-WaitingUserDepositInitiated":
        return "Initiating Deposit";
      case "2-WaitingUserDepositConfirmed":
        return "Confirming Deposit";
      case "3-WaitingMMDepositInitiated":
        return "Finding Liquidity";
      case "4-WaitingMMDepositConfirmed":
        return "Processing";
      case "5-Settled":
        return "Complete";
      case "6-RefundingUser":
        return "Refunding";
      case "7-RefundingMM":
        return "Refunding";
      case "8-Failed":
        return "Failed";
      default:
        return "Deposit Flow Active";
    }
  };

  return (
    <Box
      w={isMobile ? "100%" : "810px"}
      h="510px"
      borderRadius="40px"
      mt="70px"
      boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
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
        borderRadius: "40px",
        padding: "3px",
        background:
          "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
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
        borderRadius="40px"
        position="absolute"
        top="0px"
        background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
        display="flex"
        backdropFilter="blur(20px)"
        alignItems="center"
        justifyContent="center"
        _before={{
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "40px",
          padding: "3px",
          background:
            "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "xor",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
        }}
      >
        <CountdownTimer
          onComplete={() => {
            console.log("Countdown completed");
          }}
        />
      </Box>
      <Box
        h="50%"
        bottom="0px"
        position="absolute"
        padding="20px"
        w="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text
          color="white"
          fontSize="18px"
          fontFamily="Nostromo"
          position="relative"
          zIndex={1}
        >
          {getDisplayText()}
        </Text>
      </Box>
    </Box>
  );
}
