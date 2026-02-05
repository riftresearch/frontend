import { Flex, Text, Spinner, Box, Button } from "@chakra-ui/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { FONT_FAMILIES } from "@/utils/font";
import { useRouter } from "next/router";
import { useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { colors } from "@/utils/colors";
import { GLOBAL_CONFIG, riftApiClient, IS_FRONTEND_PAUSED } from "@/utils/constants";
import { useStore } from "@/utils/store";
import { toastInfo, toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Address, erc20Abi, parseUnits } from "viem";
import { mainnet, base } from "viem/chains";
import { ApprovalState } from "@/utils/types";
import { fetchGasParams, getSlippageBpsForNotional } from "@/utils/swapHelpers";
import { useBitcoinTransaction } from "@/hooks/useBitcoinTransaction";
import { Currencies, createCurrency } from "@riftresearch/sdk";

export const SwapButton = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isMobile } = useWindowSize();
  const router = useRouter();
  const { setShowAuthFlow } = useDynamicContext();

  // Bitcoin transaction hook for BTC->cbBTC auto-send
  const {
    sendBitcoin,
    transactionState: btcTransactionState,
    isLoading: isBtcTxLoading,
    error: btcTxError,
  } = useBitcoinTransaction();

  // Local state
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [swapButtonPressed, setSwapButtonPressed] = useState(false);
  const [isCbBTCTransferPending, setIsCbBTCTransferPending] = useState(false);

  // Terms of Service modal state
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);

  // Check if user has agreed to ToS
  const hasTosAgreement = useCallback(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rift_tos_agreed") === "true";
  }, []);

  // Blur any focused elements when ToS modal opens to prevent focus rings
  useEffect(() => {
    if (showTosModal && typeof document !== "undefined") {
      (document.activeElement as HTMLElement)?.blur?.();
    }
  }, [showTosModal]);

  // Save ToS agreement
  const saveTosAgreement = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rift_tos_agreed", "true");
    }
  }, []);

  // Global store
  const {
    swapResponse,
    setSwapResponse,
    setTransactionConfirmed,
    inputToken,
    outputToken,
    displayedInputAmount,
    fullPrecisionInputAmount,
    outputAmount,
    quote,
    setQuote,
    payoutAddress,
    addressValidation,
    btcRefundAddress,
    btcRefundAddressValidation,
    selectedInputAddress,
    approvalState,
    setApprovalState,
    isOtcServerDead,
    isRetryingOtcServer,
    hasNoRoutesError,
    exceedsAvailableBTCLiquidity,
    exceedsAvailableCBBTCLiquidity,
    exceedsUserBalance,
    inputBelowMinimum,
    refetchQuote,
    setRefetchQuote,
    isAwaitingOptimalQuote,
    btcPrice,
    ethPrice,
    erc20Price,
    evmWalletClient,
    btcAddress,
    evmAddress,
    rift,
    doSwap,
    setActiveSwapId,
  } = useStore();

  // Public clients for swap execution
  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const basePublicClient = usePublicClient({ chainId: base.id });

  // Derive swap direction and chain ID from token chains
  const isSwappingForBTC = outputToken.chain === "bitcoin";
  const evmConnectWalletChainId = inputToken.chain === "bitcoin" ? 1 : inputToken.chain;

  const isEvmConnected = !!evmAddress;

  // Ref to track previous refetchQuote value for retry detection
  const prevRefetchQuoteRef = useRef(refetchQuote);

  // Helper function to handle swap errors with specific messaging
  // Defined inside component to access state setters for loading cancellation
  const handleSwapError = (error: unknown) => {
    console.error("Swap Error:", error);

    // Cancel all loading states on the button
    setSwapButtonPressed(false);
    setIsApprovingToken(false);

    // Clear and refetch the quote
    setQuote(null);
    setRefetchQuote(true);

    // Check if it's an OFAC-related error by examining the error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.toLowerCase().includes("ofac") ||
      errorMessage.toLowerCase().includes("sanction")
    ) {
      toastError(error, {
        title: "Address Blocked",
        description:
          "This address is blocked due to sanctions compliance. We cannot process swaps for sanctioned addresses.",
      });
      return;
    }

    // Default error message
    toastError(error, {
      title: "Swap Failed",
      description: "Try refreshing the quote and try again.",
    });
  };

  // Transaction state for direct wallet client interactions
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  // Wait for approval transaction confirmation
  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalConfirmed,
    error: approvalTxError,
  } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  // Wait for writeContract transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Check token allowance
  const isNativeETH = inputToken.ticker === "ETH";

  const isCbBTC = inputToken.ticker === "cbBTC";

  // Button loading state combines pending transaction, approval, and confirmation waiting
  const isButtonLoading =
    isPending || isConfirming || isApprovingToken || isApprovalConfirming || isBtcTxLoading;

  // Check if all required fields are filled
  const allFieldsFilled =
    displayedInputAmount &&
    outputAmount &&
    parseFloat(displayedInputAmount) > 0 &&
    parseFloat(outputAmount) > 0 &&
    payoutAddress &&
    addressValidation.isValid;

  // ============================================================================
  // SWAP-RELATED FUNCTIONS
  // ============================================================================

  // Helper to build execute params for SDK
  const getExecuteParams = useCallback(() => {
    const publicClient = inputToken.chain === 8453 ? basePublicClient : mainnetPublicClient;
    if (!evmWalletClient) {
      throw new Error("EVM wallet client not available");
    }
    return {
      publicClient,
      walletClient: evmWalletClient,
      sendBitcoin: async ({ recipient, amountSats }: { recipient: string; amountSats: string }): Promise<void> => {
        if (!btcAddress) {
          throw new Error("No BTC wallet connected");
        }
        await sendBitcoin(btcAddress, recipient, parseInt(amountSats, 10));
      },
    };
  }, [inputToken.chain, basePublicClient, mainnetPublicClient, evmWalletClient, btcAddress, sendBitcoin]);

  // Main swap handler - uses Rift SDK for execution
  const startSwap = useCallback(async () => {
    try {
      setSwapButtonPressed(true);

      // Validate wallet client is available
      if (!evmWalletClient) {
        throw new Error("EVM wallet not connected");
      }

      const executeParams = getExecuteParams();

      if (doSwap) {
        // Real quote - call doSwap directly
        const swap = await doSwap(executeParams);
        setActiveSwapId(swap.swapId);
      } else {
        // Dummy quote - fetch new quote with real addresses and execute
        if (!rift) {
          throw new Error("SDK not initialized");
        }

        const fromCurrency =
          inputToken.chain === "bitcoin"
            ? Currencies.Bitcoin.BTC
            : createCurrency({
                chainId: inputToken.chain as number,
                address: inputToken.address as `0x${string}`,
                decimals: inputToken.decimals,
              });
        const toCurrency =
          outputToken.chain === "bitcoin"
            ? Currencies.Bitcoin.BTC
            : createCurrency({
                chainId: outputToken.chain as number,
                address: outputToken.address as `0x${string}`,
                decimals: outputToken.decimals,
              });

        const { quote: newQuote, executeSwap } = await rift.getQuote({
          from: fromCurrency,
          to: toCurrency,
          amount: fullPrecisionInputAmount || displayedInputAmount,
          mode: "exact_input",
          destinationAddress: isSwappingForBTC ? btcAddress! : evmAddress!,
        });

        const swap = await executeSwap(executeParams);
        setActiveSwapId(swap.swapId);
      }
    } catch (error) {
      console.error("startSwap error caught:", error);
      setSwapButtonPressed(false);
      toastError(error as Error, {
        title: "Swap Failed",
        description: "Failed to execute swap. Please try again.",
      });
    }
  }, [
    doSwap,
    rift,
    inputToken,
    outputToken,
    fullPrecisionInputAmount,
    displayedInputAmount,
    isSwappingForBTC,
    btcAddress,
    evmAddress,
    evmWalletClient,
    getExecuteParams,
    setActiveSwapId,
  ]);

  // Unified handler that checks approval and routes to appropriate action
  const handleSwapButtonClick = useCallback(async () => {
    // Check input amount
    if (
      !displayedInputAmount ||
      !outputAmount ||
      parseFloat(displayedInputAmount) <= 0 ||
      parseFloat(outputAmount) <= 0
    ) {
      toastInfo({
        title: "Enter Amount",
        description: "Please enter a valid amount to swap",
      });
      return;
    }

    // Wallet connection checks
    if (isSwappingForBTC) {
      // EVM->BTC: Need EVM wallet to send, BTC address to receive
      if (!evmAddress) {
        toastInfo({
          title: "Connect Ethereum Wallet",
          description: "Please connect an Ethereum wallet to swap",
        });
        setShowAuthFlow(true);
        return;
      }
      if (!btcAddress && !payoutAddress) {
        toastInfo({
          title: "Paste or Connect Bitcoin Wallet",
          description: "Please connect a Bitcoin wallet or paste a Bitcoin address to receive BTC",
        });
        return;
      }
      if (payoutAddress && !addressValidation.isValid) {
        toastInfo({
          title: "Invalid Bitcoin Address",
          description: "Please enter a valid Bitcoin address",
        });
        return;
      }
    } else {
      // BTC->EVM: Need both wallets connected
      if (!btcAddress) {
        toastInfo({
          title: "Connect Bitcoin Wallet",
          description: "Please connect a Bitcoin wallet to send BTC",
        });
        setShowAuthFlow(true);
        return;
      }
      if (!evmAddress) {
        toastInfo({
          title: "Connect Ethereum Wallet",
          description: "Please connect an Ethereum wallet to receive",
        });
        setShowAuthFlow(true);
        return;
      }
    }

    // Start the swap
    console.log("Starting swap...");
    await startSwap();
  }, [
    startSwap,
    payoutAddress,
    addressValidation,
    isSwappingForBTC,
    isEvmConnected,
    selectedInputAddress,
    displayedInputAmount,
    outputAmount,
    isNativeETH,
    isCbBTC,
  ]);

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

  // Handle transaction pending state
  useEffect(() => {
    if (isPending) {
      console.log("Transaction pending...");
    }
  }, [isPending]);

  // Update store when transaction is confirmed
  useEffect(() => {
    console.log("isConfirmed", isConfirmed);
    if (isConfirmed) {
      setTransactionConfirmed(true);
    }
  }, [isConfirmed, setTransactionConfirmed]);

  // Handle user declined transaction in wallet
  useEffect(() => {
    if (writeError) {
      console.warn("Transaction error:", writeError);

      // Check if user rejected the request
      const errorMessage = writeError?.message || "";
      const isUserRejection = errorMessage.includes("User rejected the request");
      const isInternalError = errorMessage.includes("An internal error was received");

      // Custom BTC orange toast based on error type
      if (isUserRejection) {
        toastInfo({
          title: "Transaction Declined",
          description: "The user declined the transaction request",
          customStyle: {
            background: `${colors.assetTag.btc.background}`,
          },
        });
      } else if (isInternalError) {
        toastInfo({
          title: "Transaction Failed",
          description: errorMessage,
          customStyle: {
            background: `${colors.assetTag.btc.background}`,
          },
        });
      } else {
        // Fallback for other errors
        toastInfo({
          title: "Transaction Failed",
          description: "The transaction could not be completed",
          customStyle: {
            background: `${colors.assetTag.btc.background}`,
          },
        });
      }

      // Reset swap button state
      setSwapButtonPressed(false);
      setIsApprovingToken(false);
      setIsCbBTCTransferPending(false);
      setQuote(null);
      setRefetchQuote(true);
    }
  }, [writeError, setRefetchQuote]);

  // Handle transaction receipt errors
  useEffect(() => {
    if (txError) {
      console.error("Transaction error:", txError);
      // Custom BTC orange toast for transaction failed
      toastInfo({
        title: "Transaction Failed",
        description: "The transaction failed on the network",
        customStyle: {
          background: `${colors.assetTag.btc.background}`,
        },
      });
      // Reset swap button state
      setSwapButtonPressed(false);
      setIsApprovingToken(false);
    }
  }, [txError]);

  // Capture approval transaction hash
  useEffect(() => {
    if (hash && isApprovingToken) {
      console.log("Approval transaction hash:", hash);
      setApprovalTxHash(hash);
      setIsApprovingToken(false);
    }
  }, [hash, isApprovingToken]);

  // Handle cbBTC transfer: redirect to swap monitoring page when transaction is signed
  useEffect(() => {
    if (hash && isCbBTCTransferPending && swapResponse?.id) {
      console.log("cbBTC transfer signed, redirecting to swap page:", swapResponse.id);
      setIsCbBTCTransferPending(false);
      router.push(`/swap/${swapResponse.id}`);
    }
  }, [hash, isCbBTCTransferPending, swapResponse?.id, router]);

  // Handle approval confirmation and errors
  useEffect(() => {
    if (isApprovalConfirmed) {
      console.log("Approval confirmed");
      setApprovalState(ApprovalState.APPROVED);
      setIsApprovingToken(false);
      // Auto-execute swap after approval is confirmed
      if (swapButtonPressed) {
        startSwap();
      }
    } else if (approvalTxError) {
      console.error("Approval transaction error:", approvalTxError);
      setApprovalState(ApprovalState.NEEDS_APPROVAL);
      toastInfo({
        title: "Approval Failed",
        description: "The approval transaction failed on the network",
        customStyle: {
          background: `${colors.assetTag.btc.background}`,
        },
      });
      // Reset swap button state
      setSwapButtonPressed(false);
      setIsApprovingToken(false);
      setApprovalTxHash(undefined);
    }
  }, [isApprovalConfirmed, approvalTxError, setApprovalState, swapButtonPressed, startSwap]);

  // Auto-retry swap after quote refetch completes
  useEffect(() => {
    const wasRefetching = prevRefetchQuoteRef.current === true;
    const isDoneRefetching = refetchQuote === false;

    // Detect transition from refetching → done refetching
    if (wasRefetching && isDoneRefetching && quote !== null && swapButtonPressed) {
      console.log("Auto-retrying swap after quote refetch completed");
      startSwap();
      // Update ref to prevent re-triggering on subsequent renders
      prevRefetchQuoteRef.current = false;
    } else {
      // Update ref with current value
      prevRefetchQuoteRef.current = refetchQuote;
    }
  }, [refetchQuote, quote, swapButtonPressed, startSwap]);

  // Track previous wallet connection state for detecting connection events
  const wasWalletConnectedRef = useRef(isEvmConnected);

  // Auto-trigger swap when wallet connects while an executable quote exists
  useEffect(() => {
    const justConnected = !wasWalletConnectedRef.current && isEvmConnected;
    wasWalletConnectedRef.current = isEvmConnected;

    if (justConnected && quote !== null) {
      console.log("Wallet connected with quote - triggering swap");
      handleSwapButtonClick();
    }
  }, [isEvmConnected, quote, handleSwapButtonClick]);

  // Handle keyboard events (Enter to submit)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && allFieldsFilled && !isButtonLoading) {
        event.preventDefault();
        handleSwapButtonClick();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [allFieldsFilled, isButtonLoading, handleSwapButtonClick]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Determine button text and click handler
  const getButtonTextAndHandler = () => {
    // Check validation errors first
    if (exceedsAvailableBTCLiquidity || exceedsAvailableCBBTCLiquidity) {
      return {
        text: "Not enough liquidity",
        handler: undefined,
        showSpinner: false,
      };
    }

    // If there's a "no routes found" error, disable button with message
    if (hasNoRoutesError) {
      return {
        text: "No routes found",
        handler: undefined,
        showSpinner: false,
      };
    }

    if (exceedsUserBalance) {
      return {
        text: `Not enough ${isSwappingForBTC ? inputToken.ticker : "BTC"}`,
        handler: undefined,
        showSpinner: false,
      };
    }

    if (inputBelowMinimum) {
      return {
        text: "Swap too small",
        handler: undefined,
        showSpinner: false,
      };
    }

    // If approving token
    if (approvalState === ApprovalState.APPROVING || isApprovalConfirming || isApprovingToken) {
      return {
        text: "Approving...",
        handler: undefined,
        showSpinner: true,
      };
    }

    // If swap transaction is pending/confirming
    if (isPending) {
      return {
        text: "Signing Swap...",
        handler: undefined,
        showSpinner: true,
      };
    }
    if (isConfirming) {
      return {
        text: "Signing Swap...",
        handler: undefined,
        showSpinner: true,
      };
    }

    // Bitcoin transaction states (BTC->cbBTC swaps)
    if (btcTransactionState === "preparing") {
      return {
        text: "Preparing...",
        handler: undefined,
        showSpinner: true,
      };
    }
    if (btcTransactionState === "signing") {
      return {
        text: "Sign in Wallet...",
        handler: undefined,
        showSpinner: true,
      };
    }
    if (btcTransactionState === "broadcasting") {
      return {
        text: "Sending BTC...",
        handler: undefined,
        showSpinner: true,
      };
    }

    if (swapButtonPressed) {
      return {
        text: "",
        handler: undefined,
        showSpinner: true,
      };
    }

    // Default: Show "Swap"
    return {
      text: "Swap",
      handler: handleSwapButtonClick,
      showSpinner: false,
    };
  };

  const buttonConfig = getButtonTextAndHandler();

  const hasValidationError =
    exceedsUserBalance ||
    exceedsAvailableBTCLiquidity ||
    exceedsAvailableCBBTCLiquidity ||
    inputBelowMinimum;

  const isButtonDisabled =
    isButtonLoading ||
    isOtcServerDead ||
    isRetryingOtcServer ||
    hasNoRoutesError ||
    hasValidationError;

  // console.log("[DEBUG] Button state:", {
  //   exceedsUserBalance,
  //   exceedsAvailableBTCLiquidity,
  //   exceedsAvailableCBBTCLiquidity,
  //   inputBelowMinimum,
  //   hasValidationError,
  //   isButtonLoading,
  //   isOtcServerDead,
  //   isRetryingOtcServer,
  //   hasNoRoutesError,
  //   isButtonDisabled,
  // });

  const handleButtonClick = () => {
    if (isRetryingOtcServer) {
      toastInfo({
        title: "Service Temporarily Unavailable",
        description: "Rift is currently down for maintenance. Please try again later.",
      });
      return;
    }

    if (isOtcServerDead || IS_FRONTEND_PAUSED) {
      toastInfo({
        title: "Service Unavailable",
        description:
          "Rift is currently down for maintenance. Your funds are safe.Please try again later.",
      });
      return;
    }

    // Check ToS agreement before proceeding
    if (!hasTosAgreement()) {
      setShowTosModal(true);
      return;
    }

    if (!isButtonDisabled && buttonConfig.handler) {
      buttonConfig.handler();
    }
  };

  // Handler for ToS agreement
  const handleTosAgree = () => {
    if (tosChecked) {
      saveTosAgreement();
      setShowTosModal(false);
      // Proceed with the swap after agreement
      if (!isButtonDisabled && buttonConfig.handler) {
        buttonConfig.handler();
      }
    }
  };

  return (
    <Flex direction="column" w="100%">
      {/* Single Dynamic Swap Button */}
      <Flex
        bg={colors.swapBgColor}
        _hover={{
          bg: !isButtonDisabled ? colors.swapHoverColor : undefined,
        }}
        w="100%"
        mt="8px"
        transition="0.2s"
        h="58px"
        onClick={handleButtonClick}
        fontSize="18px"
        align="center"
        userSelect="none"
        cursor={!isButtonDisabled ? "pointer" : "not-allowed"}
        borderRadius="16px"
        justify="center"
        border="3px solid"
        borderColor={colors.swapBorderColor}
        opacity={isButtonDisabled ? 0.5 : 1}
        pointerEvents={isButtonDisabled ? "none" : "auto"}
      >
        {buttonConfig.showSpinner && <Spinner size="sm" color={colors.offWhite} mr="10px" />}
        <Text color={colors.offWhite} fontFamily="Nostromo">
          {buttonConfig.text}
        </Text>
      </Flex>

      {/* Terms of Service Modal */}
      {showTosModal && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(0, 0, 0, 0.85)"
          zIndex={99999}
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={() => setShowTosModal(false)}
          style={{ isolation: "isolate" }}
          borderRadius="30px"
        >
          <Box
            bg="#0a0a0a"
            border={`2px solid ${colors.borderGray}`}
            borderRadius="24px"
            p={isMobile ? "24px" : "32px"}
            maxW="450px"
            w={isMobile ? "90%" : "450px"}
            onClick={(e) => e.stopPropagation()}
            position="relative"
            zIndex={100000}
            boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)"
          >
            <Text
              fontSize={isMobile ? "20px" : "24px"}
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              mb="16px"
              textAlign="center"
            >
              Terms of Use
            </Text>
            <Text
              fontSize="14px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.textGray}
              mb="24px"
              textAlign="center"
              letterSpacing="-0.5px"
            >
              To use Rift, you must agree to our Terms of Service and Privacy Policy.
            </Text>

            <Flex
              align="flex-start"
              gap="12px"
              mb="24px"
              cursor="pointer"
              onClick={() => setTosChecked(!tosChecked)}
              position="relative"
              zIndex={100001}
            >
              <Box
                w="24px"
                h="24px"
                minW="24px"
                borderRadius="6px"
                border={`2px solid ${tosChecked ? colors.RiftOrange : colors.borderGray}`}
                bg={tosChecked ? colors.RiftOrange : "transparent"}
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.15s ease"
                mt="2px"
              >
                {tosChecked && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M11.5 4L5.5 10L2.5 7"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Box>
              <Text
                fontSize="13px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.offWhite}
                letterSpacing="-0.3px"
                lineHeight="1.5"
              >
                I agree to Rift&apos;s{" "}
                <a
                  href="https://rift.exchange/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: colors.RiftOrange,
                    textDecoration: "underline",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="https://rift.exchange/pp"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: colors.RiftOrange,
                    textDecoration: "underline",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>
              </Text>
            </Flex>

            <Flex gap="12px">
              <Button
                flex={1}
                onClick={() => setShowTosModal(false)}
                bg="transparent"
                border={`2px solid ${colors.borderGray}`}
                color={colors.offWhite}
                borderRadius="12px"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                h="48px"
                _hover={{ bg: "rgba(255,255,255,0.05)" }}
              >
                Cancel
              </Button>
              <Button
                flex={1}
                onClick={handleTosAgree}
                bg={tosChecked ? colors.RiftOrange : "rgba(255,143,40,0.3)"}
                border="none"
                color={colors.offWhite}
                borderRadius="12px"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                h="48px"
                opacity={tosChecked ? 1 : 0.5}
                cursor={tosChecked ? "pointer" : "not-allowed"}
                _hover={{ opacity: tosChecked ? 0.9 : 0.5 }}
              >
                Continue
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Flex>
  );
};
