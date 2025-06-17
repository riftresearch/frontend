import React from "react";
import { GetServerSideProps } from "next";
import { Flex, Text, Box } from "@chakra-ui/react";
import { Navbar } from "@/components/nav/Navbar";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { opaqueBackgroundColor } from "@/utils/constants";
import useWindowSize from "@/hooks/useWindowSize";

interface SwapSuccessPageProps {
  txHash: string;
}

const SwapSuccessPage: React.FC<SwapSuccessPageProps> = ({ txHash }) => {
  const { isMobile } = useWindowSize();

  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  return (
    <Flex
      minHeight="100vh"
      width="100%"
      backgroundImage="url('/images/rift_background_low.webp')"
      backgroundSize="cover"
      backgroundPosition="center"
      direction="column"
      fontFamily={FONT_FAMILIES.AUX_MONO}
    >
      <Navbar />

      <Flex
        flex={1}
        align="center"
        justify="center"
        py={isMobile ? "20px" : "40px"}
        px={isMobile ? "20px" : "40px"}
      >
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
          <Flex w="91.5%" direction="column" align="center" justify="center">
            <Text
              fontSize="24px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.greenOutline}
              mb="20px"
              textAlign="center"
            >
              Swap Status!
            </Text>

            <Text
              fontSize="14px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.textGray}
              mb="30px"
              textAlign="center"
            >
              Your auction has been created successfully
              <br />
              <br />
              Alp if youre seeing this its a placeholder for rive animtions,
              however we do need to figure out how to pull the current swap
              status based on the txn hash in the url upon refresh
            </Text>

            <Box
              bg="rgba(46, 29, 14, 0.66)"
              border="2px solid #78491F"
              borderRadius="16px"
              px="20px"
              py="20px"
              w="100%"
              maxW="500px"
            >
              <Text
                fontSize="14px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.textGray}
                mb="10px"
                textAlign="center"
              >
                Transaction Hash:
              </Text>

              <Text
                fontSize={isMobile ? "12px" : "14px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.offWhite}
                textAlign="center"
                wordBreak="break-all"
                letterSpacing="-0.5px"
              >
                {txHash}
              </Text>
            </Box>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { txHash } = context.params!;

  // Basic validation that txHash is a string and looks like a transaction hash
  if (
    !txHash ||
    typeof txHash !== "string" ||
    !/^0x[a-fA-F0-9]{64}$/.test(txHash)
  ) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      txHash,
    },
  };
};

export default SwapSuccessPage;
