import { Flex, Text, Image, Box } from "@chakra-ui/react";
import { colors } from "../../utils/colors";
import { FONT_FAMILIES } from "../../utils/font";
import { FaChevronDown } from "react-icons/fa";
import useWindowSize from "@/hooks/useWindowSize";
import { NetworkBadge } from "./NetworkBadge";
import { useStore } from "@/utils/store";
import { FALLBACK_TOKEN_ICON, BTC_ICON } from "@/utils/constants";

interface WebAssetTagProps {
  asset: string;
  onDropDown?: () => void;
  w?: string | number;
  h?: string | number;
  fontSize?: string;
  borderWidth?: string | number;
  px?: string | number;
  pointer?: boolean;
  cursor?: string;
  isOutput?: boolean;
}

const WebAssetTag: React.FC<WebAssetTagProps> = ({
  asset,
  onDropDown,
  w,
  h,
  fontSize,
  borderWidth,
  px,
  pointer,
  cursor = "default",
  isOutput = false,
}) => {
  const { isMobile } = useWindowSize();
  const { selectedInputToken, selectedOutputToken } = useStore();

  const adjustedH = (h ?? isMobile) ? "30px" : "36px";
  const adjustedFontSize = fontSize ?? `calc(${adjustedH} / 2 + 0px)`;
  const arrowSize = fontSize ?? `calc(${adjustedH} / 2.5)`;
  const adjustedBorderRadius = `calc(${adjustedH} / 4)`;

  // Select the appropriate token based on isOutput flag
  const selectedToken = isOutput ? selectedOutputToken : selectedInputToken;
  const displayTicker = asset === "BTC" ? "BTC" : selectedToken?.ticker || "ETH";

  // Use selected token's icon if available and valid, otherwise fallback
  const iconUrl = asset === "BTC" ? BTC_ICON : selectedToken?.icon || FALLBACK_TOKEN_ICON;

  const colorKey = asset === "BTC" ? "btc" : (displayTicker || asset).toLowerCase();
  const colorDef = colors.assetTag[colorKey as keyof typeof colors.assetTag] || colors.assetTag.eth;
  const bgColor = colorDef.background;
  const borderColor = colorDef.border;

  const pX = px ?? "20px";

  return (
    // cursor={cursor}
    <Flex align="center">
      {/* Button Icon with Network Badge */}
      <Box position="relative" mr={`calc(${adjustedH} / 1.6 * -1)`} zIndex={1}>
        <Flex
          userSelect="none"
          cursor={cursor}
          aspectRatio={1}
          h={`calc(${adjustedH} + 2px)`}
          bg={borderColor}
          w={w}
          borderRadius="400px"
          align="center"
          justify="center"
          onClick={onDropDown}
        >
          <Image
            src={iconUrl}
            h={`calc(${adjustedH} - 2px)`}
            w={`calc(${adjustedH} - 2px)`}
            userSelect="none"
            alt={`${displayTicker} icon`}
            objectFit="cover"
            borderRadius="400px"
            onError={(e) => {
              // Fallback to default icon if loading fails
              const target = e.target as HTMLImageElement;
              target.src = FALLBACK_TOKEN_ICON;
            }}
          />
        </Flex>
        {/* Network Badge - positioned in bottom right */}
        {asset !== "BTC" && selectedToken?.chainId && (
          <Box
            position="absolute"
            bottom="-2px"
            right="-2px"
            w="20px"
            h="20px"
            borderRadius="50%"
            bg={selectedToken.chainId === 8453 ? "white" : "#1a1a2e"}
            border="2px solid #131313"
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            <NetworkBadge chainId={selectedToken.chainId} />
          </Box>
        )}
      </Box>
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
        <Text
          fontSize={adjustedFontSize}
          color={"white"}
          fontFamily={FONT_FAMILIES.NOSTROMO}
          userSelect="none"
        >
          {displayTicker}
        </Text>
        <FaChevronDown
          size={arrowSize}
          color="white"
          style={{ marginTop: "2px", marginRight: "-6px" }}
        />
      </Flex>
    </Flex>
  );
};

export default WebAssetTag;
