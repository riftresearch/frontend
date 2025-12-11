import { Flex, Text, Spinner, Box, Button } from "@chakra-ui/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { FONT_FAMILIES } from "@/utils/font";
import { useRouter } from "next/router";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
} from "wagmi";
import { colors } from "@/utils/colors";
import { GLOBAL_CONFIG, otcClient, IS_FRONTEND_PAUSED } from "@/utils/constants";
import { OTCServerError } from "@/utils/otcClient";
import { generateBitcoinURI } from "@/utils/bitcoinUtils";
import { useStore, CowswapOrderStatus } from "@/utils/store";
import { toastInfo, toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { reownModal } from "@/utils/wallet";
import { Address, erc20Abi, parseUnits } from "viem";
import { Quote } from "@/utils/rfqClient";
import { ApprovalState } from "@/utils/types";
import { fetchGasParams, getSlippageBpsForNotional } from "@/utils/swapHelpers";
import { useCowSwapClient } from "@/components/providers/CowSwapProvider";
import { SupportedChainId } from "@cowprotocol/cow-sdk";

export const SwapButton = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isMobile } = useWindowSize();
  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();
  const router = useRouter();

  // CowSwap client
  const cowswapClient = useCowSwapClient();

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
    selectedInputToken,
    evmConnectWalletChainId,
    displayedInputAmount,
    fullPrecisionInputAmount,
    outputAmount,
    isSwappingForBTC,
    cowswapQuote,
    rfqQuote,
    quoteType,
    payoutAddress,
    addressValidation,
    setBitcoinDepositInfo,
    bitcoinDepositInfo,
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
    clearQuotes,
    cowswapOrderStatus,
    setCowswapOrderStatus,
    cowswapOrderData,
    setCowswapOrderData,
    isAwaitingOptimalQuote,
    btcPrice,
    ethPrice,
    erc20Price,
  } = useStore();
  // Ref to track previous refetchQuote value for retry detection
  const prevRefetchQuoteRef = useRef(refetchQuote);

  // Helper function to handle OTC errors with specific messaging
  // Defined inside component to access state setters for loading cancellation
  const handleOTCError = (error: unknown) => {
    console.error("OTC Error:", error);

    // Cancel all loading states on the button
    setSwapButtonPressed(false);
    setIsApprovingToken(false);
    setCowswapOrderStatus(CowswapOrderStatus.NO_ORDER);

    // Clear and refetch the quote
    clearQuotes();
    setRefetchQuote(true);

    // Check if it's an OFAC-related error
    if (error instanceof OTCServerError && error.isOFACSanctioned()) {
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

  // Wagmi hooks for contract interactions
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const {
    data: sendTxHash,
    sendTransaction,
    isPending: isSendTxPending,
    error: sendTxError,
  } = useSendTransaction();

  // Wait for approval transaction confirmation
  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalConfirmed,
    error: approvalTxError,
  } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: sendTxHash,
  });

  // Check token allowance
  const isNativeETH = selectedInputToken.ticker === "ETH";

  const isCbBTC = selectedInputToken.ticker === "cbBTC";

  // Button loading state combines pending transaction, approval, and confirmation waiting
  const isButtonLoading =
    isPending || isSendTxPending || isConfirming || isApprovingToken || isApprovalConfirming;

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

  // Approve CowSwap to spend tokens using the SDK (unlimited approval)
  const approveCowSwap = useCallback(async () => {
    if (!selectedInputToken.address || !cowswapClient) {
      console.error("No token selected or CowSwap client not available");
      return;
    }

    try {
      setSwapButtonPressed(true);
      setApprovalState(ApprovalState.APPROVING);
      setIsApprovingToken(true);
      console.log("Approving CowSwap for token:", selectedInputToken.address);

      // Determine chain ID for the SDK
      const chainId =
        evmConnectWalletChainId === 8453 ? SupportedChainId.BASE : SupportedChainId.MAINNET;

      // Use unlimited approval (maxUint256) for better UX - no need to approve again
      const txHash = await cowswapClient.approveCowProtocol({
        tokenAddress: selectedInputToken.address as Address,
        chainId,
      });

      console.log("CowSwap approval transaction:", txHash);
      setApprovalTxHash(txHash);
    } catch (error) {
      console.error("CowSwap approval failed:", error);
      let errorDescription =
        error instanceof Error && error.message.includes("User rejected the request")
          ? "User rejected the transaction"
          : undefined;
      setApprovalState(ApprovalState.NEEDS_APPROVAL);
      setIsApprovingToken(false);
      setSwapButtonPressed(false);
      toastError(undefined, {
        title: "Approval Failed",
        description: undefined,
      });
    }
  }, [selectedInputToken, evmConnectWalletChainId, cowswapClient, setApprovalState]);

  // Handle cbBTC->BTC swap using direct OTC transfer
  const executeCBBTCtoBTCSwap = useCallback(async () => {
    if (!rfqQuote || !userEvmAccountAddress) {
      setRefetchQuote(true);
      return;
    }

    try {
      // Step 1: Create OTC swap to get deposit address
      // Use full precision amount if available, otherwise use displayed amount
      const amountToTransfer = fullPrecisionInputAmount || displayedInputAmount;
      console.log("amountToTransfer", amountToTransfer);

      const startAssetMetadata = {
        ticker: selectedInputToken.ticker,
        address: selectedInputToken.address || "native",
        icon: selectedInputToken.icon,
        amount: amountToTransfer,
        decimals: selectedInputToken.decimals,
      };

      console.log("🔵 [METADATA] Creating cbBTC->BTC swap with metadata:");
      console.log("  - Amount in metadata:", amountToTransfer);

      console.log("Creating OTC swap for cbBTC...");
      const otcSwap = await otcClient.createSwap({
        quote: rfqQuote,
        user_destination_address: payoutAddress,
        user_evm_account_address: userEvmAccountAddress,
        metadata: selectedInputToken
          ? {
              affiliate: "app.rift.trade",
              start_asset: JSON.stringify(startAssetMetadata),
            }
          : undefined,
      });

      const depositAddress = otcSwap.deposit_address;
      console.log("OTC deposit address:", depositAddress);

      // Store swap response in state
      setSwapResponse(otcSwap);

      // Step 2: Initiate ERC20 transfer of cbBTC to deposit address
      const decimals = selectedInputToken.decimals;
      const transferAmount = parseUnits(amountToTransfer, decimals);

      console.log("Initiating cbBTC transfer to deposit address...");

      // Get cbBTC token address from selectedInputToken
      const cbBTCAddress = selectedInputToken.address as Address;

      if (!cbBTCAddress) {
        throw new Error("cbBTC token address not found");
      }

      // Prompt user to sign the transfer transaction
      const gasParams = await fetchGasParams(evmConnectWalletChainId);
      console.log(
        "Gas params for cbBTC transfer:",
        gasParams
          ? {
              maxFeePerGas: `${Number(gasParams.maxFeePerGas) / 1e9} gwei`,
              maxPriorityFeePerGas: `${Number(gasParams.maxPriorityFeePerGas) / 1e9} gwei`,
            }
          : undefined
      );

      const txConfig: any = {
        address: cbBTCAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [depositAddress as Address, transferAmount],
      };

      // Add gas params if available
      if (gasParams) {
        txConfig.maxFeePerGas = gasParams.maxFeePerGas;
        txConfig.maxPriorityFeePerGas = gasParams.maxPriorityFeePerGas;
      }

      // Mark that we're doing a cbBTC transfer so the effect can redirect on tx confirmation
      setIsCbBTCTransferPending(true);
      writeContract(txConfig);
    } catch (error) {
      console.error("cbBTC->BTC swap failed:", error);
      setSwapResponse(null);
      setIsCbBTCTransferPending(false);
      handleOTCError(error);
    }
  }, [
    rfqQuote,
    userEvmAccountAddress,
    selectedInputToken,
    payoutAddress,
    fullPrecisionInputAmount,
    setSwapResponse,
    displayedInputAmount,
    evmConnectWalletChainId,
    writeContract,
  ]);

  // Handle ERC20->BTC swap using CowSwap + OTC
  const executeERC20ToBTCSwap = useCallback(async () => {
    // Wait for optimal quote and executable quote type before proceeding
    if (isAwaitingOptimalQuote || quoteType !== "executable") {
      console.log("Waiting for executable optimal quote to arrive...");
      // Poll until optimal quote arrives and quote is executable (check every 100ms, timeout after 10s)
      const maxWaitMs = 60000;
      const pollIntervalMs = 100;
      let waited = 0;
      while (
        (useStore.getState().isAwaitingOptimalQuote ||
          useStore.getState().quoteType !== "executable") &&
        waited < maxWaitMs
      ) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        waited += pollIntervalMs;
      }
      // If still waiting after timeout, abort
      const state = useStore.getState();
      if (state.isAwaitingOptimalQuote || state.quoteType !== "executable") {
        console.error("Timed out waiting for executable optimal quote");
        toastError(new Error("Quote timeout"), {
          title: "Quote Timeout",
          description: "Unable to fetch optimal price. Please try again.",
        });
        return;
      }
      console.log("Executable optimal quote received, proceeding with swap");
    }

    // Check fake mode environment variables
    const FAKE_RFQ = process.env.NEXT_PUBLIC_FAKE_RFQ === "true";
    const FAKE_OTC = process.env.NEXT_PUBLIC_FAKE_OTC === "true";

    // Validate userEvmAccountAddress first
    if (!userEvmAccountAddress) {
      toastError(new Error("Wallet not connected"), {
        title: "Swap Failed",
        description: "Please connect your wallet",
      });
      return;
    }

    // Check RFQ quote if not in fake mode
    if (!FAKE_RFQ && !rfqQuote) {
      setRefetchQuote(true);
      return;
    }

    try {
      let depositAddress: string;
      let otcSwap: any = null;

      if (FAKE_OTC) {
        // In fake OTC mode, use user's wallet address as deposit address
        console.log("FAKE_OTC mode enabled - using user wallet as deposit address");
        depositAddress = userEvmAccountAddress;
      } else {
        // Step 1: Create OTC swap to get deposit address
        // Use full precision amount if available, otherwise use displayed amount
        const amountForMetadata = fullPrecisionInputAmount || displayedInputAmount;

        const startAssetMetadata = {
          ticker: selectedInputToken.ticker,
          address: selectedInputToken.address || "native",
          icon: selectedInputToken.icon,
          amount: amountForMetadata,
          decimals: selectedInputToken.decimals,
        };

        console.log("🟠 [METADATA] Creating ERC20->BTC swap with metadata:");
        console.log("  - Amount in metadata:", amountForMetadata);

        otcSwap = await otcClient.createSwap({
          quote: rfqQuote!,
          user_destination_address: payoutAddress,
          user_evm_account_address: userEvmAccountAddress,
          metadata: selectedInputToken
            ? {
                affiliate: "app.rift.trade",
                start_asset: JSON.stringify(startAssetMetadata),
              }
            : undefined,
        });

        depositAddress = otcSwap.deposit_address;

        // Store swap response in state
        setSwapResponse(otcSwap);
      }

      // Step 2: Submit CowSwap order
      console.log("Submitting CowSwap order to deposit address:", depositAddress);

      if (!cowswapClient) {
        throw new Error("CowSwap client not available");
      }

      if (!cowswapQuote) {
        setRefetchQuote(true);
        return;
      }

      // Set status to signing
      setCowswapOrderStatus(CowswapOrderStatus.SIGNING);

      // Submit order using CowSwap client
      const sellToken = selectedInputToken.address;
      const decimals = selectedInputToken.decimals;

      // Use buyAmount from the quote (exact output)
      const buyAmount = cowswapQuote.amountsAndCosts.afterSlippage.buyAmount.toString();

      // Calculate dynamic slippage based on notional USD value
      let usdValue = 0;
      const inputAmount = parseFloat(displayedInputAmount || "0");
      if (selectedInputToken.ticker === "ETH" && ethPrice) {
        usdValue = inputAmount * ethPrice;
      } else if (selectedInputToken.ticker === "cbBTC" && btcPrice) {
        usdValue = inputAmount * btcPrice;
      } else if (erc20Price) {
        usdValue = inputAmount * erc20Price;
      }
      const dynamicSlippageBps = getSlippageBpsForNotional(usdValue);
      console.log(
        "Order submission - dynamicSlippageBps:",
        dynamicSlippageBps,
        "for usdValue:",
        usdValue
      );

      // Derive chainId from RFQ quote (source of truth for the swap chain)
      const quoteChain = rfqQuote!.from.currency.chain;
      const quoteChainId = quoteChain === "ethereum" ? 1 : quoteChain === "base" ? 8453 : null;

      // Validate quote chain is supported and matches connected wallet
      if (quoteChainId === null || quoteChainId !== evmConnectWalletChainId) {
        toastError(new Error("Wrong chain connected"), {
          title: "Wrong chain connected",
          description: "Please connect your wallet to the correct chain",
        });
        setSwapButtonPressed(false);
        setIsApprovingToken(false);
        setIsCbBTCTransferPending(false);
        setCowswapOrderStatus(CowswapOrderStatus.NO_ORDER);
        return;
      }

      const orderId = await cowswapClient.submitOrder({
        sellToken,
        buyAmount,
        decimals,
        slippageBps: dynamicSlippageBps,
        userAddress: userEvmAccountAddress,
        receiver: depositAddress, // Send cbBTC to OTC deposit address
        chainId: quoteChainId as any,
      });

      console.log("CowSwap order submitted:", orderId);

      // Store order ID and set status to signed
      setCowswapOrderData({ id: orderId, order: null });
      setCowswapOrderStatus(CowswapOrderStatus.SIGNED);

      // Store CowSwap order ID in swap metadata
      if (otcSwap?.swap_id) {
        try {
          await fetch(`/api/swap/${otcSwap.swap_id}/metadata`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              metadata: {
                cowswapOrderId: orderId,
              },
            }),
          });
          console.log("CowSwap order ID stored in swap metadata");
        } catch (error) {
          console.error("Failed to store CowSwap order ID in metadata:", error);
          // Don't fail the swap if metadata update fails
        }
      }

      // Redirect to swap tracking page
      if (otcSwap?.swap_id) {
        console.log("Redirecting to swap page with ID:", otcSwap.swap_id);
        router.push(`/swap/${otcSwap.swap_id}`);
      }
    } catch (error) {
      console.error("ERC20->BTC swap failed:", error);
      setSwapResponse(null);
      handleOTCError(error);
    }
  }, [
    cowswapQuote,
    rfqQuote,
    quoteType,
    userEvmAccountAddress,
    selectedInputToken,
    payoutAddress,
    setSwapResponse,
    displayedInputAmount,
    evmConnectWalletChainId,
    fullPrecisionInputAmount,
    cowswapClient,
    setCowswapOrderStatus,
    setCowswapOrderData,
    isAwaitingOptimalQuote,
    btcPrice,
    ethPrice,
    erc20Price,
  ]);

  // Handle BTC->cbBTC swap using OTC
  const executeBTCtoCBBTCSwap = useCallback(async () => {
    if (!rfqQuote || !userEvmAccountAddress) {
      setRefetchQuote(true);
      return;
    }

    try {
      // Step 1: Create OTC swap to get Bitcoin deposit address
      console.log("Creating OTC swap for BTC->cbBTC...");
      const otcSwap = await otcClient.createSwap({
        quote: rfqQuote,
        user_destination_address: userEvmAccountAddress,
        user_evm_account_address: userEvmAccountAddress,
        metadata: {
          affiliate: "app.rift.trade",
          start_asset: "native:BTC",
        },
      });

      console.log("OTC swap created:", otcSwap);

      // Store swap response in state
      setSwapResponse(otcSwap);

      // Step 2: Generate Bitcoin URI and show QR code
      const amount = BigInt(otcSwap.expected_amount);
      const amountInBTC = Number(amount) / Math.pow(10, otcSwap.decimals);
      const bitcoinUri = generateBitcoinURI(otcSwap.deposit_address, amountInBTC, "Rift Swap");

      setBitcoinDepositInfo({
        address: otcSwap.deposit_address,
        amount: amountInBTC,
        uri: bitcoinUri,
      });

      // Step 3: Redirect to swap tracking page
      console.log("Redirecting to swap page with ID:", otcSwap.swap_id);
      router.push(`/swap/${otcSwap.swap_id}`);
    } catch (error) {
      console.error("BTC->cbBTC swap failed:", error);
      setSwapResponse(null);
      handleOTCError(error);
    }
  }, [
    rfqQuote,
    userEvmAccountAddress,
    selectedInputToken,
    payoutAddress,
    setSwapResponse,
    setBitcoinDepositInfo,
  ]);

  // Main swap handler - routes to appropriate swap function
  const startSwap = useCallback(async () => {
    try {
      // For cbBTC->BTC swaps, use the direct OTC flow
      if (isSwappingForBTC && selectedInputToken.ticker === "cbBTC") {
        setSwapButtonPressed(true);
        await executeCBBTCtoBTCSwap();
        return;
      }

      // For ERC20->BTC swaps, use the CowSwap flow
      if (isSwappingForBTC) {
        setSwapButtonPressed(true);
        await executeERC20ToBTCSwap();
        return;
      }

      // For BTC->cbBTC swaps
      if (!isSwappingForBTC) {
        setSwapButtonPressed(true);
        await executeBTCtoCBBTCSwap();
        return;
      }
    } catch (error) {
      console.error("startSwap error caught:", error);
      setSwapButtonPressed(false);
      // Errors will be handled by the writeError useEffect
    }
  }, [
    isSwappingForBTC,
    selectedInputToken,
    executeCBBTCtoBTCSwap,
    executeERC20ToBTCSwap,
    executeBTCtoCBBTCSwap,
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

    if (!isWalletConnected) {
      await reownModal.open();
      return;
    }

    if (isSwappingForBTC) {
      if (!payoutAddress) {
        toastInfo({
          title: "Enter Bitcoin Address",
          description: "Please enter your Bitcoin address to receive BTC",
        });
        return;
      }
      if (!addressValidation.isValid) {
        toastInfo({
          title: "Invalid Bitcoin Address",
          description: "Please enter a valid Bitcoin address",
        });
        return;
      }
    }

    // Native ETH, cbBTC, or BTC->cbBTC swaps don't need approval
    if (isNativeETH || isCbBTC || !isSwappingForBTC) {
      await startSwap();
      return;
    }

    // For ERC20 tokens, check if we need approval
    if (approvalState === ApprovalState.NEEDS_APPROVAL) {
      await approveCowSwap();
      return;
    }

    // Already approved, proceed with swap
    if (approvalState === ApprovalState.APPROVED) {
      await startSwap();
    }
  }, [
    approvalState,
    approveCowSwap,
    startSwap,
    payoutAddress,
    addressValidation,
    isSwappingForBTC,
    isWalletConnected,
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
    if (isPending || isSendTxPending) {
      console.log("Transaction pending...");
    }
  }, [isPending, isSendTxPending]);

  // Update store when transaction is confirmed
  useEffect(() => {
    console.log("isConfirmed", isConfirmed);
    if (isConfirmed) {
      setTransactionConfirmed(true);
    }
  }, [isConfirmed, setTransactionConfirmed]);

  // Handle user declined transaction in wallet
  useEffect(() => {
    if (writeError || sendTxError) {
      const error = writeError || sendTxError;
      console.warn("Transaction error:", error);

      // Check if user rejected the request
      const errorMessage = error?.message || "";
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
      clearQuotes();
      setRefetchQuote(true);
    }
  }, [writeError, sendTxError, clearQuotes, setRefetchQuote]);

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
    if (hash && isCbBTCTransferPending && swapResponse?.swap_id) {
      console.log("cbBTC transfer signed, redirecting to swap page:", swapResponse.swap_id);
      setIsCbBTCTransferPending(false);
      router.push(`/swap/${swapResponse.swap_id}`);
    }
  }, [hash, isCbBTCTransferPending, swapResponse?.swap_id, router]);

  // Handle approval confirmation and errors
  useEffect(() => {
    if (isApprovalConfirmed) {
      console.log("CowSwap approval confirmed");
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
    if (wasRefetching && isDoneRefetching && rfqQuote !== null && swapButtonPressed) {
      console.log("Auto-retrying swap after quote refetch completed");
      startSwap();
      // Update ref to prevent re-triggering on subsequent renders
      prevRefetchQuoteRef.current = false;
    } else {
      // Update ref with current value
      prevRefetchQuoteRef.current = refetchQuote;
    }
  }, [refetchQuote, rfqQuote, swapButtonPressed, startSwap]);

  // Track previous wallet connection state for detecting connection events
  const wasWalletConnectedRef = useRef(isWalletConnected);

  // Auto-trigger swap when wallet connects while an executable quote exists
  useEffect(() => {
    const justConnected = !wasWalletConnectedRef.current && isWalletConnected;
    wasWalletConnectedRef.current = isWalletConnected;

    if (justConnected && rfqQuote !== null && quoteType !== null) {
      console.log("Wallet connected with executable quote - triggering swap");
      handleSwapButtonClick();
    }
  }, [isWalletConnected, rfqQuote, quoteType, handleSwapButtonClick]);

  // CowSwap order status polling with visibility-aware behavior
  // This fixes the bug where background tabs throttle setInterval, causing the app
  // to appear stuck when users switch away and return
  useEffect(() => {
    // Only poll when order is signed
    if (
      cowswapOrderStatus !== CowswapOrderStatus.SIGNED ||
      !cowswapOrderData?.id ||
      !cowswapClient
    ) {
      return;
    }

    console.log("Starting CowSwap order status polling for order:", cowswapOrderData.id);

    // Get chainId from selected token for correct SDK
    const tokenChainId = selectedInputToken.chainId ?? 1;
    const sdk = cowswapClient.getSdk(tokenChainId as any);

    let isPollingActive = true;

    const pollOrderStatus = async () => {
      if (!isPollingActive) return;

      try {
        const order = await sdk.getOrder({ orderUid: cowswapOrderData.id! });
        console.log("Order status:", order.status);
        console.log("Sell amount:", order.sellAmount);
        console.log("Buy amount:", order.buyAmount);

        // Update order data
        setCowswapOrderData({ id: cowswapOrderData.id, order });

        // Check order status and update accordingly
        if (order.status === "fulfilled" || order.status === "presignaturePending") {
          console.log("CowSwap order succeeded");
          setCowswapOrderStatus(CowswapOrderStatus.SUCCESS);
          setTransactionConfirmed(true);
        } else if (order.status === "cancelled" || order.status === "expired") {
          console.log("CowSwap order failed or cancelled");
          setCowswapOrderStatus(CowswapOrderStatus.FAIL);
        }
        // For other statuses (open, scheduled), continue polling
      } catch (error) {
        console.error("Error polling order status:", error);
        // Don't fail on polling errors, just log them
      }
    };

    // Handle visibility change - poll immediately when tab becomes visible
    // This fixes the issue where browsers throttle setInterval in background tabs
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isPollingActive) {
        console.log("Tab became visible, polling CowSwap order status immediately");
        pollOrderStatus();
      }
    };

    // Poll immediately on mount
    pollOrderStatus();

    // Then poll every 10 seconds
    const intervalId = setInterval(pollOrderStatus, 10000);

    // Listen for visibility changes to recover from background tab throttling
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup interval and event listener on unmount or when status changes
    return () => {
      console.log("Stopping CowSwap order status polling");
      isPollingActive = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    cowswapOrderStatus,
    cowswapOrderData?.id,
    cowswapClient,
    setCowswapOrderData,
    setCowswapOrderStatus,
    setTransactionConfirmed,
    selectedInputToken.chainId,
  ]);

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
        text: `Not enough ${selectedInputToken.ticker}`,
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

    // If approving CowSwap
    if (approvalState === ApprovalState.APPROVING || isApprovalConfirming || isApprovingToken) {
      return {
        text: "Approving...",
        handler: undefined,
        showSpinner: true,
      };
    }

    // If swap transaction is pending/confirming
    if (isPending || isSendTxPending) {
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

    // If signing CowSwap order
    if (cowswapOrderStatus === CowswapOrderStatus.SIGNING) {
      return {
        text: "Signing Order...",
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

  console.log("[DEBUG] Button state:", {
    exceedsUserBalance,
    exceedsAvailableBTCLiquidity,
    exceedsAvailableCBBTCLiquidity,
    inputBelowMinimum,
    hasValidationError,
    isButtonLoading,
    isOtcServerDead,
    isRetryingOtcServer,
    hasNoRoutesError,
    isButtonDisabled,
  });

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
