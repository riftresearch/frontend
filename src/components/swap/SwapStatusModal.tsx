import React from "react";
import { Text, Flex, Box, Spacer, Button, Spinner } from "@chakra-ui/react";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { HiOutlineExternalLink } from "react-icons/hi";
import { IoIosCheckmarkCircle, IoMdAlert, IoMdClose } from "react-icons/io";
import { MdList } from "react-icons/md";
import { useStore } from "@/utils/store";
import { useRouter } from "next/router";
import { GLOBAL_CONFIG } from "@/utils/constants";

export enum SwapStatus {
  WaitingForApprovalConfirmation = "WaitingForApprovalConfirmation",
  ApprovalPending = "ApprovalPending",
  WaitingForSwapConfirmation = "WaitingForSwapConfirmation",
  SwapPending = "SwapPending",
  Confirmed = "Confirmed",
  Error = "Error",
}

interface SwapStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SwapStatus;
  error: string | null;
  approvalTxHash: string | null;
  swapTxHash: string | null;
  inputAssetSymbol?: string;
}

const SwapStatusModal: React.FC<SwapStatusModalProps> = ({
  isOpen = false,
  onClose,
  status = SwapStatus.WaitingForApprovalConfirmation,
  error = null,
  approvalTxHash = null,
  swapTxHash = null,
  inputAssetSymbol = "cbBTC",
}) => {
  const isCompleted = status === SwapStatus.Confirmed;
  const isError = status === SwapStatus.Error;
  const isLoading = !isCompleted && !isError;
  const router = useRouter();
  const [isLoadingRedirect, setIsLoadingRedirect] = React.useState(false);

  const handleNavigation = (route: string) => {
    router.push(route);
  };

  const getStatusMessage = () => {
    switch (status) {
      case SwapStatus.WaitingForApprovalConfirmation:
        return "Waiting for approval confirmation...";
      case SwapStatus.ApprovalPending:
        return `Approving ${inputAssetSymbol}...`;
      case SwapStatus.WaitingForSwapConfirmation:
        return "Waiting for auction confirmation...";
      case SwapStatus.SwapPending:
        return "Creating auction...";
      case SwapStatus.Confirmed:
        return "Swap success!";
      case SwapStatus.Error:
        if (
          error &&
          error.toLowerCase().includes("user rejected transaction")
        ) {
          return "User rejected transaction";
        }
        return `Error: ${error || "Unknown error occurred"}`;
      default:
        return "Confirming...";
    }
  };

  const getSubMessage = () => {
    switch (status) {
      case SwapStatus.WaitingForApprovalConfirmation:
        return "Please confirm the approval transaction in your wallet";
      case SwapStatus.ApprovalPending:
        return "Approval transaction confirming on blockchain...";
      case SwapStatus.WaitingForSwapConfirmation:
        return "Please confirm the auction creation transaction in your wallet";
      case SwapStatus.SwapPending:
        return "Auction creation transaction confirming on blockchain...";
      case SwapStatus.Confirmed:
        return "Your auction has been created successfully!";
      default:
        return "";
    }
  };

  const getExplorerUrl = () => {
    const txHash = swapTxHash || approvalTxHash;
    if (!txHash) return "#";

    // Use basic explorer URL - can be made configurable later
    const baseUrl = GLOBAL_CONFIG.etherscanUrl;
    return `${baseUrl}/tx/${txHash}`;
  };

  const getCurrentTxHash = () => {
    return swapTxHash || approvalTxHash;
  };

  if (!isOpen) return null;

  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      width="100vw"
      height="100vh"
      zIndex={99999}
      bg="rgba(0, 0, 0, 0.8)"
      align="center"
      justify="center"
      onClick={(e) => {
        if (e.target === e.currentTarget && (isCompleted || isError)) {
          onClose();
        }
      }}
      style={{
        backdropFilter: "blur(2px)",
      }}
    >
      <Box
        bg={colors.offBlack}
        borderWidth={2}
        minH={isCompleted ? "280px" : "300px"}
        w={isError ? "600px" : isCompleted ? "400px" : "500px"}
        maxWidth="90%"
        borderColor={colors.borderGray}
        borderRadius="20px"
        fontFamily={FONT_FAMILIES.AUX_MONO}
        color={colors.offWhite}
        position="relative"
      >
        {/* Header */}
        <Flex
          pt="10px"
          pb="20px"
          fontSize="24px"
          fontFamily={FONT_FAMILIES.NOSTROMO}
          fontWeight="bold"
          justify="center"
          align="center"
          position="relative"
        >
          <Text>Swap Status</Text>
          {(isCompleted || isError) && (
            <Button
              position="absolute"
              right="15px"
              top="5px"
              bg="transparent"
              border="none"
              color={colors.textGray}
              _hover={{ color: colors.offWhite }}
              onClick={onClose}
              p="5px"
              minW="auto"
              h="auto"
            >
              <IoMdClose size="20px" />
            </Button>
          )}
        </Flex>

        {/* Body */}
        <Flex
          direction="column"
          align="center"
          justify="center"
          px="30px"
          pb="30px"
          minH="200px"
        >
          {isLoading && <Spinner size="xl" color={colors.purpleBorder} />}

          <Spacer />

          <Text
            fontSize="12px"
            w="100%"
            mt="25px"
            mb="0px"
            color={colors.textGray}
            fontWeight="normal"
            textAlign="center"
          >
            {getSubMessage()}
          </Text>

          <Flex direction="column" align="center" w="100%" justify="center">
            {isCompleted && (
              <Flex mt="-20px" ml="4px">
                <IoIosCheckmarkCircle size={45} color={colors.greenOutline} />
              </Flex>
            )}
            {isError && (
              <Flex mt="-20px" ml="4px">
                <IoMdAlert size={38} color={colors.red} />
              </Flex>
            )}

            <Text
              overflowWrap="anywhere"
              color={isCompleted ? colors.greenOutline : colors.offWhite}
              fontSize={getStatusMessage().length > 40 ? "12px" : "18px"}
              mt={isLoading ? "25px" : isCompleted ? "5px" : "20px"}
              fontWeight="bold"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              textAlign="center"
            >
              {getStatusMessage()}
              {status === SwapStatus.Confirmed && (
                <Text
                  mt="18px"
                  mb="-5px"
                  color={colors.textGray}
                  fontWeight="normal"
                  fontSize="13px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                >
                  Bitcoin will be sent to your address when the auction is
                  filled!
                </Text>
              )}
            </Text>
          </Flex>

          {isCompleted && (
            <Flex direction="column" mt="40px" w="100%">
              <Button
                bg={colors.offBlackLighter}
                borderWidth="2px"
                borderColor={colors.borderGrayLight}
                _hover={{ bg: colors.borderGray }}
                borderRadius="md"
                h="45px"
                onClick={() => {
                  window.open(getExplorerUrl(), "_blank");
                  onClose();
                }}
                disabled={!getCurrentTxHash()}
              >
                <Flex mt="-4px" mr="8px">
                  <HiOutlineExternalLink size="17px" color={colors.offWhite} />
                </Flex>
                <Text
                  fontSize="14px"
                  color={colors.offWhite}
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontWeight="normal"
                >
                  View on Explorer
                </Text>
              </Button>

              <Button
                mt="10px"
                bg={colors.purpleBackground}
                borderWidth="2px"
                h="45px"
                borderColor={colors.purpleBorder}
                fontWeight="normal"
                onClick={() => {
                  handleNavigation("/activity");
                  setIsLoadingRedirect(true);
                  onClose();
                }}
                _hover={{ bg: colors.purpleHover }}
                borderRadius="md"
              >
                {!isLoadingRedirect && (
                  <Flex mt="-2px" mr="8px">
                    <MdList size={18} color={colors.offWhite} />
                  </Flex>
                )}
                {isLoadingRedirect ? (
                  <Spinner size="sm" color={colors.offWhite} />
                ) : (
                  <Text
                    fontSize="14px"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    color={colors.offWhite}
                  >
                    Swap Activity
                  </Text>
                )}
              </Button>
            </Flex>
          )}

          {isError && (
            <>
              <Box
                mt={4}
                p={2}
                bg="#2E1C0C"
                border="1px solid #78491F"
                borderRadius="md"
              >
                <Text overflowWrap="anywhere" fontSize="12px" color="#FF6B6B">
                  {typeof error === "string" &&
                  error.toLowerCase().includes("user rejected transaction")
                    ? "User rejected the transaction, please try again."
                    : error || "An unknown error occurred. Please try again."}
                </Text>
              </Box>
              <Button
                mt="25px"
                onClick={onClose}
                bg={colors.borderGray}
                borderWidth={2}
                borderColor={colors.offBlackLighter2}
                _hover={{ bg: colors.offBlackLighter2 }}
                color={colors.offWhite}
                fontFamily={FONT_FAMILIES.AUX_MONO}
              >
                Dismiss
              </Button>
            </>
          )}
        </Flex>
      </Box>
    </Flex>
  );
};

export default SwapStatusModal;
