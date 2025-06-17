import { Flex, Text, Spacer } from "@chakra-ui/react";
import { useCallback } from "react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { HiOutlineExternalLink } from "react-icons/hi";
import { bitcoinStyle, cbBTCStyle } from "@/utils/constants";
import { SwapHistoryItem } from "@/utils/types";
import { useSwapHistory } from "@/hooks/useSwapHistory";

const AssetTag = ({
  assetName,
  width,
}: {
  assetName: string;
  width: string;
}) => {
  const style = assetName === "cbBTC" ? cbBTCStyle : bitcoinStyle;
  return (
    <Flex
      w={width}
      h="32px"
      bg={style.bg_color}
      borderRadius="8px"
      align="center"
      justify="center"
    >
      <Text
        fontSize="14px"
        fontFamily={FONT_FAMILIES.AUX_MONO}
        color={colors.offWhite}
        fontWeight="bold"
      >
        {assetName}
      </Text>
    </Flex>
  );
};

const SwapCard = ({ swap }: { swap: SwapHistoryItem }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return colors.greenOutline;
      case "Pending":
        return colors.RiftOrange;
      case "Failed":
        return colors.red;
      default:
        return colors.textGray;
    }
  };

  return (
    <Flex w="100%">
      <Flex
        bg={colors.offBlack}
        w="100%"
        mb="10px"
        fontSize="18px"
        px="16px"
        py="12px"
        align="flex-start"
        justify="flex-start"
        borderRadius="12px"
        border="2px solid"
        color={colors.textGray}
        borderColor={colors.borderGray}
        gap="12px"
        flexDirection="row"
        letterSpacing="-2px"
      >
        {/* TIMESTAMP */}
        <Flex w="100%" align="center" direction="row">
          <Text
            width="130px"
            pr="10px"
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            fontWeight="normal"
          >
            {swap.timeAgo}
          </Text>

          {/* SWAP INPUT & SWAP OUTPUT */}
          <Flex align="center" mt="-5px">
            <Flex direction="column">
              <Flex
                h="50px"
                mt="6px"
                mr="40px"
                w="100%"
                bg={cbBTCStyle.dark_bg_color}
                border="3px solid"
                borderColor={cbBTCStyle.bg_color}
                borderRadius="14px"
                pl="15px"
                pr="10px"
                align="center"
              >
                <Text
                  fontSize="16px"
                  color={colors.offWhite}
                  letterSpacing="-1px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                >
                  {swap.amount}
                </Text>
                <Spacer />
                <AssetTag assetName="cbBTC" width="110px" />
              </Flex>
            </Flex>

            <Text
              mt="7px"
              mx="12px"
              fontSize="20px"
              opacity={0.9}
              fontWeight="bold"
              color={colors.offWhite}
              letterSpacing="-1px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
            >
              <FaRegArrowAltCircleRight color={colors.RiftOrange} />
            </Text>

            <Flex direction="column">
              <Flex
                h="50px"
                mr="55px"
                mt="6px"
                w="100%"
                bg={bitcoinStyle.dark_bg_color}
                border="3px solid"
                borderColor={bitcoinStyle.bg_color}
                borderRadius="14px"
                pl="15px"
                pr="10px"
                align="center"
              >
                <Text
                  fontSize="16px"
                  color={colors.offWhite}
                  letterSpacing="-1px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                >
                  {swap.outputAmount}
                </Text>
                <Spacer />
                <AssetTag assetName="BTC" width="84px" />
              </Flex>
            </Flex>
          </Flex>

          <Spacer />

          {/* TXID */}
          <Flex
            mx="40px"
            align="center"
            cursor="pointer"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://basescan.org/tx/${swap.txHash}`, "_blank");
            }}
            _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
            p="8px"
            borderRadius="8px"
          >
            <Text
              mr="8px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              fontSize="15px"
              color={colors.textGray}
            >
              {swap.txHash.slice(0, 6)}...{swap.txHash.slice(-6)}
            </Text>
            <HiOutlineExternalLink color={colors.textGray} />
          </Flex>

          {/* STATUS */}
          <Flex align="center" mt="10px" justify="center">
            <Flex
              bg={getStatusColor(swap.status)}
              borderRadius="6px"
              px="12px"
              py="4px"
              mr="30px"
            >
              <Text
                fontFamily={FONT_FAMILIES.AUX_MONO}
                fontSize="12px"
                color={colors.offBlack}
                fontWeight="bold"
              >
                {swap.status.toUpperCase()}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
};

export const SwapHistory = () => {
  const {
    swaps,
    hasNextPage,
    isLoadingMore,
    isLoading,
    error,
    loadMore,
  } = useSwapHistory();

  // Handle scroll event for infinite loading
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const element = e.currentTarget;
      const scrolledToBottom =
        Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
      
      if (scrolledToBottom && hasNextPage && !isLoadingMore) {
        loadMore();
      }
    },
    [hasNextPage, isLoadingMore, loadMore]
  );

  if (error) {
    return (
      <Flex
        w="100%"
        direction="column"
        bg={colors.offBlack}
        border={`2px solid ${colors.borderGray}`}
        borderRadius="30px"
        p="24px"
        align="center"
        justify="center"
        minH="300px"
      >
        <Text
          fontSize="16px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.red}
          mb="4px"
        >
          Failed to load swap history
        </Text>
        <Text
          fontSize="14px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
        >
          {error.message}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex
      w="100%"
      direction="column"
      bg={colors.offBlack}
      border={`2px solid ${colors.borderGray}`}
      borderRadius="30px"
      p="24px"
    >
      {/* Header */}
      <Flex direction="column" align="center" mb="20px">
        <Text
          fontSize="16px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.textGray}
          mb="4px"
        >
          RECENT SWAP HISTORY
        </Text>
      </Flex>

      {/* Loading State */}
      {isLoading && (
        <Flex align="center" justify="center" minH="200px">
          <Text
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.textGray}
          >
            Loading swap history...
          </Text>
        </Flex>
      )}

      {/* Empty State */}
      {!isLoading && swaps.length === 0 && (
        <Flex align="center" justify="center" minH="200px">
          <Text
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.textGray}
          >
            No swap history found
          </Text>
        </Flex>
      )}

      {/* Swaps List */}
      {!isLoading && swaps.length > 0 && (
        <Flex
          direction="column"
          maxH="400px"
          overflowY="auto"
          onScroll={handleScroll}
          css={{
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: colors.borderGray,
              borderRadius: "6px",
            },
          }}
        >
          {swaps.map((swap) => (
            <SwapCard key={swap.id} swap={swap} />
          ))}
          
          {/* Loading More Indicator */}
          {isLoadingMore && (
            <Flex align="center" justify="center" py="16px">
              <Text
                fontSize="12px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.textGray}
              >
                Loading more...
              </Text>
            </Flex>
          )}
        </Flex>
      )}
    </Flex>
  );
};
