import React from "react";
import { Flex, Text } from "@chakra-ui/react";
import { AssetIcon } from "./AssetIcon";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

interface SwapDetailsPillProps {
  inputAmount: string;
  inputAsset: string;
  inputAssetIconUrl?: string;
  outputAmount: string;
  outputAsset: string;
  isMobile: boolean;
  width?: string;
  fontSize?: string;
}

export const SwapDetailsPill: React.FC<SwapDetailsPillProps> = ({
  inputAmount,
  inputAsset,
  inputAssetIconUrl,
  outputAmount,
  outputAsset,
  width,
  fontSize,
  isMobile,
}) => {
  return (
    <Flex
      bg="rgba(0, 0, 0, 0.6)"
      borderRadius={isMobile ? "26px" : "16px"}
      width={width ? width : "fit-content"}
      padding={isMobile ? "11px 6px" : "10px 18px"}
      alignItems="center"
      mb={isMobile ? "10px" : "0"}
      justifyContent="center"
      gap={isMobile ? "10px" : "10px"}
      backdropFilter="blur(12px)"
      border="1px solid rgba(255, 255, 255, 0.08)"
    >
      {/* Input Amount + Asset */}
      <Flex alignItems="center" gap="4px">
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "clamp(9px, 4vw, 15px)" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.offWhite}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {inputAmount}
        </Text>
        <AssetIcon asset={inputAsset} iconUrl={inputAssetIconUrl} size={isMobile ? 14 : 16} />
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "clamp(9px, 4vw, 15px)" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {inputAsset}
        </Text>
      </Flex>

      {/* Arrow */}
      <Text
        fontSize={isMobile ? "clamp(10px, 3vw, 14px)" : "14px"}
        color="rgba(255, 255, 255, 0.4)"
        fontWeight="bold"
      >
        →
      </Text>

      {/* Output Amount + Asset */}
      <Flex alignItems="center" gap="4px">
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "clamp(9px, 4vw, 15px)" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.offWhite}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {outputAmount}
        </Text>
        <AssetIcon asset={outputAsset} size={isMobile ? 14 : 16} />
        <Text
          fontSize={fontSize ? fontSize : isMobile ? "clamp(9px, 4vw, 15px)" : "13px"}
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
          fontWeight="500"
          letterSpacing="-0.5px"
        >
          {outputAsset}
        </Text>
      </Flex>
    </Flex>
  );
};
