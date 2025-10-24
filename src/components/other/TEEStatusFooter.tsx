import React from "react";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { Tooltip } from "@chakra-ui/react";
import { useTEEVerification } from "@/hooks/useTEEVerification";
import { useMaxLiquidity } from "@/hooks/useLiquidity";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import useWindowSize from "@/hooks/useWindowSize";

/**
 * Liquidity indicator component
 */
interface LiquidityIndicatorProps {
  label: string;
  usdValue: string;
  isLoading: boolean;
  isError: boolean;
}

function LiquidityIndicator({ label, usdValue, isLoading, isError }: LiquidityIndicatorProps) {
  const getStatusColor = () => {
    if (isLoading) return colors.text.blue;
    if (isError) return colors.red;
    return colors.greenOutline;
  };

  const formatUsdValue = (value: string) => {
    const num = parseFloat(value);
    if (num === 0) return "$0";
    if (num < 1000) return `$${num.toFixed(0)}`;
    if (num < 1000000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${(num / 1000000).toFixed(1)}M`;
  };

  return (
    <Flex align="center" gap="4px">
      <Text fontSize="10px" color={colors.textGray} fontFamily={FONT_FAMILIES.AUX_MONO}>
        {label}:
      </Text>
      <Text
        fontSize="10px"
        color={getStatusColor()}
        fontFamily={FONT_FAMILIES.AUX_MONO}
        fontWeight="bold"
      >
        {isLoading ? "..." : isError ? "ERR" : formatUsdValue(usdValue)}
      </Text>
    </Flex>
  );
}

/**
 * Bottom footer bar that displays TEE verification status
 * Shows overall verification state and individual component states
 */
export function TEEStatusFooter() {
  const { isMobile, isTablet } = useWindowSize();
  const teeVerification = useTEEVerification();
  const liquidity = useMaxLiquidity();

  const getOverallStatusColor = () => {
    if (teeVerification.isLoading) return colors.text.blue;
    if (teeVerification.hasError) return colors.red;
    if (teeVerification.isVerified) return colors.greenOutline;
    return colors.textGray;
  };

  const getOverallStatusText = () => {
    if (teeVerification.isLoading) return "VERIFYING TEE";
    if (teeVerification.hasError) return "TEE VERIFICATION ERROR";
    if (teeVerification.isVerified) return "TEE VERIFIED";
    return "TEE UNVERIFIED";
  };

  const getOverallTooltip = () => {
    const baseMessage = (() => {
      if (teeVerification.isLoading) {
        return "Verifying Trusted Execution Environment...";
      }
      if (teeVerification.hasError) {
        return "Failed to verify TEE. This may affect security guarantees.";
      }
      if (teeVerification.isVerified) {
        return "TEE successfully verified. All security checks passed.";
      }
      return "TEE verification incomplete. Some security checks failed.";
    })();

    // Add detailed sync information with consistent formatting
    const syncDetails = [];

    // TDX Attestation status
    if (teeVerification.attestation.isLoading) {
      syncDetails.push("• TDX: Verifying attestation...");
    } else if (teeVerification.attestation.isError) {
      syncDetails.push("• TDX: Attestation verification failed");
    } else if (teeVerification.attestation.isValid) {
      syncDetails.push("• TDX: Attestation verified ✓");
    } else {
      syncDetails.push("• TDX: Attestation not verified");
    }

    // Chain sync status with stable formatting
    if (teeVerification.chainSync.isLoading) {
      syncDetails.push("• Chain Sync: Checking synchronization...");
      syncDetails.push("  - Ethereum: Checking...");
      syncDetails.push("  - Bitcoin: Checking...");
    } else if (teeVerification.chainSync.isError) {
      syncDetails.push("• Chain Sync: Verification failed");
      syncDetails.push("  - Ethereum: Error");
      syncDetails.push("  - Bitcoin: Error");
    } else if (teeVerification.chainSync.isValid) {
      const ethHeight = teeVerification.chainSync.ethereumBlockHeight?.toString() || "N/A";
      const btcHeight = teeVerification.chainSync.bitcoinBlockHeight || "N/A";
      syncDetails.push("• Chain Sync: Verified ✓");
      syncDetails.push(`  - Ethereum: Block ${ethHeight}`);
      syncDetails.push(`  - Bitcoin: Block ${btcHeight}`);
    } else {
      syncDetails.push("• Chain Sync: TEE may have stale blockchain data");
      syncDetails.push("  - Ethereum: Stale data");
      syncDetails.push("  - Bitcoin: Stale data");
    }

    return [baseMessage, "", ...syncDetails].join("\n");
  };

  // Don't render on mobile to save space
  if (isMobile) return null;

  return (
    <Box
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      bg="rgba(2, 2, 2, 0.95)"
      borderTop={`1px solid ${colors.borderGray}`}
      backdropFilter="blur(10px)"
      zIndex={1000}
      py="8px"
      px="16px"
    >
      <Flex justify="space-between" align="center" maxW="1200px" mx="auto" gap="16px">
        {/* Overall Status */}
        <Tooltip.Root openDelay={200} closeDelay={300}>
          <Tooltip.Trigger asChild>
            <Box cursor="help" p="4px" m="-4px">
              <Flex align="center" gap="8px">
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="50%"
                  bg={getOverallStatusColor()}
                  flexShrink={0}
                />
                <Text
                  fontSize={isTablet ? "11px" : "12px"}
                  color={getOverallStatusColor()}
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontWeight="bold"
                  letterSpacing="0.5px"
                >
                  {getOverallStatusText()}
                </Text>
              </Flex>
            </Box>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content
              bg={colors.offBlackLighter}
              color={colors.offWhite}
              borderRadius="8px"
              px="16px"
              py="12px"
              fontSize="11px"
              maxW="400px"
              minH="140px"
              whiteSpace="pre-line"
              border={`1px solid ${colors.borderGray}`}
              boxShadow="0 4px 12px rgba(0, 0, 0, 0.3)"
            >
              <Tooltip.Arrow />
              <Text fontFamily={FONT_FAMILIES.AUX_MONO} lineHeight="1.5">
                {getOverallTooltip()}
              </Text>
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>

        {/* Liquidity Information */}
        <Flex align="center" gap={isTablet ? "12px" : "16px"}>
          <Text
            fontSize={isTablet ? "10px" : "11px"}
            color={colors.textGray}
            fontFamily={FONT_FAMILIES.NOSTROMO}
            fontWeight="bold"
            letterSpacing="0.5px"
          >
            MAX LIQUIDITY
          </Text>

          <LiquidityIndicator
            label="BTC"
            usdValue={liquidity.maxBTCLiquidityInUsd}
            isLoading={liquidity.isLoading}
            isError={liquidity.isError}
          />

          <LiquidityIndicator
            label="cbBTC"
            usdValue={liquidity.maxCbBTCLiquidityInUsd}
            isLoading={liquidity.isLoading}
            isError={liquidity.isError}
          />
        </Flex>
      </Flex>
    </Box>
  );
}
