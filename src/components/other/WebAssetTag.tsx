import { Flex, Text, FlexProps, Image } from "@chakra-ui/react";
import { colors } from "../../utils/colors";
import { FONT_FAMILIES } from "../../utils/font";
import { FaChevronDown } from "react-icons/fa";
import useWindowSize from "@/hooks/useWindowSize";
import { ARBITRUM_LOGO, BASE_LOGO } from "./SVGs";
import { useStore } from "@/utils/store";
import { FALLBACK_TOKEN_ICON, BTC_ICON, ETH_ICON } from "@/utils/constants";
import { mainnet, base } from "@reown/appkit/networks";

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
  const { evmConnectWalletChainId, selectedInputToken, selectedOutputToken } = useStore();

  const adjustedH = (h ?? isMobile) ? "30px" : "36px";
  const adjustedFontSize = fontSize ?? `calc(${adjustedH} / 2 + 0px)`;
  const arrowSize = fontSize ?? `calc(${adjustedH} / 2.5)`;
  const adjustedBorderRadius = `calc(${adjustedH} / 4)`;

  // Select the appropriate token based on isOutput flag
  const selectedToken = isOutput ? selectedOutputToken : selectedInputToken;
  const displayTicker = asset === "BTC" ? "BTC" : selectedToken?.ticker || "ETH";

  // Use selected token's icon if available and valid, otherwise fallback
  const iconUrl = asset === "BTC" ? BTC_ICON : selectedToken?.icon || ETH_ICON;

  const colorKey = asset === "BTC" ? "btc" : (displayTicker || asset).toLowerCase();
  const colorDef = colors.assetTag[colorKey as keyof typeof colors.assetTag] || colors.assetTag.eth;
  const bgColor = colorDef.background;
  const borderColor = colorDef.border;

  // Determine network logo and colors based on chain ID
  const isEthereum = evmConnectWalletChainId === mainnet.id;
  const isBase = evmConnectWalletChainId === base.id;

  const networkBgColor = isEthereum
    ? colors.assetTag.eth.background
    : colors.assetTag.cbbtc.background; // Default to Base colors for other chains

  const networkBorderColor = isEthereum ? colors.assetTag.eth.border : colors.assetTag.cbbtc.border; // Default to Base colors for other chains

  const pX = px ?? "20px";

  return (
    // cursor={cursor}
    <Flex align="center">
      {/* Button Icon */}
      <Flex
        userSelect="none"
        cursor={cursor}
        aspectRatio={1}
        h={`calc(${adjustedH} + 2px)`}
        bg={borderColor}
        w={w}
        borderRadius="400px"
        mr={`calc(${adjustedH} / 1.6 * -1)`}
        zIndex={1}
        align="center"
        justify="center"
        // cursor={onDropDown || pointer ? 'pointer' : 'auto'}
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
        {asset !== "BTC" && asset !== "CBBTC" && (
          <FaChevronDown
            size={arrowSize}
            color="white"
            style={{ marginTop: "2px", marginRight: "-6px" }}
          />
        )}
      </Flex>
      {/* TODO: add back network icon when we support other chains */}
      {/* {asset !== "BTC" && (
        <Flex
          userSelect="none"
          bg={networkBgColor}
          border={`2px solid ${networkBorderColor}`}
          borderWidth={borderWidth}
          h={adjustedH}
          w={adjustedH}
          borderRadius={adjustedBorderRadius}
          align="center"
          justify="center"
          ml="6px"
          cursor={cursor}
          onClick={onDropDown}
        >
          {isBase ? (
            <BASE_LOGO width="22" height="22" />
          ) : (
            <Image
              src="/images/assets/icons/ETH.svg"
              w="22px"
              h="22px"
              alt="Ethereum"
              objectFit="contain"
            />
          )}
        </Flex>
      )} */}
    </Flex>
  );
};

export default WebAssetTag;
