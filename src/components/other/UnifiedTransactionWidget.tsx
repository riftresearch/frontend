import React, { useState, useEffect, useRef } from "react";
import { Box, Text, Flex, Image } from "@chakra-ui/react";
import { QRCodeSVG } from "qrcode.react";
import { LuCopy } from "react-icons/lu";
import { FiExternalLink } from "react-icons/fi";
import { CountdownTimer } from "./CountdownTimer";
import useWindowSize from "@/hooks/useWindowSize";
import { useStore } from "@/utils/store";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { motion, AnimatePresence } from "framer-motion";
import { toastSuccess, toastError } from "@/utils/toast";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";
import router from "next/router";
import { filterRefunds } from "@/utils/refundHelpers";
import { mapDbRowToAdminSwap, ANALYTICS_API_URL } from "@/utils/analyticsClient";
import { AdminSwapItem } from "@/utils/types";
import { RefundModal } from "./RefundModal";
import { useRefundModal } from "@/hooks/useRefundModal";
import { esploraClient } from "@/utils/esploraClient";
import { useEvmConfirmations } from "@/hooks/useEvmConfirmations";
import WebAssetTag from "./WebAssetTag";
import { AssetIcon } from "./AssetIcon";
import { StepCarousel } from "./StepCarousel";
import { SwapDetailsPill } from "./SwapDetailsPill";

// Type guard to check if swap is Bitcoin deposit
type SwapType = "bitcoin-deposit" | "evm-deposit";

interface UnifiedTransactionWidgetProps {
  swapId?: string;
  // Bitcoin-specific props (optional, only for BTC->EVM swaps)
  bitcoinAddress?: string;
  bitcoinAmount?: number;
  bitcoinUri?: string;
  bitcoinDepositTx?: string;
  bitcoinDepositAddress?: string;
}

export function UnifiedTransactionWidget({
  swapId,
  bitcoinAddress,
  bitcoinAmount,
  bitcoinUri,
  bitcoinDepositTx,
  bitcoinDepositAddress,
}: UnifiedTransactionWidgetProps) {
  const { isMobile } = useWindowSize();
  const {
    setTransactionConfirmed,
    setSwapResponse,
    setFeeOverview,
    depositFlowState,
    countdownValue,
    swapResponse,
    btcPrice,
  } = useStore();

  // Sound effect for swap completion
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousDepositFlowStateRef = useRef<string | null>(null);

  // Use provided swapId prop, fallback to store value
  const currentSwapId = swapId || swapResponse?.id;
  const { data: swapStatusInfo } = useSwapStatus(currentSwapId);

  // Handle navigation to new swap with state reset
  const handleNewSwap = () => {
    setTransactionConfirmed(false);
    setSwapResponse(null);
    setFeeOverview(null);
    router.push("/");
  };

  // Determine swap type based on props and swap data
  const swapType: SwapType = React.useMemo(() => {
    if (bitcoinAddress || swapStatusInfo?.quote?.from.currency.chain === "bitcoin") {
      return "bitcoin-deposit";
    }
    return "evm-deposit";
  }, [bitcoinAddress, swapStatusInfo?.quote?.from.currency.chain]);

  const isSettled =
    depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled";
  const showLoadingDots = countdownValue === 0 && !isSettled;

  // Determine current step index for widget logic
  const stepIds = [
    "1-WaitingUserDepositInitiated",
    "2-WaitingUserDepositConfirmed",
    "3-WaitingMMDepositInitiated",
    "4-WaitingMMDepositConfirmed",
  ];
  const isSettledStatus = depositFlowState === "5-Settled";
  const currentStepIndex = isSettledStatus ? 3 : stepIds.findIndex((id) => id === depositFlowState);
  const validStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  const [isRefundAvailable, setIsRefundAvailable] = React.useState(false);
  const [failedSwapData, setFailedSwapData] = React.useState<AdminSwapItem | null>(null);
  const [isSwapRefunded, setIsSwapRefunded] = React.useState(false);
  const [isPartialDeposit, setIsPartialDeposit] = React.useState(false);
  const [showFillingOrderWarning, setShowFillingOrderWarning] = React.useState(false);
  const [cowSwapFailed, setCowSwapFailed] = React.useState(false);

  // Track EVM confirmations for user deposit (for EVM deposits)
  const userDepositTxHash = swapStatusInfo?.user_deposit_status?.tx_hash;
  const userDepositChain = swapStatusInfo?.quote?.from.currency.chain;
  const userChainId =
    userDepositChain === "ethereum" ? 1 : userDepositChain === "base" ? 8453 : undefined;
  const evmConfirmations = useEvmConfirmations(
    swapType === "evm-deposit" ? userDepositTxHash : undefined,
    userChainId,
    depositFlowState === "2-WaitingUserDepositConfirmed"
  );

  // Track BTC confirmations
  const [btcConfirmations, setBtcConfirmations] = React.useState<number>(0);
  const [qrCodeMode, setQrCodeMode] = React.useState<"with-amount" | "address-only">("with-amount");

  // Set audio volume on mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.45; // Set volume to 45%
    }
  }, []);

  // Play sound effect when swap completes
  useEffect(() => {
    console.log("Deposit Flow State Change:", {
      previous: previousDepositFlowStateRef.current,
      current: depositFlowState,
      audioRefExists: !!audioRef.current,
    });

    // Transition from "FILLING ORDER" to "SWAP COMPLETE"
    if (
      previousDepositFlowStateRef.current === "3-WaitingMMDepositInitiated" &&
      (depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled") &&
      audioRef.current
    ) {
      console.log("🔊 Playing swap completion sound!");
      audioRef.current.play().catch((error) => {
        console.log("Failed to play swap completion sound:", error);
      });
    }

    // Update the previous state for next comparison
    previousDepositFlowStateRef.current = depositFlowState;
  }, [depositFlowState]);

  // Check if swap expired (for Bitcoin deposits only)
  const isExpired = React.useMemo(() => {
    if (swapType !== "bitcoin-deposit" || validStepIndex !== 0 || !swapStatusInfo?.created_at)
      return false;

    const createdAt = new Date(swapStatusInfo.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceCreation > 12;
  }, [swapType, validStepIndex, swapStatusInfo?.created_at]);

  // Check if stuck on "FILLING ORDER"
  useEffect(() => {
    if (depositFlowState !== "3-WaitingMMDepositInitiated") {
      setShowFillingOrderWarning(false);
      return;
    }

    const swapCreatedAt = swapStatusInfo?.created_at;
    if (!swapCreatedAt) return;

    const checkTimer = () => {
      const createdTime = new Date(swapCreatedAt);
      const now = new Date();
      const minutesSinceCreated = (now.getTime() - createdTime.getTime()) / (1000 * 60);

      if (minutesSinceCreated >= 30) {
        setShowFillingOrderWarning(true);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 30000);

    return () => clearInterval(interval);
  }, [depositFlowState, swapStatusInfo?.created_at]);

  // Check for CowSwap quote expiry (EVM deposits only, step 1)
  useEffect(() => {
    // Only check for EVM deposits in step 1
    if (swapType !== "evm-deposit" || depositFlowState !== "1-WaitingUserDepositInitiated") {
      setCowSwapFailed(false);
      return;
    }

    const swapCreatedAt = swapStatusInfo?.created_at;
    if (!swapCreatedAt || !currentSwapId) return;

    // Set cookie with swap creation time
    const cookieKey = `cowswap_${currentSwapId}`;
    document.cookie = `${cookieKey}=${encodeURIComponent(swapCreatedAt)}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

    const checkExpiry = () => {
      // Read created time from specific cookie
      const match = document.cookie.match(new RegExp(`(?:^|; )${cookieKey}=([^;]*)`));
      const cookieValue = match?.[1];

      // If cookie doesn't exist, just return
      if (!cookieValue) return;

      // Parse the URL-encoded date value (e.g., 2025-12-10T21%3A55%3A35.533Z)
      const decodedDate = decodeURIComponent(cookieValue);
      const createdTime = new Date(decodedDate);
      const now = new Date();
      const minutesSinceCreated = (now.getTime() - createdTime.getTime()) / (1000 * 60);

      if (minutesSinceCreated >= 60) {
        setCowSwapFailed(true);
      }
    };

    checkExpiry(); // Check immediately
    const interval = setInterval(checkExpiry, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [swapType, depositFlowState, swapStatusInfo?.created_at, currentSwapId]);

  // Poll for Bitcoin confirmations
  useEffect(() => {
    // For Bitcoin deposits: track user deposit confirmations during step 2
    // For EVM deposits: track MM deposit confirmations during step 4 (if MM deposits BTC)
    const shouldTrackBtc =
      (swapType === "bitcoin-deposit" && depositFlowState === "2-WaitingUserDepositConfirmed") ||
      (swapType === "evm-deposit" &&
        (depositFlowState === "4-WaitingMMDepositConfirmed" || depositFlowState === "5-Settled") &&
        swapStatusInfo?.quote?.to.currency.chain === "bitcoin");

    if (!shouldTrackBtc) {
      setBtcConfirmations(0);
      return;
    }

    const txHash =
      swapType === "bitcoin-deposit"
        ? userDepositTxHash || bitcoinDepositTx
        : swapStatusInfo?.mm_deposit_status?.tx_hash;

    if (!txHash) {
      setBtcConfirmations(0);
      return;
    }

    let isCancelled = false;

    async function fetchConfirmations() {
      try {
        const confirmations = await esploraClient.getConfirmations(txHash as string);
        if (!isCancelled) {
          setBtcConfirmations(confirmations);
          console.log(`[BTC CONFIRMATIONS] ${txHash}: ${confirmations} confirmations`);
        }
      } catch (error) {
        console.error("Error fetching BTC confirmations:", error);
      }
    }

    fetchConfirmations();
    const interval = setInterval(fetchConfirmations, 30000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [
    swapType,
    depositFlowState,
    userDepositTxHash,
    bitcoinDepositTx,
    swapStatusInfo?.mm_deposit_status?.tx_hash,
    swapStatusInfo?.quote?.to.currency.chain,
  ]);

  // Use refund modal hook
  const {
    refundModalOpen,
    selectedFailedSwap,
    refundAddress,
    setRefundAddress,
    isClaimingRefund,
    refundStatus,
    currentBitcoinFee,
    fetchingFee,
    openRefundModal,
    closeRefundModal,
    claimRefund,
  } = useRefundModal({ redirectOnSuccess: true });

  // Check refund eligibility whenever swap data updates
  React.useEffect(() => {
    async function checkRefundEligibility() {
      if (!swapStatusInfo) {
        setIsRefundAvailable(false);
        setIsSwapRefunded(false);
        setFailedSwapData(null);
        return;
      }

      try {
        // Map to admin swap format and check refund status
        const mappedSwap = mapDbRowToAdminSwap(swapStatusInfo, btcPrice);
        const {
          isRefundAvailable: refundAvailable,
          shouldMarkAsRefunded,
          isPartialDeposit: partialDeposit,
        } = await filterRefunds(swapStatusInfo, mappedSwap);

        // Update refund availability
        setIsRefundAvailable(refundAvailable);
        setIsSwapRefunded(shouldMarkAsRefunded);
        setIsPartialDeposit(partialDeposit || false);
        setFailedSwapData(refundAvailable ? mappedSwap : null);

        if (refundAvailable) {
          console.log(`[REFUND CHECK] Refund available for swap ${currentSwapId}`, {
            partialDeposit,
          });
        }
        if (shouldMarkAsRefunded) {
          console.log(`[REFUND CHECK] Swap ${currentSwapId} has been refunded (balance = 0)`);
        }
      } catch (error) {
        console.error(`Error checking refund eligibility for ${currentSwapId}:`, error);
        setIsRefundAvailable(false);
        setIsSwapRefunded(false);
        setIsPartialDeposit(false);
        setFailedSwapData(null);
      }
    }

    checkRefundEligibility();
  }, [swapStatusInfo, currentSwapId]);

  // Format amounts
  const formatAmount = (amount: string | number | undefined, decimals: number): string => {
    if (!amount) return "0";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    const decimalPlaces = decimals === 8 ? 8 : Math.min(decimals, 6);
    return numAmount.toFixed(decimalPlaces).replace(/\.?0+$/, "");
  };

  // Get swap amounts
  // Note: inputAmountFromMetadata is calculated after getInputAssetFromMetadata() below
  // This variable will be reassigned after metadata parsing
  let inputAmount = formatAmount(
    swapStatusInfo?.quote?.from.amount
      ? parseInt(swapStatusInfo.quote.from.amount) /
          Math.pow(10, swapStatusInfo.quote.from.currency.decimals)
      : swapType === "bitcoin-deposit"
        ? bitcoinAmount
        : undefined,
    swapStatusInfo?.quote?.from.currency.decimals || (swapType === "bitcoin-deposit" ? 8 : 18)
  );

  const getAssetSymbol = (tokenAddress: string | undefined, defaultSymbol: string): string => {
    if (!tokenAddress) return defaultSymbol;
    if (tokenAddress === "0x0000000000000000000000000000000000000000") return "ETH";

    const tokenMap: Record<string, string> = {
      "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf": "cbBTC",
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "WBTC",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
    };

    return tokenMap[tokenAddress] || "ERC20";
  };

  // Parse start_asset from metadata
  // New format (JSON): {"ticker":"USDC","address":"0x...","icon":"https://...","amount":"123.45","decimals":6}
  // Legacy format (colon-separated): "TICKER:ADDRESS:ICON_URL"
  const getInputAssetFromMetadata = (): {
    ticker: string;
    iconUrl?: string;
    amount?: string;
    decimals?: number;
  } => {
    const startAsset = swapStatusInfo?.metadata?.start_asset;
    if (!startAsset || typeof startAsset !== "string") {
      return { ticker: "" };
    }

    // Try parsing as JSON first (new format)
    try {
      const parsed = JSON.parse(startAsset);
      // console.log("parsed input asset", parsed);
      if (parsed && typeof parsed === "object") {
        return {
          ticker: parsed.ticker || "",
          iconUrl: parsed.icon,
          amount: parsed.amount,
          decimals: parsed.decimals,
        };
      }
    } catch (e) {
      // Not JSON, try legacy format
      const parts = startAsset.split(":");
      if (parts.length >= 1 && parts[0]) {
        return {
          ticker: parts[0], // Return the ticker (e.g., "USDC", "WETH", etc.)
          iconUrl: parts.length >= 3 ? parts[2] : undefined, // Return icon URL if available
        };
      }
    }

    return { ticker: "" };
  };

  const inputAssetMetadata = getInputAssetFromMetadata();

  // Helper to extract token address from the currency token structure
  const getTokenAddress = (
    token: { type: "Native" } | { type: "Address"; data: string } | undefined
  ): string | undefined => {
    if (token?.type === "Address") {
      return token.data;
    }
    return undefined;
  };

  // For EVM deposits, prioritize metadata, then fallback to token address lookup
  // Don't use "ETH" as default to avoid showing wrong icon while loading
  const fromTokenAddress = getTokenAddress(swapStatusInfo?.quote?.from.currency.token);
  const inputAsset =
    swapType === "bitcoin-deposit"
      ? "BTC"
      : inputAssetMetadata.ticker || (fromTokenAddress ? getAssetSymbol(fromTokenAddress, "") : "");

  // For icon URL, use metadata if available, otherwise don't provide one
  // This prevents showing wrong icon while data loads
  const inputAssetIconUrl = swapType === "bitcoin-deposit" ? undefined : inputAssetMetadata.iconUrl;

  // For input amount, prioritize metadata amount (human-readable) over quote amount (raw)
  // If metadata has amount, use it directly; otherwise keep the calculated amount from quote
  if (swapType === "evm-deposit" && inputAssetMetadata.amount) {
    inputAmount = formatAmount(inputAssetMetadata.amount, inputAssetMetadata.decimals || 18);
  }

  const outputAmount = formatAmount(
    swapStatusInfo?.quote?.to.amount
      ? parseInt(swapStatusInfo.quote.to.amount) /
          Math.pow(10, swapStatusInfo.quote.to.currency.decimals)
      : undefined,
    swapStatusInfo?.quote?.to.currency.decimals || (swapType === "bitcoin-deposit" ? 18 : 8)
  );

  const toTokenAddress = getTokenAddress(swapStatusInfo?.quote?.to.currency.token);
  const outputAsset =
    swapType === "bitcoin-deposit" ? getAssetSymbol(toTokenAddress, "cbBTC") : "BTC";

  const handleViewUserTransaction = () => {
    const txnId = swapStatusInfo?.user_deposit_status?.tx_hash;
    const chain = swapStatusInfo?.quote?.from.currency.chain;

    if (txnId) {
      if (chain === "bitcoin") {
        window.open(`https://mempool.space/tx/${txnId}`, "_blank");
      } else if (chain === "ethereum") {
        const txHash = txnId.startsWith("0x") ? txnId : `0x${txnId}`;
        window.open(`https://etherscan.io/tx/${txHash}`, "_blank");
      } else if (chain === "base") {
        const txHash = txnId.startsWith("0x") ? txnId : `0x${txnId}`;
        window.open(`https://basescan.org/tx/${txHash}`, "_blank");
      } else {
        const txHash = txnId.startsWith("0x") ? txnId : `0x${txnId}`;
        window.open(`https://etherscan.io/tx/${txHash}`, "_blank");
      }
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess({
        title: "Copied to Clipboard",
        description: `${label} copied successfully`,
      });
    } catch (err) {
      console.error(`Failed to copy ${label}:`, err);
      toastError(err, {
        title: "Copy Failed",
        description: `Unable to copy ${label}`,
      });
    }
  };

  // COWSWAP QUOTE EXPIRED VIEW
  if (cowSwapFailed) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        {isMobile && (
          <Box mb="-70px" pt="12%" w="100%" display="flex" justifyContent="center" zIndex={2}>
            <SwapDetailsPill
              width="100%"
              inputAmount={inputAmount}
              inputAsset={inputAsset}
              inputAssetIconUrl={inputAssetIconUrl}
              outputAmount={outputAmount}
              outputAsset={outputAsset}
              isMobile={isMobile}
            />
          </Box>
        )}

        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          <Box
            w="100%"
            h="50%"
            borderRadius="40px"
            position="absolute"
            top="0px"
            background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
            display="flex"
            backdropFilter="blur(20px)"
            alignItems="center"
            justifyContent="center"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "40px",
              padding: "3px",
              background:
                "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
            }}
          >
            {!isMobile && (
              <Box position="absolute" top="15px" zIndex={2}>
                <SwapDetailsPill
                  inputAmount={inputAmount}
                  inputAsset={inputAsset}
                  inputAssetIconUrl={inputAssetIconUrl}
                  outputAmount={outputAmount}
                  outputAsset={outputAsset}
                  isMobile={isMobile}
                />
              </Box>
            )}

            <Box
              width="110px"
              height="110px"
              borderRadius="50%"
              bg="rgba(251, 191, 36, 0.2)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="3px solid rgba(251, 191, 36, 0.5)"
              zIndex={1}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </Box>
          </Box>

          <Box
            h="50%"
            bottom="0px"
            position="absolute"
            padding="20px"
            w="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="20px"
          >
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.offWhite}
              textAlign="center"
              px="40px"
              lineHeight="1.6"
            >
              Quote expired, please try swap again.
            </Text>

            <Box
              as="button"
              onClick={handleNewSwap}
              borderRadius="16px"
              width={isMobile ? "240px" : "180px"}
              border="2px solid #6651B3"
              background="rgba(86, 50, 168, 0.30)"
              padding="12px 16px"
              cursor="pointer"
              transition="all 0.2s"
              zIndex={1}
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
              }}
            >
              <Text
                color="white"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                fontWeight="normal"
                letterSpacing="0.5px"
              >
                NEW SWAP
              </Text>
            </Box>
          </Box>
        </Box>
      </Flex>
    );
  }

  // REFUNDED VIEW
  if (isSwapRefunded) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        {isMobile && (
          <Box mb="-70px" pt="12%" w="100%" display="flex" justifyContent="center" zIndex={2}>
            <SwapDetailsPill
              width="100%"
              inputAmount={inputAmount}
              inputAsset={inputAsset}
              inputAssetIconUrl={inputAssetIconUrl}
              outputAmount={outputAmount}
              outputAsset={outputAsset}
              isMobile={isMobile}
            />
          </Box>
        )}

        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          <Box
            w="100%"
            h="50%"
            borderRadius="40px"
            position="absolute"
            top="0px"
            background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
            display="flex"
            backdropFilter="blur(20px)"
            alignItems="center"
            justifyContent="center"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "40px",
              padding: "3px",
              background:
                "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
            }}
          >
            {!isMobile && (
              <Box position="absolute" top="15px" zIndex={2}>
                <SwapDetailsPill
                  inputAmount={inputAmount}
                  inputAsset={inputAsset}
                  inputAssetIconUrl={inputAssetIconUrl}
                  outputAmount={outputAmount}
                  outputAsset={outputAsset}
                  isMobile={isMobile}
                />
              </Box>
            )}

            <Box
              width="110px"
              height="110px"
              borderRadius="50%"
              bg="rgba(251, 191, 36, 0.2)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="3px solid rgba(251, 191, 36, 0.5)"
              zIndex={1}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </Box>
          </Box>

          <Box
            h="50%"
            bottom="0px"
            position="absolute"
            padding="20px"
            w="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="20px"
          >
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.offWhite}
              textAlign="center"
              px="40px"
              lineHeight="1.6"
            >
              This swap has been refunded. You can view details in the swap history page.
            </Text>

            <Flex
              gap="16px"
              justifyContent="center"
              flexWrap="wrap"
              direction={isMobile ? "column" : "row"}
              alignItems="center"
            >
              <Box
                as="button"
                onClick={() => router.push("/history")}
                border="2px solid rgba(255, 255, 255, 0.3)"
                borderRadius="16px"
                width={isMobile ? "240px" : "180px"}
                background="rgba(255, 255, 255, 0.1)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="13px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  SWAP HISTORY
                </Text>
              </Box>

              <Box
                as="button"
                onClick={handleNewSwap}
                borderRadius="16px"
                width={isMobile ? "240px" : "180px"}
                border="2px solid #6651B3"
                background="rgba(86, 50, 168, 0.30)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  NEW SWAP
                </Text>
              </Box>
            </Flex>
          </Box>
        </Box>
      </Flex>
    );
  }

  // REFUND AVAILABLE VIEW
  if (isRefundAvailable) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        {isMobile && (
          <Box mb="-70px" pt="12%" w="100%" display="flex" justifyContent="center" zIndex={2}>
            <SwapDetailsPill
              width="100%"
              inputAmount={inputAmount}
              inputAsset={inputAsset}
              inputAssetIconUrl={inputAssetIconUrl}
              outputAmount={outputAmount}
              outputAsset={outputAsset}
              isMobile={isMobile}
            />
          </Box>
        )}

        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          <Box
            w="100%"
            h="50%"
            borderRadius="40px"
            position="absolute"
            top="0px"
            background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
            display="flex"
            backdropFilter="blur(20px)"
            alignItems="center"
            justifyContent="center"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "40px",
              padding: "3px",
              background:
                "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
            }}
          >
            {!isMobile && (
              <Box position="absolute" top="15px" zIndex={2}>
                <SwapDetailsPill
                  inputAmount={inputAmount}
                  inputAsset={inputAsset}
                  inputAssetIconUrl={inputAssetIconUrl}
                  outputAmount={outputAmount}
                  outputAsset={outputAsset}
                  isMobile={isMobile}
                />
              </Box>
            )}

            <Box
              width="110px"
              height="110px"
              borderRadius="50%"
              bg="rgba(231, 76, 60, 0.2)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="3px solid rgba(231, 76, 60, 0.5)"
              zIndex={1}
            >
              <Text fontSize="60px" color="#E74C3C">
                !
              </Text>
            </Box>
          </Box>

          <Box
            h="50%"
            bottom="0px"
            position="absolute"
            padding="20px"
            w="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="20px"
          >
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.offWhite}
              textAlign="center"
              px="40px"
              mb={isMobile ? "0px" : "15px"}
              lineHeight="1.6"
            >
              {isPartialDeposit
                ? `You sent too little ${inputAsset} to complete the swap. You can initiate a refund in the swap history page or with the button below.`
                : "The market maker failed to fill your order. You can initiate a refund in the swap history page or with the button below."}
            </Text>

            <Flex
              gap="16px"
              justifyContent="center"
              flexWrap="wrap"
              direction={isMobile ? "column" : "row"}
              alignItems="center"
            >
              {swapStatusInfo?.user_deposit_status?.tx_hash && (
                <Box
                  as="button"
                  onClick={handleViewUserTransaction}
                  border="2px solid rgba(255, 255, 255, 0.3)"
                  borderRadius="16px"
                  width={isMobile ? "240px" : "210px"}
                  background="rgba(255, 255, 255, 0.1)"
                  padding="12px 16px"
                  cursor="pointer"
                  transition="all 0.2s"
                  zIndex={1}
                  _hover={{
                    transform: "translateY(-2px)",
                    bg: "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <Text
                    color="white"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    fontSize="13px"
                    fontWeight="normal"
                    letterSpacing="0.5px"
                  >
                    VIEW DEPOSIT TXN
                  </Text>
                </Box>
              )}

              <Box
                as="button"
                onClick={() => failedSwapData && openRefundModal(failedSwapData)}
                borderRadius="16px"
                width={isMobile ? "240px" : "210px"}
                border="2px solid #6651B3"
                background="rgba(86, 50, 168, 0.30)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  INITIATE REFUND
                </Text>
              </Box>
            </Flex>
          </Box>

          <RefundModal
            isOpen={refundModalOpen}
            selectedSwap={selectedFailedSwap}
            refundAddress={refundAddress}
            setRefundAddress={setRefundAddress}
            isClaimingRefund={isClaimingRefund}
            refundStatus={refundStatus}
            currentBitcoinFee={currentBitcoinFee}
            fetchingFee={fetchingFee}
            onClose={closeRefundModal}
            onClaimRefund={claimRefund}
          />
        </Box>
      </Flex>
    );
  }

  // EXPIRED VIEW (Bitcoin deposits only)
  if (isExpired && swapType === "bitcoin-deposit" && bitcoinAddress) {
    return (
      <Flex direction="column" alignItems="center" gap="20px" w="100%">
        {isMobile && (
          <Box mb="-70px" pt="12%" w="100%" display="flex" justifyContent="center" zIndex={2}>
            <SwapDetailsPill
              width="100%"
              inputAmount={inputAmount}
              inputAsset={inputAsset}
              inputAssetIconUrl={inputAssetIconUrl}
              outputAmount={outputAmount}
              outputAsset={outputAsset}
              isMobile={isMobile}
            />
          </Box>
        )}

        <Box
          w={isMobile ? "100%" : "805px"}
          h={isMobile ? "600px" : "510px"}
          borderRadius="40px"
          mt="70px"
          boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
          backdropFilter="blur(9px)"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap="24px"
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          {!isMobile && (
            <Box position="absolute" top="15px" zIndex={2}>
              <SwapDetailsPill
                inputAmount={inputAmount}
                inputAsset={inputAsset}
                inputAssetIconUrl={inputAssetIconUrl}
                outputAmount={outputAmount}
                outputAsset={outputAsset}
                isMobile={isMobile}
              />
            </Box>
          )}

          <Flex direction="column" alignItems="center" gap="16px" zIndex={1}>
            <Text
              fontSize="24px"
              fontFamily={FONT_FAMILIES.NOSTROMO}
              color={colors.offWhite}
              letterSpacing="1px"
            >
              SWAP EXPIRED
            </Text>
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.offWhite}
              textAlign="center"
              px="40px"
              mb={isMobile ? "0px" : "15px"}
              lineHeight="1.6"
            >
              Your time to initiate a swap has expired. You can start a new swap with the button
              below.
            </Text>

            {currentSwapId && (
              <Flex
                alignItems="center"
                gap="8px"
                bg="rgba(251, 191, 36, 0.15)"
                borderRadius="12px"
                padding="10px 16px"
                border="1px solid rgba(251, 191, 36, 0.4)"
                cursor="pointer"
                onClick={() => copyToClipboard(currentSwapId, "Swap ID")}
                _hover={{ bg: "rgba(251, 191, 36, 0.2)" }}
                transition="all 0.2s"
              >
                <Text
                  color="rgba(251, 191, 36, 0.9)"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontSize="13px"
                  fontWeight="normal"
                >
                  SWAP ID - {currentSwapId.slice(0, 8)}...{currentSwapId.slice(-8)}
                </Text>
                <LuCopy color="rgba(251, 191, 36, 0.9)" size={14} />
              </Flex>
            )}
          </Flex>

          <Flex gap="16px" justifyContent="center" flexWrap="wrap">
            {bitcoinDepositTx && (
              <Box
                as="button"
                onClick={() =>
                  window.open(`https://mempool.space/tx/${bitcoinDepositTx}`, "_blank")
                }
                border="2px solid rgba(255, 255, 255, 0.3)"
                borderRadius="16px"
                width={isMobile ? "160px" : "180px"}
                background="rgba(255, 255, 255, 0.1)"
                padding="12px 16px"
                cursor="pointer"
                transition="all 0.2s"
                zIndex={1}
                _hover={{
                  transform: "translateY(-2px)",
                  bg: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Text
                  color="white"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  fontSize="13px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  VIEW DEPOSIT TXN
                </Text>
              </Box>
            )}

            <Box
              as="button"
              onClick={handleNewSwap}
              borderRadius="16px"
              width={isMobile ? "140px" : "160px"}
              border="2px solid #6651B3"
              background="rgba(86, 50, 168, 0.30)"
              padding="12px 16px"
              cursor="pointer"
              transition="all 0.2s"
              zIndex={1}
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(102, 81, 179, 0.3)",
              }}
            >
              <Text
                color="white"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                fontSize="14px"
                fontWeight="normal"
                letterSpacing="0.5px"
              >
                NEW SWAP
              </Text>
            </Box>
          </Flex>
        </Box>
      </Flex>
    );
  }

  // NORMAL SWAP VIEW
  return (
    <Flex direction="column" alignItems="center" w="100%">
      {/* Swap Details Pill - mobile: above widget, desktop: inside widget */}
      {!(swapType === "bitcoin-deposit" && validStepIndex === 0 && bitcoinAddress && bitcoinUri) &&
        isMobile && (
          <Box mb="-70px" pt="12%" w="100%" display="flex" justifyContent="center" zIndex={2}>
            <SwapDetailsPill
              width="100%"
              inputAmount={inputAmount}
              inputAsset={inputAsset}
              inputAssetIconUrl={inputAssetIconUrl}
              outputAmount={outputAmount}
              outputAsset={outputAsset}
              isMobile={isMobile}
            />
          </Box>
        )}

      <Box
        w={isMobile ? "100%" : "810px"}
        h={isMobile ? "590px" : "580px"}
        borderRadius="40px"
        mt="70px"
        boxShadow="0 7px 20px rgba(120, 78, 159, 0.7)"
        backdropFilter="blur(9px)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        _before={{
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "40px",
          padding: "3px",
          background: "linear-gradient(40deg, #443467 0%, #A187D7 50%, #09175A 79%, #443467 100%)",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "xor",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
        }}
      >
        <Box
          w="100%"
          h={isMobile ? "45%" : "53%"}
          borderRadius="40px"
          position="absolute"
          top="0px"
          background="linear-gradient(40deg, rgba(171, 125, 255, 0.34) 1.46%, rgba(0, 26, 144, 0.35) 98.72%)"
          display="flex"
          flexDirection="column"
          backdropFilter="blur(20px)"
          zIndex={10}
          alignItems="center"
          justifyContent="center"
          _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "40px",
            padding: "3px",
            background:
              "linear-gradient(-40deg,rgb(43, 36, 111) 0%,rgb(55, 50, 97) 10%, rgba(109, 89, 169, 0.5) 100%)",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        >
          {/* Swap Details Pill - hide when showing Bitcoin QR code, show only on desktop (mobile version is above widget) */}
          {!(
            swapType === "bitcoin-deposit" &&
            validStepIndex === 0 &&
            bitcoinAddress &&
            bitcoinUri
          ) &&
            !isMobile && (
              <Box position="absolute" top="15px" zIndex={2}>
                <SwapDetailsPill
                  inputAmount={inputAmount}
                  inputAsset={inputAsset}
                  inputAssetIconUrl={inputAssetIconUrl}
                  outputAmount={outputAmount}
                  outputAsset={outputAsset}
                  isMobile={isMobile}
                />
              </Box>
            )}

          {/* Corner decorations */}
          <img
            src="/images/txns/top_left.svg"
            alt=""
            style={{
              position: "absolute",
              top: "25px",
              left: "40px",
              width: "28px",
              height: "28px",
              opacity: 0.5,
            }}
          />
          <img
            src="/images/txns/top_right.svg"
            alt=""
            style={{
              position: "absolute",
              top: "25px",
              right: "40px",
              width: swapType === "bitcoin-deposit" ? "40px" : "60px",
              height: swapType === "bitcoin-deposit" ? "40px" : "60px",
              opacity: 0.5,
            }}
          />
          <img
            src="/images/txns/bottom_left.svg"
            alt=""
            style={{
              position: "absolute",
              bottom: "25px",
              left: "40px",
              width: swapType === "bitcoin-deposit" ? "40px" : "60px",
              height: swapType === "bitcoin-deposit" ? "40px" : "60px",
              opacity: 0.5,
            }}
          />
          <img
            src="/images/txns/bottom_right.svg"
            alt=""
            style={{
              position: "absolute",
              bottom: "25px",
              right: "40px",
              width: "28px",
              height: "28px",
              opacity: 0.5,
            }}
          />

          {/* Conditional Top Half Content */}
          {swapType === "bitcoin-deposit" &&
          validStepIndex === 0 &&
          bitcoinAddress &&
          bitcoinUri ? (
            // Bitcoin QR Code View
            <Flex
              direction={isMobile ? "column" : "row"}
              align="center"
              justify="center"
              gap={isMobile ? "20px" : "40px"}
              zIndex={1}
              px={isMobile ? "50px" : "100px"}
            >
              {!isMobile && (
                <Flex direction="column" align="center" gap="12px">
                  <Flex
                    py="10px"
                    px="12px"
                    borderRadius="12px"
                    bg="white"
                    boxShadow="0px 8px 20px rgba(0, 16, 118, 0.3)"
                    justify="center"
                    align="center"
                    flexShrink={0}
                  >
                    <QRCodeSVG
                      value={qrCodeMode === "with-amount" ? bitcoinUri : bitcoinAddress}
                      size={160}
                    />
                  </Flex>

                  {/* QR Code Mode Toggle */}
                  <Flex
                    bg="rgba(255, 255, 255, 0.05)"
                    borderRadius="11px"
                    padding="3px"
                    gap="3px"
                    border="1px solid rgba(255, 255, 255, 0.1)"
                  >
                    <Box
                      as="button"
                      onClick={() => setQrCodeMode("with-amount")}
                      px="10px"
                      py="4px"
                      borderRadius="8px"
                      bg={
                        qrCodeMode === "with-amount" ? "rgba(255, 255, 255, 0.15)" : "transparent"
                      }
                      color={
                        qrCodeMode === "with-amount" ? colors.offWhite : "rgba(255, 255, 255, 0.5)"
                      }
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      fontSize="9px"
                      letterSpacing="0.3px"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg:
                          qrCodeMode === "with-amount"
                            ? "rgba(255, 255, 255, 0.15)"
                            : "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      WITH AMOUNT
                    </Box>
                    <Box
                      as="button"
                      onClick={() => setQrCodeMode("address-only")}
                      px="11px"
                      py="4px"
                      borderRadius="8px"
                      bg={
                        qrCodeMode === "address-only" ? "rgba(255, 255, 255, 0.15)" : "transparent"
                      }
                      color={
                        qrCodeMode === "address-only" ? colors.offWhite : "rgba(255, 255, 255, 0.5)"
                      }
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      fontSize="9px"
                      letterSpacing="0.3px"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg:
                          qrCodeMode === "address-only"
                            ? "rgba(255, 255, 255, 0.15)"
                            : "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      ADDRESS
                    </Box>
                  </Flex>
                </Flex>
              )}

              <Flex
                direction="column"
                gap={isMobile ? "16px" : "24px"}
                flex="1"
                maxW={isMobile ? "92%" : "500px"}
              >
                <Flex direction="column" w="100%">
                  <Text
                    fontSize={isMobile ? "10px" : "11px"}
                    color="rgba(255,255,255,0.5)"
                    fontFamily={FONT_FAMILIES.NOSTROMO}
                    letterSpacing="1px"
                    mb="8px"
                  >
                    BITCOIN ADDRESS
                  </Text>
                  <Flex
                    alignItems="flex-end"
                    gap="12px"
                    position="relative"
                    role="group"
                    cursor="pointer"
                    onClick={() => copyToClipboard(bitcoinAddress, "Bitcoin Address")}
                  >
                    <Text
                      color={colors.offWhite}
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      fontSize={isMobile ? "18px" : "26px"}
                      letterSpacing={isMobile ? "-1.2px" : "-1.8px"}
                      fontWeight="500"
                      flex="1"
                      lineHeight="1.3"
                      wordBreak="break-all"
                    >
                      {bitcoinAddress}
                    </Text>
                    <Box
                      opacity={0.6}
                      _groupHover={{ opacity: 1 }}
                      transition="opacity 0.2s"
                      mb="6px"
                    >
                      <LuCopy color="rgba(255, 255, 255, 0.8)" size={20} />
                    </Box>
                  </Flex>
                </Flex>

                {bitcoinAmount !== undefined && (
                  <Flex direction="column" w="100%">
                    <Text
                      fontSize={isMobile ? "10px" : "11px"}
                      color="rgba(255,255,255,0.5)"
                      fontFamily={FONT_FAMILIES.NOSTROMO}
                      letterSpacing="1px"
                      mb="8px"
                    >
                      DEPOSIT AMOUNT
                    </Text>
                    <Flex
                      alignItems="center"
                      gap="12px"
                      position="relative"
                      role="group"
                      cursor="pointer"
                      onClick={() => copyToClipboard(bitcoinAmount.toFixed(8), "Bitcoin Amount")}
                    >
                      <Text
                        color={colors.offWhite}
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        fontSize={isMobile ? "18px" : "26px"}
                        letterSpacing={isMobile ? "-1.2px" : "-1.8px"}
                        fontWeight="500"
                      >
                        {bitcoinAmount.toFixed(8)}
                      </Text>
                      <Box opacity={0.6} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                        <LuCopy color="rgba(255, 255, 255, 0.8)" size={20} />
                      </Box>
                      <Box transform="scale(0.7)" transformOrigin="left center">
                        <WebAssetTag asset="BTC" />
                      </Box>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </Flex>
          ) : swapType === "bitcoin-deposit" && validStepIndex > 0 && bitcoinDepositTx ? (
            // Bitcoin deposit in progress - show loading or checkmark
            isSettled ? (
              <motion.div
                key="success"
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: isMobile ? "0px" : "30px",
                }}
              >
                <img
                  src="/images/txns/check.svg"
                  alt="Success"
                  style={{
                    width: "110px",
                    height: "110px",
                    filter: "drop-shadow(0 0 8px rgba(171, 125, 255, 0.1))",
                  }}
                />
              </motion.div>
            ) : (
              <Flex
                direction="column"
                alignItems="center"
                justifyContent="center"
                marginTop={isMobile ? "20px" : "120px"}
                gap="24px"
                zIndex={1}
              >
                <>
                  <motion.div
                    key="loading"
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 30, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          y: [0, -10, 0],
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.2,
                        }}
                        style={{
                          width: isMobile ? "16.8px" : "18px",
                          height: isMobile ? "16.8px" : "18px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
                        }}
                      />
                    ))}
                  </motion.div>

                  {!isMobile && (
                    <Flex
                      as="button"
                      onClick={() =>
                        window.open(`https://mempool.space/tx/${bitcoinDepositTx}`, "_blank")
                      }
                      alignItems="center"
                      justifyContent="center"
                      gap="8px"
                      px="18px"
                      mt="60px"
                      py="7px"
                      borderRadius="19px"
                      bg="rgba(255, 255, 255, 0.1)"
                      border="1px solid rgba(255, 255, 255, 0.2)"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                      _active={{ transform: "scale(0.98)" }}
                    >
                      <Text
                        fontSize="11px"
                        color="rgba(255, 255, 255, 0.9)"
                        fontFamily={FONT_FAMILIES.NOSTROMO}
                        letterSpacing="0.5px"
                      >
                        VIEW DEPOSIT TXN
                      </Text>
                      <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
                    </Flex>
                  )}
                </>
              </Flex>
            )
          ) : (
            // EVM deposit view
            <AnimatePresence mode="wait">
              {(() => {
                return countdownValue > 0 && !isSettled;
              })() ? (
                <motion.div
                  key="countdown"
                  initial={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ marginTop: "30px" }}
                >
                  <CountdownTimer
                    onComplete={() => {
                      console.log("Countdown completed");
                    }}
                  />
                </motion.div>
              ) : showLoadingDots ? (
                <Flex
                  direction="column"
                  alignItems="center"
                  justifyContent="center"
                  marginTop={isMobile ? "20px" : "100px"}
                  gap="24px"
                  zIndex={1}
                >
                  <motion.div
                    key="loading"
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 30, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          y: [0, -10, 0],
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.2,
                        }}
                        style={{
                          width: isMobile ? "16.8px" : "18px",
                          height: isMobile ? "16.8px" : "18px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
                        }}
                      />
                    ))}
                  </motion.div>

                  {userDepositTxHash && !isMobile && (
                    <Flex
                      as="button"
                      onClick={handleViewUserTransaction}
                      alignItems="center"
                      justifyContent="center"
                      gap="8px"
                      px="18px"
                      mt="50px"
                      py="7px"
                      borderRadius="19px"
                      bg="rgba(255, 255, 255, 0.1)"
                      border="1px solid rgba(255, 255, 255, 0.2)"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                      _active={{ transform: "scale(0.98)" }}
                    >
                      <Text
                        fontSize="11px"
                        color="rgba(255, 255, 255, 0.9)"
                        fontFamily={FONT_FAMILIES.NOSTROMO}
                        letterSpacing="0.5px"
                      >
                        VIEW DEPOSIT TXN
                      </Text>
                      <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
                    </Flex>
                  )}
                </Flex>
              ) : (
                <motion.div
                  key="success"
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: isMobile ? "0px" : "30px",
                  }}
                >
                  <img
                    src="/images/txns/check.svg"
                    alt="Success"
                    style={{
                      width: isMobile ? "110px" : "140px",
                      height: isMobile ? "110px" : "140px",
                      filter: "drop-shadow(0 0 8px rgba(171, 125, 255, 0.1))",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Box>

        {/* Bottom Half - Steps */}
        <Box
          h={isMobile ? "52%" : "45%"}
          bottom="0px"
          position="absolute"
          paddingX="20px"
          paddingY="10px"
          w="100%"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <StepCarousel
            swapId={currentSwapId}
            swapType={swapType}
            marginTopCustom={isMobile ? "-10px" : ""}
            paddingBottomCustom={isMobile ? "20px" : "80px"}
            paddingTopCustom={isMobile ? "4px" : "6px"}
            evmConfirmations={evmConfirmations}
            btcConfirmations={btcConfirmations}
            mmDepositChain={swapStatusInfo?.quote?.to.currency.chain}
            userDepositTx={bitcoinDepositTx || userDepositTxHash}
            showFillingOrderWarning={showFillingOrderWarning}
            onNewSwap={handleNewSwap}
            onViewUserDeposit={handleViewUserTransaction}
          />
        </Box>

        {/* Refund Modal */}
        <RefundModal
          isOpen={refundModalOpen}
          selectedSwap={selectedFailedSwap}
          refundAddress={refundAddress}
          setRefundAddress={setRefundAddress}
          isClaimingRefund={isClaimingRefund}
          refundStatus={refundStatus}
          currentBitcoinFee={currentBitcoinFee}
          fetchingFee={fetchingFee}
          onClose={closeRefundModal}
          onClaimRefund={claimRefund}
        />
      </Box>

      {/* Mobile: View Deposit Transaction Button below widget */}
      {isMobile &&
        !isSettled &&
        ((swapType === "bitcoin-deposit" && bitcoinDepositTx) || userDepositTxHash) && (
          <Box mt="12px" w="100%" display="flex" justifyContent="center">
            <Box
              as="button"
              onClick={handleViewUserTransaction}
              border="2px solid rgba(255, 255, 255, 0.22)"
              borderRadius="26px"
              width="100%"
              background="rgba(255, 255, 255, 0.05)"
              padding="12px 16px"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                transform: "translateY(-2px)",
                bg: "rgba(255, 255, 255, 0.10)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 4px 12px rgba(255, 255, 255, 0.1)",
              }}
            >
              <Flex alignItems="center" justifyContent="center" gap="8px">
                <Text
                  color="white"
                  fontFamily="Nostromo"
                  fontSize="14px"
                  fontWeight="normal"
                  letterSpacing="0.5px"
                >
                  VIEW DEPOSIT
                </Text>
                <FiExternalLink size={14} color="rgba(255, 255, 255, 0.9)" />
              </Flex>
            </Box>
          </Box>
        )}

      {/* Hidden audio element for swap completion sound */}
      <audio ref={audioRef} src="/assets/swap_sfx.wav" preload="auto" />
    </Flex>
  );
}
