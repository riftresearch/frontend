import { Flex, Text, Spacer } from "@chakra-ui/react";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { FaRegArrowAltCircleRight } from "react-icons/fa";
import { HiOutlineExternalLink } from "react-icons/hi";
import { bitcoinStyle, cbBTCStyle } from "@/utils/constants";

// Mock swap data for display
const mockSwaps = [
  {
    id: "1",
    amount: "0.125",
    asset: "cbBTC",
    outputAmount: "0.124",
    outputAsset: "BTC",
    status: "Completed",
    timeAgo: "2 hours ago",
    txHash: "0x1234567890abcdef",
  },
  {
    id: "2",
    amount: "0.089",
    asset: "cbBTC",
    outputAmount: "0.088",
    outputAsset: "BTC",
    status: "Pending",
    timeAgo: "4 hours ago",
    txHash: "0x8765432109fedcba",
  },
  {
    id: "3",
    amount: "0.234",
    asset: "cbBTC",
    outputAmount: "0.232",
    outputAsset: "BTC",
    status: "Completed",
    timeAgo: "1 day ago",
    txHash: "0x9999111122223333",
  },
  {
    id: "4",
    amount: "0.067",
    asset: "cbBTC",
    outputAmount: "0.066",
    outputAsset: "BTC",
    status: "Failed",
    timeAgo: "2 days ago",
    txHash: "0x2222888844446666",
  },
  {
    id: "5",
    amount: "0.156",
    asset: "cbBTC",
    outputAmount: "0.154",
    outputAsset: "BTC",
    status: "Completed",
    timeAgo: "3 days ago",
    txHash: "0x3333777755559999",
  },
];

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

const SwapCard = ({ swap }: { swap: (typeof mockSwaps)[0] }) => {
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

      {/* Swaps List */}
      <Flex
        direction="column"
        maxH="400px"
        overflowY="auto"
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
        {mockSwaps.map((swap) => (
          <SwapCard key={swap.id} swap={swap} />
        ))}
      </Flex>
    </Flex>
  );
};
