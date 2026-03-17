import { Flex, Text, Spinner, Box, Button } from "@chakra-ui/react";
import { useState, useEffect, useCallback } from "react";
import { FONT_FAMILIES } from "@/utils/font";
import { useRouter } from "next/router";
import { usePublicClient } from "wagmi";
import { colors } from "@/utils/colors";
import { IS_FRONTEND_PAUSED } from "@/utils/constants";
import { useStore } from "@/utils/store";
import { toastInfo, toastError, toastSuccess } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { mainnet, base } from "viem/chains";
import { useBitcoinTransaction } from "@/hooks/useBitcoinTransaction";
import { getDynamicWalletClient } from "@/utils/wallet";
import { validatePayoutAddress } from "@/utils/swapHelpers";
import type { ExecuteSwapStepType } from "@riftresearch/sdk";

export const SwapButton = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isMobile } = useWindowSize();
  const router = useRouter();
  const { setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();

  // Bitcoin transaction hook for BTC->cbBTC auto-send
  const { sendBitcoin, isLoading: isBtcTxLoading } = useBitcoinTransaction();

  // Local state
  const [swapButtonPressed, setSwapButtonPressed] = useState(false);
  const [swapPhase, setSwapPhase] = useState<
    "idle" | "approving" | "signing" | "confirming"
  >("idle");

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
    inputToken,
    outputToken,
    displayedInputAmount,
    outputAmount,
    isOtcServerDead,
    isRetryingOtcServer,
    exceedsAvailableBTCLiquidity,
    exceedsAvailableCBBTCLiquidity,
    exceedsAvailableLiquidity,
    exceedsUserBalance,
    inputBelowMinimum,
    setRefetchQuote,
    evmWalletClients,
    setEvmWalletClientForAddress,
    btcAddress,
    pastedBTCAddress,
    primaryEvmAddress,
    outputEvmAddress,
    executeSwap,
    setActiveSwapId,
    setIsSwapInProgress,
    setUserTokensForChain,
  } = useStore();

  // Public clients for swap execution
  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const basePublicClient = usePublicClient({ chainId: base.id });

  // Derive swap direction and chain ID from token chains
  const isSwappingForBTC = outputToken.chain === "bitcoin";
  const evmClientChainId =
    inputToken.chain === 1 || inputToken.chain === 8453
      ? inputToken.chain
      : outputToken.chain === 1 || outputToken.chain === 8453
        ? outputToken.chain
        : null;
  const activeEvmWalletClient =
    primaryEvmAddress && evmClientChainId
      ? evmWalletClients[primaryEvmAddress.toLowerCase()]?.[evmClientChainId] || null
      : null;

  // Button loading state combines BTC transaction loading and SDK swap
  const isButtonLoading = isBtcTxLoading || swapButtonPressed;

  // Check if all required fields are filled
  const destinationBtcAddress = pastedBTCAddress || btcAddress;
  const destinationEvmAddress = outputEvmAddress || primaryEvmAddress;
  const isDestinationReady = isSwappingForBTC
    ? !!destinationBtcAddress && validatePayoutAddress(destinationBtcAddress, true).isValid
    : !!destinationEvmAddress;
  const allFieldsFilled =
    displayedInputAmount &&
    outputAmount &&
    parseFloat(displayedInputAmount) > 0 &&
    parseFloat(outputAmount) > 0 &&
    isDestinationReady;

  // ============================================================================
  // SWAP-RELATED FUNCTIONS
  // ============================================================================

  // Helper to build execute params for SDK
  const getExecuteParams = useCallback(async () => {
    const publicClient = inputToken.chain === 8453 ? basePublicClient : mainnetPublicClient;
    let walletClient = activeEvmWalletClient;
    const shouldRefreshWalletClient =
      !walletClient ||
      !walletClient.chain ||
      (evmClientChainId !== null && walletClient.chain.id !== evmClientChainId);

    // Lazy fallback: if cache is cold/stale, fetch the required chain client on demand.
    if (shouldRefreshWalletClient && primaryEvmAddress && evmClientChainId) {
      const primaryEvmWallet = userWallets.find(
        (wallet) =>
          wallet.chain?.toUpperCase() === "EVM" &&
          wallet.address.toLowerCase() === primaryEvmAddress.toLowerCase()
      );

      if (primaryEvmWallet) {
        try {
          walletClient = await getDynamicWalletClient(
            primaryEvmWallet,
            primaryEvmAddress,
            evmClientChainId
          );
          setEvmWalletClientForAddress(primaryEvmAddress, evmClientChainId, walletClient);
        } catch (error) {
          console.error("[SwapButton] Failed to lazily fetch EVM wallet client:", error);
        }
      }
    }

    if (!walletClient) {
      throw new Error("EVM wallet client not available");
    }
    if (
      !walletClient.chain ||
      (evmClientChainId !== null && walletClient.chain.id !== evmClientChainId)
    ) {
      throw new Error(
        "EVM wallet client is missing chain config. Please reconnect your EVM wallet and try again."
      );
    }

    const destinationAddress = isSwappingForBTC
      ? pastedBTCAddress || btcAddress
      : outputEvmAddress || primaryEvmAddress;
    if (!destinationAddress) {
      throw new Error(
        isSwappingForBTC
          ? "No Bitcoin address available. Please connect or paste a Bitcoin destination address."
          : "No EVM address available. Please connect an Ethereum wallet."
      );
    }

    const refundAddress = inputToken.chain === "bitcoin" ? btcAddress : primaryEvmAddress;
    if (!refundAddress) {
      throw new Error(
        inputToken.chain === "bitcoin"
          ? "No Bitcoin refund address available. Please connect a Bitcoin wallet or provide a refund address."
          : "No EVM refund address available. Please connect an Ethereum wallet."
      );
    }

    return {
      destinationAddress,
      refundAddress,
      publicClient,
      walletClient,
      onExecuteStep: async (type: ExecuteSwapStepType) => {
        // The SDK calls this immediately before prompting the wallet UI.
        if (type === "approval") setSwapPhase("approving");
        else setSwapPhase("signing");
      },
      sendBitcoin: async ({
        recipient,
        amountSats,
      }: {
        recipient: string;
        amountSats: string;
      }): Promise<void> => {
        if (!btcAddress) {
          throw new Error("No BTC wallet connected");
        }
        await sendBitcoin(btcAddress, recipient, parseInt(amountSats, 10));
      },
    };
  }, [
    inputToken.chain,
    basePublicClient,
    mainnetPublicClient,
    activeEvmWalletClient,
    evmClientChainId,
    primaryEvmAddress,
    outputEvmAddress,
    isSwappingForBTC,
    pastedBTCAddress,
    setEvmWalletClientForAddress,
    userWallets,
    btcAddress,
    sendBitcoin,
  ]);

  // Helper to detect if an error is a user wallet rejection
  const isUserRejectionError = (error: unknown): boolean => {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    return (
      lower.includes("user rejected") ||
      lower.includes("user denied") ||
      lower.includes("rejected the request") ||
      lower.includes("user cancelled") ||
      lower.includes("user canceled") ||
      (error as any)?.code === 4001
    );
  };

  // Main swap handler - uses Rift SDK for execution
  const startSwap = useCallback(async () => {
    try {
      setSwapButtonPressed(true);
      setSwapPhase("signing");
      setIsSwapInProgress(true);

      if (!executeSwap) {
        throw new Error("No quote available. Please get a quote first.");
      }

      const executeParams = await getExecuteParams();

      console.log("executing swap", executeParams);
      const swap = await executeSwap(executeParams);
      setActiveSwapId(swap.orderId);
      console.log("swap executed", swap);

      const isNonBtcEvmPair = inputToken.chain !== "bitcoin" && outputToken.chain !== "bitcoin";
      if (isNonBtcEvmPair) {
        toastSuccess({
          title:
            "Transaction confirming. Your new balances will be visible in a few seconds.",
        });

        // Refresh wallet balances after 30 seconds to reflect the swap
        if (primaryEvmAddress) {
          setTimeout(async () => {
            try {
              const chainId = inputToken.chain === 8453 ? 8453 : 1;
              const response = await fetch(
                `/api/token-balance?wallet=${primaryEvmAddress}&chainId=${chainId}`
              );
              const data = await response.json();

              if (data.result?.result && Array.isArray(data.result.result)) {
                const currentTokens = useStore.getState().userTokensByChain[chainId] || [];
                const updatedTokens = currentTokens.map((token) => {
                  const newBalance = data.result.result.find(
                    (t: { address: string; totalBalance: string }) =>
                      t.address.toLowerCase() === token.address.toLowerCase()
                  );
                  if (newBalance) {
                    const decimals = token.decimals || 18;
                    const balanceFormatted = (
                      Number(BigInt(newBalance.totalBalance)) / Math.pow(10, decimals)
                    ).toString();
                    return { ...token, balance: balanceFormatted };
                  }
                  return token;
                });
                setUserTokensForChain(chainId, updatedTokens);
              }
            } catch (error) {
              console.error("Failed to refresh balances after swap:", error);
            }
          }, 30000);
        }

        setSwapButtonPressed(false);
        setSwapPhase("idle");
        setIsSwapInProgress(false);
        return;
      }

      router.push(`/swap/${swap.orderId}`);
    } catch (error) {
      console.error("startSwap error caught:", error);
      setSwapButtonPressed(false);
      setSwapPhase("idle");
      setIsSwapInProgress(false);

      if (isUserRejectionError(error)) {
        toastError(null, {
          title: "Transaction declined",
          description: "Sign the transaction to complete the swap",
        });
        // Fetch a new quote after rejection
        setRefetchQuote(true);
      } else {
        toastError(error as Error, {
          title: "Swap Failed",
          description: "Failed to execute swap. Please try again.",
        });
      }
    }
  }, [
    executeSwap,
    getExecuteParams,
    inputToken.chain,
    outputToken.chain,
    setActiveSwapId,
    setIsSwapInProgress,
    setRefetchQuote,
    setUserTokensForChain,
    primaryEvmAddress,
    router,
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
      if (!primaryEvmAddress) {
        toastInfo({
          title: "Connect Ethereum Wallet",
          description: "Please connect an Ethereum wallet to swap",
        });
        setShowAuthFlow(true);
        return;
      }
      const destinationBtcAddress = pastedBTCAddress || btcAddress;
      if (!destinationBtcAddress) {
        toastInfo({
          title: "Paste or Connect Bitcoin Wallet",
          description: "Please connect a Bitcoin wallet or paste a Bitcoin address to receive BTC",
        });
        return;
      }
      if (!validatePayoutAddress(destinationBtcAddress, true).isValid) {
        toastInfo({
          title: "Invalid Bitcoin Address",
          description: "Please enter a valid Bitcoin address",
        });
        return;
      }
    } else {
      // Non-BTC output: check wallet connections based on input asset
      if (inputToken.chain === "bitcoin") {
        // BTC->EVM: Need BTC wallet to send
        if (!btcAddress) {
          toastInfo({
            title: "Connect Bitcoin Wallet",
            description: "Please connect a Bitcoin wallet to send BTC",
          });
          setShowAuthFlow(true);
          return;
        }
      }
      if (!primaryEvmAddress) {
        toastInfo({
          title: "Connect Ethereum Wallet",
          description: "Please connect an Ethereum wallet to receive",
        });
        setShowAuthFlow(true);
        return;
      }
      const destinationEvmAddress = outputEvmAddress || primaryEvmAddress;
      if (!destinationEvmAddress) {
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
    displayedInputAmount,
    outputAmount,
    isSwappingForBTC,
    primaryEvmAddress,
    btcAddress,
    pastedBTCAddress,
    inputToken.chain,
    outputEvmAddress,
    setShowAuthFlow,
  ]);

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

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
    if (
      exceedsAvailableBTCLiquidity ||
      exceedsAvailableCBBTCLiquidity ||
      exceedsAvailableLiquidity
    ) {
      return {
        text: "Not enough liquidity",
        handler: undefined,
        showSpinner: false,
      };
    }

    if (exceedsUserBalance) {
      return {
        text: `Not enough ${inputToken.ticker}`,
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

    // SDK-based swap phases (signing in wallet → confirming on-chain)
    if (swapPhase === "approving") {
      return {
        text: "approving...",
        handler: undefined,
        showSpinner: true,
      };
    }
    if (swapPhase === "signing") {
      return {
        text: "signing transaction...",
        handler: undefined,
        showSpinner: true,
      };
    }
    if (swapPhase === "confirming") {
      return {
        text: "confirming deposit...",
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
    exceedsAvailableLiquidity ||
    inputBelowMinimum;

  const isButtonDisabled =
    isButtonLoading || isOtcServerDead || isRetryingOtcServer || hasValidationError;

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
