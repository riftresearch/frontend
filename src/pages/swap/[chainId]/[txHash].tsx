import React, { useEffect } from "react";
import { GetServerSideProps } from "next";
import { Flex, Text, Box, Spinner } from "@chakra-ui/react";
import { Navbar } from "@/components/nav/Navbar";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import { opaqueBackgroundColor } from "@/utils/constants";
import useWindowSize from "@/hooks/useWindowSize";
import { useSwapStatus } from "@/hooks/useSwapStatus";

interface SwapSuccessPageProps {
  txHash: string;
  chainId: number;
}

const SwapSuccessPage: React.FC<SwapSuccessPageProps> = ({ txHash, chainId }) => {
  const { isMobile } = useWindowSize();
  const {
    state,
    receipt,
    validateTxHash,
    auctionIndex,
    order,
  } = useSwapStatus({ 
    txHash: txHash as `0x${string}`,
    chainId 
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "invalid_tx":
      case "tx_not_found":
      case "tx_failed":
      case "auction_expired":
      case "auction_refunded":
      case "order_refunded":
        return colors.red;
      case "auction_created":
      case "order_created":
      case "order_settled":
        return colors.greenOutline;
      default:
        return colors.offWhite;
    }
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case "validating":
        return "Validating Transaction...";
      case "invalid_tx":
        return "Invalid Transaction";
      case "tx_not_found":
        return "Transaction Not Found";
      case "tx_pending":
        return "Transaction Pending...";
      case "tx_failed":
        return "Transaction Failed";
      case "processing":
        return "Processing...";
      case "auction_created":
        return "Auction Created!";
      case "auction_expired":
        return "Auction Expired";
      case "auction_refunded":
        return "Auction Refunded";
      case "order_created":
        return "Order Created!";
      case "order_settled":
        return "Swap Complete!";
      case "order_refunded":
        return "Order Refunded";
      default:
        return "Swap Status";
    }
  };

  const getStatusMessage = (status: string, error: string | null) => {
    if (error) return error;
    
    switch (status) {
      case "validating":
        return "Checking transaction status...";
      case "tx_pending":
        return "Your transaction is being processed...";
      case "processing":
        return "Processing auction status...";
      case "auction_created":
        return "Your auction has been created and is waiting to be filled!";
      case "order_created":
        return "Your auction was filled and an order has been created!";
      case "order_settled":
        return "Your swap has been completed successfully! Bitcoin has been sent to your address.";
      case "order_refunded":
        return "Your order has been refunded.";
      default:
        return "Checking swap status...";
    }
  };

  // Validate on mount
  useEffect(() => {
    validateTxHash();
  }, [validateTxHash]);

  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  return (
    <Flex
      minHeight="100vh"
      width="100%"
      backgroundImage="url('/images/rift_background_low.webp')"
      backgroundSize="cover"
      backgroundPosition="center"
      direction="column"
      fontFamily={FONT_FAMILIES.AUX_MONO}
    >
      <Navbar />

      <Flex
        flex={1}
        align="center"
        justify="center"
        py={isMobile ? "20px" : "40px"}
        px={isMobile ? "20px" : "40px"}
      >
        <Flex
          direction="column"
          align="center"
          py={isMobile ? "20px" : "27px"}
          w={isMobile ? "100%" : "630px"}
          borderRadius="30px"
          {...opaqueBackgroundColor}
          borderBottom={borderColor}
          borderLeft={borderColor}
          borderTop={borderColor}
          borderRight={borderColor}
        >
          <Flex w="91.5%" direction="column" align="center" justify="center">
            <Text
              fontSize="24px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={getStatusColor(state.status)}
              mb="20px"
              textAlign="center"
            >
              {getStatusTitle(state.status)}
            </Text>

            {(state.status === "validating" || state.status === "processing") ? (
              <Flex direction="column" align="center" mb="30px">
                <Spinner size="lg" color={colors.greenOutline} mb="20px" />
                <Text
                  fontSize="14px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.textGray}
                  textAlign="center"
                >
                  {getStatusMessage(state.status, state.error)}
                </Text>
              </Flex>
            ) : (
              <Text
                fontSize="14px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.textGray}
                mb="30px"
                textAlign="center"
              >
                {getStatusMessage(state.status, state.error)}
              </Text>
            )}

            {/* Debug: Display raw status */}
            <Text
              fontSize="12px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.red}
              mb="15px"
              textAlign="center"
            >
              DEBUG: {state.status}
            </Text>

            <Box
              bg="rgba(46, 29, 14, 0.66)"
              border="2px solid #78491F"
              borderRadius="16px"
              px="20px"
              py="20px"
              w="100%"
              maxW="500px"
            >
              <Text
                fontSize="14px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.textGray}
                mb="10px"
                textAlign="center"
              >
                Transaction Hash:
              </Text>

              <Text
                fontSize={isMobile ? "12px" : "14px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.offWhite}
                textAlign="center"
                wordBreak="break-all"
                letterSpacing="-0.5px"
                mb="15px"
              >
                {txHash}
              </Text>

              {receipt && (
                <>
                  <Text
                    fontSize="14px"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color={colors.textGray}
                    mb="5px"
                    textAlign="center"
                  >
                    Block Number: {receipt.blockNumber?.toString()}
                  </Text>
                  <Text
                    fontSize="14px"
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color={colors.textGray}
                    textAlign="center"
                  >
                    Status:{" "}
                    <Text
                      as="span"
                      color={
                        receipt.status === "success"
                          ? colors.greenOutline
                          : colors.red
                      }
                    >
                      {receipt.status === "success" ? "Success" : "Reverted"}
                    </Text>
                  </Text>
                  {auctionIndex !== null && (
                    <Text
                      fontSize="14px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      textAlign="center"
                      mt="5px"
                    >
                      Auction Index: {auctionIndex.toString()}
                    </Text>
                  )}
                </>
              )}
            </Box>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { txHash, chainId } = context.params!;

  // Basic validation that txHash is a string and looks like a transaction hash
  if (
    !txHash ||
    typeof txHash !== "string" ||
    !/^0x[a-fA-F0-9]{64}$/.test(txHash)
  ) {
    return {
      notFound: true,
    };
  }

  // Validate chainId
  const parsedChainId = parseInt(chainId as string, 10);
  if (isNaN(parsedChainId)) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      txHash,
      chainId: parsedChainId,
    },
  };
};

export default SwapSuccessPage;
