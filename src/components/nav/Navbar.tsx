import {
  Box,
  Button,
  Flex,
  FlexProps,
  Spacer,
  Text,
  Image,
  useClipboard,
  VStack,
  Input,
} from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import { useRouter } from "next/router";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { ConnectWalletButton } from "@/components/other/ConnectWalletButton";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore } from "@/utils/store";
import React, { useEffect, useState } from "react";
import { isDismissWarning, onDismiss } from "@/utils/warningHelper";
import GlowingShimmerText from "@/components/other/GlowingText";
import { useAccount } from "wagmi";

export const Navbar = ({}) => {
  const { isMobile, isTablet, isSmallLaptop, windowSize } = useWindowSize();
  const router = useRouter();
  const fontSize = isMobile ? "20px" : "20px";
  const [isLocalhost, setIsLocalhost] = useState(false);
  const { address, isConnected } = useAccount();

  const depositFlowState = useStore((state) => state.depositFlowState);
  const transactionConfirmed = useStore((state) => state.transactionConfirmed);

  const [displayWarning, setDisplayWarning] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setDisplayWarning(!isDismissWarning("dismissAlphaWarning"));
  }, []);

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsLocalhost(hostname === "localhost" || hostname === "127.0.0.1");
  }, []);

  const handleNavigation = (route: string) => {
    // If navigating to "/" from a swap page, reset swap state
    if (route === "/" && router.pathname.includes("/swap")) {
      // Clear swap state when navigating back to main page
      const { setSwapResponse, setDepositFlowState, setTransactionConfirmed } = useStore.getState();
      setSwapResponse(null);
      setDepositFlowState("0-not-started");
      setTransactionConfirmed(false);
    }

    // If navigating to "/" (swap page), clear Bitcoin deposit info
    if (route === "/") {
      const { setBitcoinDepositInfo } = useStore.getState();
      setBitcoinDepositInfo(null);
    }

    router.push(route);
  };

  const navItem = (text: string, route: string) => {
    return (
      <Flex
        _hover={{ background: "rgba(150, 150, 150, 0.2)" }}
        cursor="pointer"
        borderRadius="6px"
        px="10px"
        onClick={() => {
          if (route === "/about") {
            window.location.href = "https://rift.exchange";
          } else {
            handleNavigation(route);
          }
        }}
        py="2px"
        position="relative"
        alignItems="center"
      >
        <Text
          color={router.pathname == route ? "white" : "white"}
          fontSize={isTablet ? "0.9rem" : "19px"}
          fontFamily="Nostromo"
        >
          {text}
        </Text>
        {(router.pathname === route || (route === "/" && router.pathname.includes("/swap"))) && (
          <Flex
            position={"absolute"}
            top="31px"
            w="calc(100% - 20px)"
            height="2px"
            bgGradient={`linear(-90deg, #394AFF, #FF8F28)`}
          />
        )}
      </Flex>
    );
  };

  // Function to map numeric state to string literal
  const mapStateNumberToString = (
    stateNumber: number
  ):
    | "0-not-started"
    | "1-WaitingUserDepositInitiated"
    | "2-WaitingUserDepositConfirmed"
    | "3-WaitingMMDepositInitiated"
    | "4-WaitingMMDepositConfirmed"
    | "5-Settled"
    | "6-RefundingUser"
    | "7-RefundingMM"
    | "8-Failed" => {
    switch (stateNumber) {
      case 0:
        return "0-not-started";
      case 1:
        return "1-WaitingUserDepositInitiated";
      case 2:
        return "2-WaitingUserDepositConfirmed";
      case 3:
        return "3-WaitingMMDepositInitiated";
      case 4:
        return "4-WaitingMMDepositConfirmed";
      case 5:
        return "5-Settled";
      case 6:
        return "6-RefundingUser";
      case 7:
        return "7-RefundingMM";
      case 8:
        return "8-Failed";
      default:
        return "0-not-started"; // Default case
    }
  };

  return (
    <Flex
      width={"100%"}
      direction={"column"}
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={1010}
      bg={isMobile ? "linear(90deg, rgba(57,74,255,0.1), rgba(255,143,40,0.1))" : "transparent"}
      backdropFilter={isMobile ? "blur(10px)" : "none"}
      boxShadow={isMobile ? "0 4px 12px rgba(0, 0, 0, 0.6)" : "none"}
    >
      {!isMobile && (
        <Flex
          bgGradient="linear(0deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.8))"
          position="absolute"
          w="100%"
          h="130%"
        ></Flex>
      )}

      <Flex
        direction="row"
        w="100%"
        px={isMobile ? "14px" : "30px"}
        pt={isMobile ? "15px" : "22px"}
        pb={isMobile ? "15px" : "0"}
        zIndex={400}
      >
        {isMobile ? (
          <Flex>
            <Button
              onClick={() => handleNavigation(router.pathname === "/history" ? "/" : "/history")}
              type="button"
              bg={colors.swapBgColor}
              _hover={{ bg: colors.swapHoverColor }}
              _active={{ bg: colors.swapBgColor }}
              borderRadius="30px"
              fontFamily="Nostromo"
              fontSize="14px"
              color={colors.offWhite}
              px="20px"
              pt="0px"
              h="36px"
              border={`2px solid ${colors.swapBorderColor}`}
              letterSpacing="-1px"
            >
              {router.pathname === "/history" ? "Swap" : "History"}
            </Button>
          </Flex>
        ) : (
          <>
            <Flex gap="12px">
              {navItem("Swap", "/")}
              {navItem("History", "/history")}
              {navItem("Stats", "/stats")}
              {/* {navItem('OTC', '/otc')} */}
            </Flex>
            <Flex ml="25px" gap="30px" align="center">
              <a href="https://x.com/riftdex" target="_blank" rel="noopener noreferrer">
                <Image src="/images/social/x.svg" w="17px" aspectRatio={1} />
              </a>
              {/* <Flex mt="1px">
                <a href="https://discord.gg/tpr6jMdvFq" target="_blank" rel="noopener noreferrer">
                  <Image
                    src="/images/social/discord2.svg"
                    objectFit="contain"
                    h="25px"
                    aspectRatio={1}
                  />
                </a>
              </Flex> */}
            </Flex>
          </>
        )}
        <Spacer />
        <Flex
          direction="column"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          align="center"
          fontSize="12px"
          position="absolute"
          top={0}
          left={0}
          right={0}
        >
          {!isMobile &&
            depositFlowState !== "0-not-started" &&
            transactionConfirmed &&
            !router.pathname.includes("/swap/") && (
              <Flex justify="center" align="center" mt="25px">
                <svg
                  width={isTablet ? "70" : "112"}
                  height={isTablet ? "30" : "48"}
                  viewBox="0 0 3190 674"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M362.16 0.509766L708.992 1.01953C764.583 1.01988 854.441 35.3784 899.254 66.0684C946.209 98.2244 976.303 137.703 991.728 187.377C998.545 209.335 999.065 270.158 992.616 291.358C977.097 342.374 948.466 381.798 903.368 414.254C880.445 430.753 849.028 447.137 821.983 456.698C811.159 460.525 802.305 464.051 802.305 464.535C802.324 465.034 855.943 511.837 921.476 568.554C987.014 625.277 1040.64 672.038 1040.65 672.471C1040.65 672.896 989.297 673.212 926.534 673.17L812.423 673.096L709.3 578.507L606.177 483.921H326.44L231.556 373.886H462.542C577.817 373.886 657.812 373.229 672.215 372.168C764.603 365.355 822.541 317.06 822.541 246.859C822.541 191.068 785.958 148.878 721.28 130.076C691.254 121.348 696.678 121.509 432.987 121.479L188.463 121.451V673.246H0.960938V58.8457C0.960938 26.3598 27.3199 0.0372334 59.8057 0.0830078L362.16 0.509766ZM1358.4 673.242H1171.9V0H1358.4V673.242ZM2215.9 134.838H1680.88V269.92H2094.76L1997.96 382.709H1680.88V673.242H1493.72V67.4189C1493.72 48.8748 1502.88 33.0017 1521.21 19.8008C1539.53 6.60022 1561.56 5.19057e-05 1587.3 0H2337.08L2215.9 134.838ZM3189.12 134.834H2869.77V673.242H2697.47V134.834H2363.92L2485.05 0H3189.12V134.834Z"
                    fill="white"
                  />
                </svg>
              </Flex>
            )}
        </Flex>
        <Spacer />
        <Flex mb={isMobile ? "0px" : "-5px"} pr="5px" alignItems="center" gap="10px">
          <ConnectWalletButton />
        </Flex>
      </Flex>

      {isMobile && (
        <Flex
          w="100%"
          h="1px"
          bgGradient={`linear-gradient(90deg, ${colors.RiftBlue} 0%, ${colors.RiftOrange} 100%)`}
          opacity={0.6}
        />
      )}
    </Flex>
  );
};
