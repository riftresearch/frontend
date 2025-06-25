import React from "react";
import { Flex, Text } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

export const DummySwapAmounts: React.FC = () => {
  return (
    <Flex direction="column" align="center" w="100%" maxW="500px" mb="20px">
      <Flex
        direction="row"
        align="center"
        justify="space-between"
        w="100%"
        bg="rgba(46, 29, 14, 0.66)"
        border="2px solid #78491F"
        borderRadius="16px"
        px="20px"
        py="15px"
      >
        <Flex direction="column" align="flex-start">
          <Text
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.textGray}
            mb="5px"
          >
            You Send
          </Text>
          <Text
            fontSize="18px"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colors.offWhite}
          >
            1.0 BTC
          </Text>
        </Flex>

        <Text fontSize="20px" color={colors.offWhite} mx="20px">
          →
        </Text>

        <Flex direction="column" align="flex-end">
          <Text
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.textGray}
            mb="5px"
          >
            You Receive
          </Text>
          <Text
            fontSize="18px"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colors.offWhite}
          >
            95,480 USDT
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};
