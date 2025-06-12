import { Flex, Text, Box } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { BITCOIN_DECIMALS } from "@/utils/constants";
import Image from "next/image";
import { NetworkIcon } from "./NetworkIcon";
import { reownModal } from "@/utils/wallet";
import { useStore } from "@/utils/store";
import { useAccount } from "wagmi";
import { useERC20Balance } from "@/hooks/useERC20Balance";

export const AssetBalanceDisplay = () => {
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const appKitChainId = reownModal.getChainId();

  const { address } = useAccount();
  const { formattedBalance, isLoading } = useERC20Balance({
    userAddress: address,
    tokenAddress: selectedChainConfig.underlyingSwappingAsset
      .tokenAddress as `0x${string}`,
  });

  // Format balance for display
  const formatBalance = () => {
    if (formattedBalance === undefined || formattedBalance === null) return "0";
    const num = parseFloat(formattedBalance.toString());
    if (isNaN(num)) return "0";

    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: BITCOIN_DECIMALS,
    }).format(num);
  };

  return (
    <Box
      border={`2.5px solid ${selectedChainConfig.underlyingSwappingAsset.style.border_color}`}
      h="42px"
      minW="180px"
      color={colors.offWhite}
      pt="2px"
      bg={selectedChainConfig.underlyingSwappingAsset.style.dark_bg_color}
      mr="2px"
      px="0"
      borderRadius={"12px"}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      <Flex alignItems="center" ml="15px">
        <Image
          src={
            selectedChainConfig.underlyingSwappingAsset.style.logoURI ||
            selectedChainConfig.underlyingSwappingAsset.style.icon_svg
          }
          alt={`${selectedChainConfig.underlyingSwappingAsset.style.name} icon`}
          width={22}
          height={22}
          style={{ marginRight: "8px" }}
        />
        <NetworkIcon />
      </Flex>
      <Flex
        alignItems="center"
        fontSize="17px"
        px="15px"
        fontFamily={"aux"}
        flexShrink={0}
      >
        {formatBalance()}
        <Text color={colors.offWhite} ml="8px" whiteSpace="nowrap">
          {selectedChainConfig.underlyingSwappingAsset.style.display_name}
        </Text>
      </Flex>
    </Box>
  );
};
