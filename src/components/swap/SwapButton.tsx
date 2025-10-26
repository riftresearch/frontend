import { Flex, Text, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
  useSignTypedData,
} from "wagmi";
import { colors } from "@/utils/colors";
import {
  GLOBAL_CONFIG,
  otcClient,
  UNIVERSAL_ROUTER_ADDRESS,
  SWAP_ROUTER02_ADDRESS,
  PERMIT2_ADDRESS,
} from "@/utils/constants";
import { BitcoinQRCode } from "@/components/other/BitcoinQRCode";
import { generateBitcoinURI } from "@/utils/bitcoinUtils";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore } from "@/utils/store";
import { toastInfo, toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { reownModal } from "@/utils/wallet";
import { Address, erc20Abi, parseUnits, maxUint256 } from "viem";
import { Quote } from "@/utils/rfqClient";
import { ApprovalState } from "@/utils/types";
import { fetchGasParams, buildPermitDataToSign } from "@/utils/swapHelpers";
import { createUniswapRouter } from "@/utils/uniswapRouter";

export const SwapButton = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isMobile } = useWindowSize();
  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();
  const router = useRouter();

  // Local state
  const [isSigningPermit, setIsSigningPermit] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [swapButtonPressed, setSwapButtonPressed] = useState(false);

  // Global store
  const {
    swapResponse,
    setSwapResponse,
    setTransactionConfirmed,
    selectedInputToken,
    evmConnectWalletChainId,
    rawInputAmount,
    outputAmount,
    isSwappingForBTC,
    uniswapQuote,
    rfqQuote,
    slippageBips,
    payoutAddress,
    addressValidation,
    setBitcoinDepositInfo,
    bitcoinDepositInfo,
    permitAllowance,
    permitDataForSwap,
    setPermitDataForSwap,
    approvalState,
    setApprovalState,
  } = useStore();

  // Wagmi hooks for contract interactions
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const {
    data: sendTxHash,
    sendTransaction,
    isPending: isSendTxPending,
    error: sendTxError,
  } = useSendTransaction();

  // Permit2 signature hook
  const { signTypedDataAsync } = useSignTypedData();

  // Check token allowance
  const isNativeETH = selectedInputToken?.ticker === "ETH";

  const isCbBTC = selectedInputToken?.ticker === "cbBTC";

  // Wait for approval transaction confirmation
  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalConfirmed,
    error: approvalTxError,
  } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  // Wait for transaction confirmation (use either hash from writeContract or sendTransaction)
  const txHash = hash || sendTxHash;
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Button loading state combines pending transaction, permit signing, approval, and confirmation waiting
  const isButtonLoading =
    isPending || isSendTxPending || isConfirming || isSigningPermit || isApprovalConfirming;

  // Check if all required fields are filled
  const allFieldsFilled =
    rawInputAmount &&
    outputAmount &&
    parseFloat(rawInputAmount) > 0 &&
    parseFloat(outputAmount) > 0 &&
    payoutAddress &&
    addressValidation.isValid;

  // ============================================================================
  // SWAP-RELATED FUNCTIONS
  // ============================================================================

  // Helper function to check if permit is needed
  const needsPermit = useCallback(() => {
    if (isNativeETH || isCbBTC || !selectedInputToken || !rawInputAmount) {
      return false;
    }

    // If we already have valid permitDataForSwap, we don't need another permit
    if (permitDataForSwap?.permit && permitDataForSwap?.signature) {
      const currentTime = Math.floor(Date.now() / 1000);
      const permitExpiration = permitDataForSwap.permit.sigDeadline;

      // Check if permit is still valid (not expired) and for the correct token
      if (
        permitExpiration > currentTime &&
        permitDataForSwap.permit.details.token.toLowerCase() ===
          selectedInputToken.address?.toLowerCase()
      ) {
        return false; // Already have valid permit
      }
    }

    if (!permitAllowance) {
      return true; // No permit allowance info yet, assume needs permit
    }

    const sellAmount = parseUnits(rawInputAmount, selectedInputToken.decimals);
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationThreshold = currentTime + 5 * 60; // 5 minutes from now

    // Need permit if allowance is insufficient or expiring soon
    return (
      BigInt(permitAllowance.amount) < sellAmount ||
      Number(permitAllowance.expiration) < expirationThreshold
    );
  }, [isNativeETH, selectedInputToken, rawInputAmount, permitAllowance, permitDataForSwap]);

  // Send OTC request to create swap
  const sendOTCRequest = useCallback(
    async (quote: Quote, user_destination_address: string, user_evm_account_address: string) => {
      const currentTime = new Date().getTime();
      const swap = await otcClient.createSwap({
        quote,
        user_destination_address,
        user_evm_account_address,
        metadata: selectedInputToken
          ? {
              affiliate: "app.rift.trade",
              startAsset: `${selectedInputToken.ticker}:${selectedInputToken.address || "native"}:${selectedInputToken.icon}`,
            }
          : undefined,
      });
      const timeTaken = new Date().getTime() - currentTime;

      console.log("got swap from OTC", swap, "in", timeTaken, "ms");
      if (swap) {
        setSwapResponse(swap);
      }
      console.log("Returned swap request", swap);
      // hex to string bigint
      const amount = BigInt(swap.expected_amount);
      console.log("amount", amount);
      // okay, now we need to request money to be sent from the user to the created swap
      if (swap.deposit_chain === "Ethereum") {
        try {
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
          writeContract({
            address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
            abi: erc20Abi,
            functionName: "transfer",
            args: [swap.deposit_address as `0x${string}`, amount],
            ...(gasParams && {
              maxFeePerGas: gasParams.maxFeePerGas,
              maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            }),
          });
        } catch (error) {
          console.error("writeContract error caught:", error);
          // Error will be handled by the writeError useEffect
        }
      } else if (swap.deposit_chain === "Bitcoin") {
        // Generate Bitcoin URI and show QR code
        const amountInBTC = Number(amount) / Math.pow(10, swap.decimals);
        const bitcoinUri = generateBitcoinURI(
          swap.deposit_address,
          amountInBTC,
          "Rift Exchange Swap"
        );

        setBitcoinDepositInfo({
          address: swap.deposit_address,
          amount: amountInBTC,
          uri: bitcoinUri,
        });

        // Show success toast for Bitcoin deposit setup
        toastSuccess({
          title: "Bitcoin Deposit Ready",
          description: "Scan the QR code or send Bitcoin to the address below",
        });
      } else {
        toastInfo({
          title: "Invalid deposit chain",
          description: "Frontend does not not support this deposit chain",
        });
        return;
      }
    },
    [evmConnectWalletChainId, setSwapResponse, setBitcoinDepositInfo, writeContract]
  );

  // Handle Permit2 signature
  const signPermit2 = useCallback(async () => {
    console.log("signPermit2", selectedInputToken?.address);
    if (!selectedInputToken?.address || !userEvmAccountAddress || !permitAllowance) {
      console.error("Missing required data for permit");
      return;
    }

    try {
      setIsSigningPermit(true);

      // Clear old permit data before signing new one
      setPermitDataForSwap(null);

      console.log("Signing Permit2...", {
        token: selectedInputToken.address,
        nonce: permitAllowance.nonce,
      });

      const { permit, dataToSign } = buildPermitDataToSign(
        Number(permitAllowance.nonce),
        selectedInputToken.address,
        userEvmAccountAddress,
        evmConnectWalletChainId
      );

      console.log("permit", permit);
      console.log("dataToSign", dataToSign);
      const signature = await signTypedDataAsync(dataToSign);

      console.log("Permit2 signed successfully");
      setPermitDataForSwap({ permit, signature });
    } catch (error) {
      console.error("Permit signing failed:", error);
      toastError(error, {
        title: "Permit Signing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSigningPermit(false);
    }
  }, [
    selectedInputToken,
    userEvmAccountAddress,
    permitAllowance,
    evmConnectWalletChainId,
    signTypedDataAsync,
    setPermitDataForSwap,
  ]);

  // Approve Permit2 to spend tokens
  const approvePermit2 = useCallback(async () => {
    if (!selectedInputToken?.address) {
      console.error("No token selected for approval");
      return;
    }

    try {
      setApprovalState(ApprovalState.APPROVING);
      setIsApprovingToken(true);
      console.log("Approving Permit2 for token:", selectedInputToken.address);

      const gasParams = await fetchGasParams(evmConnectWalletChainId);

      const txConfig: any = {
        address: selectedInputToken.address as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [PERMIT2_ADDRESS as Address, maxUint256],
      };

      if (gasParams) {
        txConfig.maxFeePerGas = gasParams.maxFeePerGas;
        txConfig.maxPriorityFeePerGas = gasParams.maxPriorityFeePerGas;
      }

      writeContract(txConfig);
    } catch (error) {
      console.error("Permit2 approval failed:", error);
      setApprovalState(ApprovalState.NEEDS_APPROVAL);
      setIsApprovingToken(false);
      toastError(error, {
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [selectedInputToken, evmConnectWalletChainId, writeContract, setApprovalState]);

  // Handle cbBTC->BTC swap using direct OTC transfer
  const executeCBBTCtoBTCSwap = useCallback(async () => {
    if (!rfqQuote || !userEvmAccountAddress || !selectedInputToken) {
      toastError(new Error("Missing quote data"), {
        title: "Swap Failed",
        description: "Please refresh the quote and try again",
      });
      return;
    }

    try {
      // Step 1: Create OTC swap to get deposit address
      console.log("Creating OTC swap for cbBTC...");
      const otcSwap = await otcClient.createSwap({
        quote: rfqQuote,
        user_destination_address: payoutAddress,
        user_evm_account_address: userEvmAccountAddress,
        metadata: selectedInputToken
          ? {
              affiliate: "app.rift.trade",
              startAsset: `${selectedInputToken.ticker}:${selectedInputToken.address || "native"}:${selectedInputToken.icon}`,
            }
          : undefined,
      });

      const depositAddress = otcSwap.deposit_address;
      console.log("OTC deposit address:", depositAddress);

      // Store swap response in state
      setSwapResponse(otcSwap);

      // Step 2: Initiate ERC20 transfer of cbBTC to deposit address
      const decimals = selectedInputToken.decimals;
      const transferAmount = parseUnits(rawInputAmount, decimals);

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

      writeContract(txConfig);
    } catch (error) {
      console.error("cbBTC->BTC swap failed:", error);

      toastError(error, {
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [
    rfqQuote,
    userEvmAccountAddress,
    selectedInputToken,
    payoutAddress,
    setSwapResponse,
    rawInputAmount,
    evmConnectWalletChainId,
    writeContract,
  ]);

  // Handle ERC20->BTC swap using Uniswap + OTC
  const executeERC20ToBTCSwap = useCallback(async () => {
    // Clear old permit data when starting a new swap
    setPermitDataForSwap(null);

    // Check fake mode environment variables
    const FAKE_RFQ = process.env.NEXT_PUBLIC_FAKE_RFQ === "true";
    const FAKE_OTC = process.env.NEXT_PUBLIC_FAKE_OTC === "true";

    // Skip validation if in fake mode
    if (FAKE_RFQ) {
      if (!uniswapQuote || !userEvmAccountAddress || !selectedInputToken) {
        toastError(new Error("Missing quote data"), {
          title: "Swap Failed",
          description: "Please refresh the quote and try again",
        });
        return;
      }
    } else {
      if (!uniswapQuote || !rfqQuote || !userEvmAccountAddress || !selectedInputToken) {
        toastError(new Error("Missing quote data"), {
          title: "Swap Failed",
          description: "Please refresh the quote and try again",
        });
        return;
      }
    }

    // Ensure we have userEvmAccountAddress and selectedInputToken for the actual swap
    if (!userEvmAccountAddress || !selectedInputToken) {
      toastError(new Error("Missing account or token data"), {
        title: "Swap Failed",
        description: "Please connect your wallet and select a token",
      });
      return;
    }

    try {
      let depositAddress: string;

      if (FAKE_OTC) {
        // In fake OTC mode, use user's wallet address as deposit address
        console.log("FAKE_OTC mode enabled - using user wallet as deposit address");
        depositAddress = userEvmAccountAddress;
      } else {
        // Step 1: Create OTC swap to get deposit address
        const otcSwap = await otcClient.createSwap({
          quote: rfqQuote!,
          user_destination_address: payoutAddress,
          user_evm_account_address: userEvmAccountAddress,
          metadata: selectedInputToken
            ? {
                affiliate: "app.rift.trade",
                startAsset: `${selectedInputToken.ticker}:${selectedInputToken.address || "native"}:${selectedInputToken.icon}`,
              }
            : undefined,
        });

        depositAddress = otcSwap.deposit_address;

        // Store swap response in state
        setSwapResponse(otcSwap);
      }

      // Step 2: Build Uniswap swap transaction with deposit address as receiver
      console.log("Building Uniswap swap transaction with, deposit address: ", depositAddress);

      const uniswapRouter = createUniswapRouter();
      const sellToken = selectedInputToken.address;
      const decimals = selectedInputToken.decimals;

      const swapTransaction = await uniswapRouter.buildSwapTransaction(
        sellToken,
        decimals,
        userEvmAccountAddress,
        uniswapQuote.routerType, // Pass the router type from the quote, default to v2v3 in fake mode
        uniswapQuote.amountIn,
        depositAddress, // Set receiver to OTC deposit address
        slippageBips,
        480, // validFor: 2 minutes
        permitDataForSwap?.permit || null,
        permitDataForSwap?.signature || "",
        // V4 fields from stored quote
        uniswapQuote.poolKey,
        uniswapQuote.path,
        uniswapQuote.currencyIn,
        uniswapQuote.isFirstToken,
        uniswapQuote.amountOut,
        uniswapQuote.isExactOutputSwap
      );

      console.log("Swap transaction built:", swapTransaction);
      console.log("Transaction to:", swapTransaction.to);
      console.log("Transaction value:", swapTransaction.value);

      // Execute the swap transaction
      console.log("Executing swap transaction...");
      const gasParams = await fetchGasParams(evmConnectWalletChainId);
      console.log(
        "Gas params for swap execution:",
        gasParams
          ? {
              maxFeePerGas: `${Number(gasParams.maxFeePerGas) / 1e9} gwei`,
              maxPriorityFeePerGas: `${Number(gasParams.maxPriorityFeePerGas) / 1e9} gwei`,
            }
          : undefined
      );

      // Conditional logging based on token type
      if (swapTransaction.routerType === "v4" && !isNativeETH) {
        console.log("[V4] Executing V4 swap with ERC20");
      } else if (swapTransaction.routerType === "v4" && isNativeETH) {
        console.log("[V4] Executing V4 swap with ETH");
      } else {
        console.log("[V2/V3] Executing V2/V3 swap");
      }

      // Execute the transaction
      sendTransaction({
        to: swapTransaction.to as Address,
        data: swapTransaction.calldata as `0x${string}`,
        value: BigInt(swapTransaction.value),
        ...(gasParams && {
          maxFeePerGas: gasParams.maxFeePerGas,
          maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        }),
      });
    } catch (error) {
      console.error("ERC20->BTC swap failed:", error);

      toastError(error, {
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [
    uniswapQuote,
    rfqQuote,
    userEvmAccountAddress,
    selectedInputToken,
    payoutAddress,
    setSwapResponse,
    rawInputAmount,
    slippageBips,
    evmConnectWalletChainId,
    sendTransaction,
    permitDataForSwap,
    isNativeETH,
    setPermitDataForSwap,
  ]);

  // Main swap handler - routes to appropriate swap function
  const startSwap = useCallback(async () => {
    try {
      if (!isWalletConnected) {
        // Open wallet connection modal instead of showing toast
        await reownModal.open();
        return;
      }

      if (isMobile) {
        toastInfo({
          title: "Hop on your laptop",
          description: "This app is too cool for small screens, mobile coming soon!",
        });
        return;
      }

      // Check input amount
      if (
        !rawInputAmount ||
        !outputAmount ||
        parseFloat(rawInputAmount) <= 0 ||
        parseFloat(outputAmount) <= 0
      ) {
        toastInfo({
          title: "Enter Amount",
          description: "Please enter a valid amount to swap",
        });
        return;
      }

      if (!payoutAddress) {
        toastInfo({
          title: isSwappingForBTC ? "Enter Bitcoin Address" : "Enter Ethereum Address",
          description: isSwappingForBTC
            ? "Please enter your Bitcoin address to receive BTC"
            : "Please enter your Ethereum address to receive cbBTC",
        });
        return;
      }

      if (!addressValidation.isValid) {
        let description = isSwappingForBTC
          ? "Please enter a valid Bitcoin payout address"
          : "Please enter a valid Ethereum address";
        if (isSwappingForBTC && addressValidation.networkMismatch) {
          description = `Wrong network: expected ${GLOBAL_CONFIG.underlyingSwappingAssets[0].currency.chain} but detected ${addressValidation.detectedNetwork}`;
        }
        toastInfo({
          title: isSwappingForBTC ? "Invalid Bitcoin Address" : "Invalid Ethereum Address",
          description,
        });
        return;
      }

      // For cbBTC->BTC swaps, use the direct OTC flow
      if (isSwappingForBTC && selectedInputToken?.ticker === "cbBTC" && rfqQuote) {
        await executeCBBTCtoBTCSwap();
        return;
      }

      // For ERC20->BTC swaps, use the new Uniswap flow
      if (isSwappingForBTC && uniswapQuote && rfqQuote) {
        await executeERC20ToBTCSwap();
        return;
      }

      // For BTC->ERC20 swaps, use the existing flow
      // Note: This flow may need updating based on your requirements
      toastInfo({
        title: "BTC to ERC20",
        description: "BTC to ERC20 swap flow not yet implemented in this component",
      });
    } catch (error) {
      console.error("startSwap error caught:", error);
      // Errors will be handled by the writeError useEffect
    }
  }, [
    isWalletConnected,
    isMobile,
    rawInputAmount,
    outputAmount,
    payoutAddress,
    addressValidation,
    isSwappingForBTC,
    selectedInputToken,
    rfqQuote,
    uniswapQuote,
    executeCBBTCtoBTCSwap,
    executeERC20ToBTCSwap,
  ]);

  // Unified handler that checks permit and routes to appropriate action
  const handleSwapButtonClick = useCallback(async () => {
    // First check if we need token approval to Permit2
    setSwapButtonPressed(true);
    if (isNativeETH || isCbBTC) {
      await startSwap();
      return;
    }

    console.log("approvalStat in swap button click", approvalState);
    if (approvalState === ApprovalState.NEEDS_APPROVAL) {
      await approvePermit2();
      return;
    }

    if (approvalState === ApprovalState.APPROVED) {
      // Then check if we need Permit2 signature
      if (needsPermit()) {
        await signPermit2();
      } else {
        await startSwap();
      }
    }
  }, [approvalState, approvePermit2, needsPermit, signPermit2, startSwap]);

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

  // Handle transaction pending state
  useEffect(() => {
    if (isPending || isSendTxPending) {
      console.log("Transaction pending...");
    }
  }, [isPending, isSendTxPending]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      console.error("Write contract error:", writeError);
    }
    if (sendTxError) {
      console.error("Send transaction error:", sendTxError);
    }
  }, [writeError, sendTxError]);

  // Update store when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      setTransactionConfirmed(true);
    }
  }, [isConfirmed, setTransactionConfirmed]);

  // Handle writeContract errors (user declined in wallet)
  useEffect(() => {
    if (writeError || sendTxError) {
      const error = writeError || sendTxError;
      console.warn("Transaction error:", error);
      // Custom BTC orange toast for transaction declined
      toastInfo({
        title: "Transaction Declined",
        description: "The user declined the transaction request",
        customStyle: {
          background: `linear-gradient(155deg, ${colors.currencyCard.btc.background} 0%, ${colors.assetTag.btc.background} 42%, ${colors.RiftOrange} 100%)`,
        },
      });
    }
  }, [writeError, sendTxError]);

  // Handle transaction receipt errors
  useEffect(() => {
    if (txError) {
      console.error("Transaction error:", txError);
      // Custom BTC orange toast for transaction failed
      toastInfo({
        title: "Transaction Failed",
        description: "The transaction failed on the network",
        customStyle: {
          background: `linear-gradient(155deg, ${colors.currencyCard.btc.background} 0%, ${colors.assetTag.btc.background} 42%, ${colors.RiftOrange} 100%)`,
        },
      });
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

  // Handle approval confirmation and errors
  useEffect(() => {
    if (isApprovalConfirmed) {
      console.log("Permit2 approval confirmed");
      setApprovalState(ApprovalState.APPROVED);
      toastSuccess({
        title: "Approval Confirmed",
        description: "Permit2 can now spend your tokens",
      });
      // Auto-sign permit after approval
      // if (!isButtonLoading) {
      //   console.log("Auto-signing permit after approval");
      //   signPermit2();
      // }
    } else if (approvalTxError) {
      console.error("Approval transaction error:", approvalTxError);
      setApprovalState(ApprovalState.NEEDS_APPROVAL);
      toastError(approvalTxError, {
        title: "Approval Failed",
        description: "The approval transaction failed on the network",
      });
    }
  }, [isApprovalConfirmed, approvalTxError, setApprovalState, isButtonLoading, signPermit2]);

  useEffect(() => {
    if (approvalState === ApprovalState.APPROVED) {
      console.log("Auto-signing permit after approval");
      console.log("permitDataForSwap", permitDataForSwap);
      if (needsPermit() && swapButtonPressed) {
        signPermit2();
      }
    }
  }, [approvalState, signPermit2]);

  // Auto-execute swap when permit is signed
  useEffect(() => {
    // When permitDataForSwap is set, automatically execute the swap
    if (permitDataForSwap && !isNativeETH && !isButtonLoading) {
      console.log("Auto-executing swap after permit signed");
      startSwap();
    }
  }, [permitDataForSwap, isNativeETH, isButtonLoading, startSwap]);

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
    // If approving Permit2
    if (approvalState === ApprovalState.APPROVING || isApprovalConfirming) {
      return {
        text: "Approving Permit2...",
        handler: undefined,
        showSpinner: true,
      };
    }

    // If signing permit
    if (isSigningPermit) {
      return {
        text: "Sign Permit2...",
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

    // Default: Show "Swap"
    return {
      text: "Swap",
      handler: handleSwapButtonClick,
      showSpinner: false,
    };
  };

  const buttonConfig = getButtonTextAndHandler();

  return (
    <Flex direction="column" w="100%">
      {/* Single Dynamic Swap Button */}
      <Flex
        bg={colors.swapBgColor}
        _hover={{
          bg: !isButtonLoading ? colors.swapHoverColor : undefined,
        }}
        w="100%"
        mt="8px"
        transition="0.2s"
        h="58px"
        onClick={isButtonLoading ? undefined : buttonConfig.handler}
        fontSize="18px"
        align="center"
        userSelect="none"
        cursor={!isButtonLoading ? "pointer" : "not-allowed"}
        borderRadius="16px"
        justify="center"
        border="3px solid"
        borderColor={colors.swapBorderColor}
        opacity={isButtonLoading ? 0.7 : 1}
        pointerEvents={isButtonLoading ? "none" : "auto"}
      >
        {buttonConfig.showSpinner && <Spinner size="sm" color={colors.offWhite} mr="10px" />}
        <Text color={colors.offWhite} fontFamily="Nostromo">
          {buttonConfig.text}
        </Text>
      </Flex>

      {/* Bitcoin QR Code Display - Animated (appears after swap initiation) */}
      {bitcoinDepositInfo && (
        <Flex
          direction="column"
          w="100%"
          mt="20px"
          p="20px"
          bg="rgba(46, 29, 14, 0.66)"
          border="2px solid #78491F"
          borderRadius="16px"
          opacity={bitcoinDepositInfo ? 1 : 0}
          transform={bitcoinDepositInfo ? "translateY(0px)" : "translateY(-20px)"}
          transition="all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        >
          <Text
            fontSize="18px"
            fontFamily={FONT_FAMILIES.NOSTROMO}
            color={colors.offWhite}
            mb="15px"
            textAlign="center"
          >
            Send Bitcoin to Complete Swap
          </Text>
          <Text
            fontSize="14px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.textGray}
            mb="20px"
            textAlign="center"
          >
            Scan the QR code or copy the address and amount below
          </Text>
          <BitcoinQRCode
            bitcoinUri={bitcoinDepositInfo.uri}
            address={bitcoinDepositInfo.address}
            amount={bitcoinDepositInfo.amount}
          />
          <Text
            fontWeight="normal"
            fontSize="13px"
            mt="20px"
            color={colors.textGray}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            textAlign="center"
          >
            WARNING: Send the exact amount shown above to complete the swap.
          </Text>
        </Flex>
      )}
    </Flex>
  );
};
