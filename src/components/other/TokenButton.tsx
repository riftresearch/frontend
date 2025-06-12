import { Flex, Text, FlexProps } from "@chakra-ui/react";
import { colors } from "../../utils/colors";
import { FONT_FAMILIES } from "../../utils/font";
import { FaChevronDown } from "react-icons/fa";
import useWindowSize from "@/hooks/useWindowSize";
import { BASE_LOGO } from "./SVGs";
import Image from "next/image";
import { useStore } from "@/utils/store";
import { ValidAsset } from "@/utils/types";
import { useChainId } from "wagmi";

interface TokenProps {
  asset: ValidAsset;
  onDropDown?: () => void;
  w?: string | number;
  h?: string | number;
  fontSize?: string;
  borderWidth?: string | number;
  px?: string | number;
  pointer?: boolean;
  greyedOut?: boolean;
  cursor?: string;
}

const TokenButton: React.FC<TokenProps> = ({
  asset,
  onDropDown,
  w,
  h,
  fontSize,
  borderWidth,
  px,
  pointer,
  greyedOut = false,
  cursor = "default",
}) => {
  const { isMobile } = useWindowSize();
  const chainId = useChainId();
  const adjustedH = h ?? isMobile ? "30px" : "36px";
  const adjustedFontSize = fontSize ?? `calc(${adjustedH} / 2 + 0px)`;
  const arrowSize = fontSize ?? `calc(${adjustedH} / 4)`;
  const adjustedBorderRadius = `calc(${adjustedH} / 4)`;

  // Handle both types - TokenMeta has address, ValidAsset might have tokenAddress
  const address = asset.tokenAddress;
  const key = `${address}-${asset.style.symbol}`;

  const bgColor = greyedOut || !asset.style ? "#383838" : asset.style.bg_color;
  const borderColor =
    greyedOut || !asset.style ? "#838383" : asset.style.border_color;
  const pX = px ?? "20px";

  return (
    <Flex align="center">
      {/* Button Icon */}
      <Flex
        userSelect="none"
        cursor={cursor}
        aspectRatio={1}
        h={`calc(${adjustedH} + 2px)`}
        bg={bgColor}
        w={w}
        borderRadius="400px"
        mr={`calc(${adjustedH} / 1.6 * -1)`}
        zIndex={1}
        align="center"
        justify="center"
        overflow={"hidden"}
        onClick={onDropDown}
      >
        <Image
          src={asset.style.logoURI as string}
          alt={`${asset.style.name} icon`}
          width={38}
          height={38}
        />
      </Flex>
      {/* Button Text */}
      <Flex
        userSelect="none"
        bg={bgColor}
        border={`2px solid ${borderColor}`}
        borderWidth={borderWidth}
        h={adjustedH}
        borderRadius={adjustedBorderRadius}
        align="center"
        pr={pX}
        pl={`calc(${adjustedH} / 2  + ${pX} / 2)`}
        gap="8px"
        cursor={cursor}
        onClick={onDropDown}
      >
        {chainId === 8453 ||
          (chainId === 84532 && (
            <Flex ml="0px" mr="-1px" mt="-1px">
              <BASE_LOGO width="22" height="22" />
            </Flex>
          ))}
        {asset.style.symbol === "cbBTC" ? (
          <Text
            fontSize={adjustedFontSize}
            color={"white"}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            userSelect="none"
          >
            <span style={{ fontSize: "12px", marginRight: "1px" }}>cb</span>BTC
          </Text>
        ) : (
          <Text
            fontSize={adjustedFontSize}
            color={"white"}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            userSelect="none"
          >
            {asset.style.symbol}
          </Text>
        )}
        {onDropDown && (
          <FaChevronDown
            fontSize={arrowSize}
            color={colors.offWhite}
            style={{ marginRight: "-8px" }}
          />
        )}
      </Flex>
    </Flex>
  );
};

export default TokenButton;
