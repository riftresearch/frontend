import React from "react";
import { Box, Text, Image } from "@chakra-ui/react";
import BASE_ADDRESS_METADATA from "@/utils/tokenData/8453/address_to_metadata.json";
import ETHEREUM_ADDRESS_METADATA from "@/utils/tokenData/1/address_to_metadata.json";

interface AssetIconProps {
  asset?: string;
  iconUrl?: string;
  size?: number;
  address?: string;
  chainId?: number;
}

type TokenMetadata = {
  name?: string;
  ticker?: string;
  decimals?: number;
  icon?: string | null;
};

const getMetadataByChain = (chainId: number): Record<string, TokenMetadata> => {
  if (chainId === 8453) return BASE_ADDRESS_METADATA as Record<string, TokenMetadata>;
  return ETHEREUM_ADDRESS_METADATA as Record<string, TokenMetadata>;
};

export const AssetIcon: React.FC<AssetIconProps> = ({ asset, iconUrl, size = 18, address, chainId = 1 }) => {
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
    if (normalizedAsset === "ETH" || normalizedAsset === "WETH") return "/images/eth_logo.svg";
    if (normalizedAsset === "USDC") return "/images/usdc_icon.svg";
    if (normalizedAsset === "USDT") return "/images/usdt_icon.svg";
    if (normalizedAsset === "WBTC") return "/images/assets/icons/WBTC.svg";
    return null;
  };

  const getIconFromMetadata = (tokenAddress: string, chain: number): string | null => {
    const metadata = getMetadataByChain(chain);
    const tokenMeta = metadata[tokenAddress.toLowerCase()];
    return tokenMeta?.icon || null;
  };

  // Determine which source to use - check in order of priority
  const localIconSrc = getIconSrc(asset);
  const metadataIconSrc = address ? getIconFromMetadata(address, chainId) : null;
  
  // Priority: iconUrl > localIcon > metadataIcon (from address lookup)
  const shouldUseExternalIcon = iconUrl && !hasError;
  const shouldUseLocalIcon = !shouldUseExternalIcon && localIconSrc;
  const shouldUseMetadataIcon = !shouldUseExternalIcon && !shouldUseLocalIcon && metadataIconSrc;

  // Render default question mark icon if no valid source
  if (!shouldUseExternalIcon && !shouldUseLocalIcon && !shouldUseMetadataIcon) {
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

  const finalIconSrc = shouldUseExternalIcon 
    ? iconUrl 
    : shouldUseLocalIcon 
      ? localIconSrc! 
      : metadataIconSrc!;

  return (
    <Image
      src={finalIconSrc}
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
    />
  );
};
