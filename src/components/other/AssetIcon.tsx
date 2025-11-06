import React from "react";
import { Box, Text, Image } from "@chakra-ui/react";

interface AssetIconProps {
  asset?: string;
  iconUrl?: string;
  size?: number;
}

export const AssetIcon: React.FC<AssetIconProps> = ({ asset, iconUrl, size = 18 }) => {
  const [hasError, setHasError] = React.useState(false);
  // Reset error state when iconUrl changes
  React.useEffect(() => {
    setHasError(false);
  }, [iconUrl]);

  if (!asset) return null;

  const getIconSrc = (assetSymbol: string): string | null => {
    const normalizedAsset = assetSymbol.toUpperCase();
    if (normalizedAsset === "BTC") return "/images/BTC_icon.svg";
    if (normalizedAsset === "CBBTC") return "/images/cbBTC_icon.svg";
    if (normalizedAsset === "ETH" || normalizedAsset === "WETH") return "/images/eth_icon.svg";
    if (normalizedAsset === "USDC") return "/images/usdc_icon.svg";
    if (normalizedAsset === "USDT") return "/images/usdt_icon.svg";
    return null;
  };

  // Determine which source to use
  const localIconSrc = getIconSrc(asset);
  const shouldUseExternalIcon = iconUrl && !hasError;
  const shouldUseLocalIcon = !shouldUseExternalIcon && localIconSrc;

  // Render default question mark icon if no valid source
  if (!shouldUseExternalIcon && !shouldUseLocalIcon) {
    return (
      <Box
        width={`${size}px`}
        height={`${size}px`}
        borderRadius="50%"
        bg="rgba(128, 128, 128, 0.3)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Text
          fontSize={`${size * 0.6}px`}
          color="rgba(200, 200, 200, 0.6)"
          fontWeight="bold"
          lineHeight="1"
        >
          ?
        </Text>
      </Box>
    );
  }

  return (
    <Image
      src={shouldUseExternalIcon ? iconUrl : localIconSrc!}
      alt={asset}
      width={`${size}px`}
      height={`${size}px`}
      style={{ opacity: 0.9 }}
      onError={() => {
        if (iconUrl) {
          console.warn(`Failed to load icon from URL: ${iconUrl}, falling back`);
        }
        setHasError(true);
      }}
      //   crossOrigin="anonymous"
    />
  );
};
