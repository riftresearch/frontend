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
import { Currencies, createCurrency } from "@riftresearch/sdk";
import type { ExecuteSwapStepType } from "@riftresearch/sdk";
import { parseUnits } from "viem";
import { getExpirySeconds } from "./LimitOrderPanel";
import { TokenData } from "@/utils/types";

export const LimitOrderButton = () => {
  const { isMobile } = useWindowSize();
  const router = useRouter();
  const { setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();
  const { sendBitcoin, isLoading: isBtcTxLoading } = useBitcoinTransaction();

  const [buttonPressed, setButtonPressed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "approving" | "signing">("idle");
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);

  const {
    inputToken,
    outputToken,
    displayedInputAmount,
    outputAmount,
    limitPrice,
    limitExpiry,
    isOtcServerDead,
    isRetryingOtcServer,
    rift,
    evmWalletClients,
    setEvmWalletClientForAddress,
    btcAddress,
    pastedBTCAddress,
    primaryEvmAddress,
    outputEvmAddress,
    setActiveSwapId,
    setIsSwapInProgress,
    isLoadingMarketRate,
  } = useStore();

  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const basePublicClient = usePublicClient({ chainId: base.id });

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

  const hasTosAgreement = useCallback(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rift_tos_agreed") === "true";
  }, []);

  const saveTosAgreement = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rift_tos_agreed", "true");
    }
  }, []);

  const toSdkCurrency = useCallback((token: TokenData) => {
    if (token.chain === "bitcoin") return Currencies.Bitcoin.BTC;
    if (token.ticker === "ETH" && token.chain === 1) return Currencies.Ethereum.ETH;
    if (token.ticker === "ETH" && token.chain === 8453) return Currencies.Base.ETH;
    return createCurrency({
      chainId: token.chain as number,
      address: token.address as `0x${string}`,
      decimals: token.decimals,
    });
  }, []);

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

  const allFieldsFilled =
    displayedInputAmount &&
    outputAmount &&
    limitPrice &&
    parseFloat(displayedInputAmount) > 0 &&
    parseFloat(outputAmount) > 0 &&
    parseFloat(limitPrice) > 0;

  const getExecuteParams = useCallback(async () => {
    const publicClient = inputToken.chain === 8453 ? basePublicClient : mainnetPublicClient;
    let walletClient = activeEvmWalletClient;
    const shouldRefreshWalletClient =
      !walletClient ||
      !walletClient.chain ||
      (evmClientChainId !== null && walletClient.chain.id !== evmClientChainId);

    if (shouldRefreshWalletClient && primaryEvmAddress && evmClientChainId) {
      const primaryEvmWallet = userWallets.find(
        (w) =>
          w.chain?.toUpperCase() === "EVM" &&
          w.address.toLowerCase() === primaryEvmAddress.toLowerCase()
      );
      if (primaryEvmWallet) {
        try {
          walletClient = await getDynamicWalletClient(primaryEvmWallet, primaryEvmAddress, evmClientChainId);
          setEvmWalletClientForAddress(primaryEvmAddress, evmClientChainId, walletClient);
        } catch (error) {
          console.error("[LimitOrderButton] Failed to fetch EVM wallet client:", error);
        }
      }
    }

    if (!walletClient) throw new Error("EVM wallet client not available");
    if (!walletClient.chain || (evmClientChainId !== null && walletClient.chain.id !== evmClientChainId)) {
      throw new Error("EVM wallet client is missing chain config. Please reconnect your EVM wallet.");
    }

    const destinationAddress = isSwappingForBTC
      ? pastedBTCAddress || btcAddress
      : outputEvmAddress || primaryEvmAddress;
    if (!destinationAddress) {
      throw new Error(
        isSwappingForBTC
          ? "No Bitcoin address available."
          : "No EVM address available."
      );
    }

    const refundAddress = inputToken.chain === "bitcoin" ? btcAddress : primaryEvmAddress;
    if (!refundAddress) {
      throw new Error("No refund address available.");
    }

    return {
      destinationAddress,
      refundAddress,
      publicClient,
      walletClient,
      onExecuteStep: async (type: ExecuteSwapStepType) => {
        if (type === "approval") setPhase("approving");
        else setPhase("signing");
      },
      sendBitcoin: async ({ recipient, amountSats }: { recipient: string; amountSats: string }): Promise<void> => {
        if (!btcAddress) throw new Error("No BTC wallet connected");
        await sendBitcoin(btcAddress, recipient, parseInt(amountSats, 10));
      },
    };
  }, [
    inputToken.chain, basePublicClient, mainnetPublicClient, activeEvmWalletClient,
    evmClientChainId, primaryEvmAddress, outputEvmAddress, isSwappingForBTC,
    pastedBTCAddress, setEvmWalletClientForAddress, userWallets, btcAddress, sendBitcoin,
  ]);

  const startLimitOrder = useCallback(async () => {
    try {
      setButtonPressed(true);
      setPhase("signing");
      setIsSwapInProgress(true);

      if (!rift) throw new Error("SDK not initialized");

      const executeParams = await getExecuteParams();

      // Build pricing: sellAmount in smallest unit of input token, buyAmount in smallest unit of output token
      const sellAmount = parseUnits(displayedInputAmount, inputToken.decimals).toString();
      const buyAmount = parseUnits(outputAmount, outputToken.decimals).toString();
      const validUntil = Math.floor(Date.now() / 1000) + getExpirySeconds(limitExpiry);

      const fromCurrency = toSdkCurrency(inputToken);
      const toCurrency = toSdkCurrency(outputToken);

      console.log("[LimitOrderButton] Creating limit order:", {
        from: fromCurrency,
        to: toCurrency,
        pricing: { sellAmount, buyAmount },
        validUntil,
      });

      const result = await rift.createLimitOrder({
        from: fromCurrency,
        to: toCurrency,
        pricing: { sellAmount, buyAmount },
        ...executeParams,
        validUntil,
      });

      setActiveSwapId(result.swapId);
      console.log("[LimitOrderButton] Limit order created:", result);

      toastSuccess({
        title: "Limit order placed",
        description: `Order ID: ${result.swapId.slice(0, 8)}...`,
      });

      router.push(`/swap/${result.swapId}`);
    } catch (error) {
      console.error("[LimitOrderButton] Error:", error);
      setButtonPressed(false);
      setPhase("idle");
      setIsSwapInProgress(false);

      if (isUserRejectionError(error)) {
        toastError(null, {
          title: "Transaction declined",
          description: "Sign the transaction to place the limit order",
        });
      } else {
        toastError(error as Error, {
          title: "Limit Order Failed",
          description: "Failed to create limit order. Please try again.",
        });
      }
    }
  }, [
    rift, getExecuteParams, displayedInputAmount, outputAmount,
    inputToken, outputToken, limitExpiry, toSdkCurrency,
    setActiveSwapId, setIsSwapInProgress, router,
  ]);

  const handleButtonClick = useCallback(async () => {
    if (!allFieldsFilled) {
      toastInfo({
        title: "Enter Amount",
        description: "Please fill in the sell amount, buy amount, and limit price",
      });
      return;
    }

    // Wallet checks
    if (isSwappingForBTC) {
      if (!primaryEvmAddress) {
        toastInfo({ title: "Connect Ethereum Wallet", description: "Please connect an Ethereum wallet" });
        setShowAuthFlow(true);
        return;
      }
      const destBtc = pastedBTCAddress || btcAddress;
      if (!destBtc || !validatePayoutAddress(destBtc, true).isValid) {
        toastInfo({ title: "Bitcoin Address Required", description: "Paste or connect a Bitcoin address" });
        return;
      }
    } else {
      if (inputToken.chain === "bitcoin" && !btcAddress) {
        toastInfo({ title: "Connect Bitcoin Wallet", description: "Please connect a Bitcoin wallet" });
        setShowAuthFlow(true);
        return;
      }
      if (!primaryEvmAddress) {
        toastInfo({ title: "Connect Ethereum Wallet", description: "Please connect an Ethereum wallet" });
        setShowAuthFlow(true);
        return;
      }
    }

    await startLimitOrder();
  }, [
    allFieldsFilled, isSwappingForBTC, primaryEvmAddress, btcAddress,
    pastedBTCAddress, inputToken.chain, startLimitOrder, setShowAuthFlow,
  ]);

  // Enter to submit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && allFieldsFilled && !buttonPressed) {
        e.preventDefault();
        handleButtonClick();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [allFieldsFilled, buttonPressed, handleButtonClick]);

  // Button state
  const getButtonConfig = () => {
    if (isLoadingMarketRate) {
      return { text: "Loading market rate...", handler: undefined, showSpinner: true };
    }
    if (phase === "approving") {
      return { text: "approving...", handler: undefined, showSpinner: true };
    }
    if (phase === "signing") {
      return { text: "signing transaction...", handler: undefined, showSpinner: true };
    }
    if (buttonPressed) {
      return { text: "", handler: undefined, showSpinner: true };
    }
    return { text: "Place Limit Order", handler: handleButtonClick, showSpinner: false };
  };

  const buttonConfig = getButtonConfig();
  const isButtonDisabled = buttonPressed || isOtcServerDead || isRetryingOtcServer || isLoadingMarketRate;

  const handleClick = () => {
    if (isOtcServerDead || IS_FRONTEND_PAUSED) {
      toastInfo({ title: "Service Unavailable", description: "Rift is currently down for maintenance." });
      return;
    }
    if (!hasTosAgreement()) {
      setShowTosModal(true);
      return;
    }
    if (!isButtonDisabled && buttonConfig.handler) {
      buttonConfig.handler();
    }
  };

  const handleTosAgree = () => {
    if (tosChecked) {
      saveTosAgreement();
      setShowTosModal(false);
      if (!isButtonDisabled && buttonConfig.handler) {
        buttonConfig.handler();
      }
    }
  };

  return (
    <Flex direction="column" w="100%">
      <Flex
        bg={colors.swapBgColor}
        _hover={{ bg: !isButtonDisabled ? colors.swapHoverColor : undefined }}
        w="100%"
        mt="8px"
        transition="0.2s"
        h="58px"
        onClick={handleClick}
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

      {/* ToS Modal (same as SwapButton) */}
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
                    <path d="M11.5 4L5.5 10L2.5 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                <a href="https://rift.exchange/terms" target="_blank" rel="noopener noreferrer" style={{ color: colors.RiftOrange, textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>Terms of Service</a>{" "}
                and{" "}
                <a href="https://rift.exchange/pp" target="_blank" rel="noopener noreferrer" style={{ color: colors.RiftOrange, textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
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
