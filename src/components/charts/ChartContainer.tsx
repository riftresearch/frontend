import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

interface ChartContainerProps {
  title: string;
  value: string;
  children: React.ReactNode;
  height?: number;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  value,
  children,
  height = 300,
}) => {
  return (
    <Flex
      direction="column"
      bg={colors.offBlack}
      border={`2px solid ${colors.borderGray}`}
      borderRadius="30px"
      p="20px"
      flex="1"
      minH={`${height + 80}px`}
    >
      {/* Header */}
      <Flex direction="column" mb="16px">
        <Text
          fontSize="14px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
          mb="4px"
        >
          {title.toUpperCase()}
        </Text>
        <Text
          fontSize="24px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.offWhite}
          fontWeight="bold"
        >
          {value}
        </Text>
      </Flex>

      {/* Chart */}
      <Box flex="1" minH={`${height}px`}>
        {children}
      </Box>
    </Flex>
  );
};
