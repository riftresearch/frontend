import { Box, Text } from "@chakra-ui/react";
import { CountdownTimer } from "./CountdownTimer";
import useWindowSize from "@/hooks/useWindowSize";

export function TransactionWidget() {
  const { isMobile } = useWindowSize();

  return (
    <Box
      w={isMobile ? "100%" : "930px"}
      h="600px"
      borderRadius="40px"
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
        borderRadius: "40px",
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
        borderRadius="40px"
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
          borderRadius: "40px",
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
        <CountdownTimer
          onComplete={() => {
            console.log("Countdown completed");
          }}
        />
      </Box>
      <Box
        h="50%"
        w="100%"
        bg="white"
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
          Deposit Flow Active
        </Text>
      </Box>
    </Box>
  );
}
