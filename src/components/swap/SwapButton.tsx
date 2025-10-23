import { Flex, Text, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
  useReadContract,
} from "wagmi";
import { colors } from "@/utils/colors";
import { GLOBAL_CONFIG, otcClient } from "@/utils/constants";
import { BitcoinQRCode } from "@/components/other/BitcoinQRCode";
import { generateBitcoinURI } from "@/utils/bitcoinUtils";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore } from "@/utils/store";
import { toastInfo, toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { reownModal } from "@/utils/wallet";
import { Address, erc20Abi, parseUnits } from "viem";
import { Quote } from "@/utils/rfqClient";
import { fetchGasParams } from "@/utils/swapHelpers";
import { UNIVERSAL_ROUTER_ADDRESS } from "@/utils/permit2";
import { RoutePlanner, CommandType } from "@uniswap/universal-router-sdk";
import { createUniswapRouter } from "@/utils/uniswapRouter";

export const SwapButton = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isMobile } = useWindowSize();
  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();
  const router = useRouter();

  // Local state
  const [pendingSwapTransaction, setPendingSwapTransaction] = useState<{
    to: Address;
    calldata: string;
    value: string;
    routerType: "v4" | "v2v3";
    inputAmount: string;
    depositAddress?: string;
    route?: {
      inputToken?: string;
      outputToken?: string;
      [key: string]: any;
    };
  } | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

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
  } = useStore();

  // Wagmi hooks for contract interactions
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const {
    data: sendTxHash,
    sendTransaction,
    isPending: isSendTxPending,
    error: sendTxError,
  } = useSendTransaction();

  // Token approval hooks
  const {
    data: approveHash,
    writeContract: writeApprove,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  // Check token allowance
  const isNativeETH =
    selectedInputToken?.address?.toLowerCase() === "eth" || !selectedInputToken?.address;

  // For V4 swaps, check allowance to Universal Router; for V2/V3, check allowance to SwapRouter02
  const spenderAddress =
    pendingSwapTransaction?.routerType === "v4"
      ? UNIVERSAL_ROUTER_ADDRESS
      : (pendingSwapTransaction?.to as Address);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedInputToken?.address as Address | undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: [userEvmAccountAddress as Address, spenderAddress],
    query: {
      enabled: Boolean(
        !isNativeETH &&
          userEvmAccountAddress &&
          selectedInputToken?.address &&
          pendingSwapTransaction?.to &&
          (pendingSwapTransaction?.routerType === "v2v3" ||
            pendingSwapTransaction?.routerType === "v4")
      ),
    },
  });

  // Wait for approval confirmation
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({
      hash: approveHash,
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

  // Button loading state combines pending transaction and confirmation waiting
  const isButtonLoading =
    isPending || isSendTxPending || isConfirming || isApprovePending || isApproveConfirming;

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

  // Send OTC request to create swap
  const sendOTCRequest = async (
    quote: Quote,
    user_destination_address: string,
    user_evm_account_address: string
  ) => {
    const currentTime = new Date().getTime();
    const swap = await otcClient.createSwap({
      quote,
      user_destination_address,
      user_evm_account_address,
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
  };

  // Main swap handler - routes to appropriate swap function
  const handleSwap = async () => {
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

      // Check payout address
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
        await handleCBBTCtoBTCSwap();
        return;
      }

      // For ERC20->BTC swaps, use the new Uniswap flow
      if (isSwappingForBTC && uniswapQuote && rfqQuote) {
        await handleERC20ToBTCSwap();
        return;
      }

      // For BTC->ERC20 swaps, use the existing flow
      // Note: This flow may need updating based on your requirements
      toastInfo({
        title: "BTC to ERC20",
        description: "BTC to ERC20 swap flow not yet implemented in this component",
      });
    } catch (error) {
      console.error("handleSwap error caught:", error);
      // Errors will be handled by the writeError useEffect
    }
  };

  // Handle cbBTC->BTC swap using direct OTC transfer
  const handleCBBTCtoBTCSwap = async () => {
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
  };

  // Handle ERC20->BTC swap using Uniswap + OTC
  const handleERC20ToBTCSwap = async () => {
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
        });

        depositAddress = otcSwap.deposit_address;

        // Store swap response in state
        setSwapResponse(otcSwap);
      }

      // Step 2: Build Uniswap swap transaction with deposit address as receiver
      console.log("Building Uniswap swap transaction with, deposit address: ", depositAddress);

      const uniswapRouter = createUniswapRouter();
      const sellToken = selectedInputToken?.address || "ETH";
      const decimals = selectedInputToken.decimals;
      const sellAmount = parseUnits(rawInputAmount, decimals).toString();

      const swapTransaction = await uniswapRouter.buildSwapTransaction(
        {
          sellToken,
          sellAmount,
          decimals,
          userAddress: userEvmAccountAddress,
          slippageBps: slippageBips,
          validFor: 480, // 2 minutes
        },
        uniswapQuote.routerType, // Pass the router type from the quote, default to v2v3 in fake mode
        depositAddress // Set receiver to OTC deposit address
      );

      console.log("Swap transaction built:", swapTransaction);
      console.log("Transaction to:", swapTransaction.to);
      console.log("Transaction value:", swapTransaction.value);

      // Store the pending swap transaction
      setPendingSwapTransaction({
        to: swapTransaction.to as Address,
        calldata: swapTransaction.calldata,
        value: swapTransaction.value,
        routerType: swapTransaction.routerType || "v2v3",
        inputAmount: sellAmount,
        route: swapTransaction.route,
        depositAddress: depositAddress,
      });

      // For native ETH, no approval needed - execute immediately
      if (sellToken.toLowerCase() === "eth" || !sellToken) {
        console.log("Native ETH swap, executing immediately...");
        const gasParams = await fetchGasParams(evmConnectWalletChainId);
        console.log(
          "Gas params for ETH swap:",
          gasParams
            ? {
                maxFeePerGas: `${Number(gasParams.maxFeePerGas) / 1e9} gwei`,
                maxPriorityFeePerGas: `${Number(gasParams.maxPriorityFeePerGas) / 1e9} gwei`,
              }
            : undefined
        );
        const txData = {
          to: swapTransaction.to as Address,
          data: swapTransaction.calldata as `0x${string}`,
          value: BigInt(swapTransaction.value),
          ...(gasParams && {
            maxFeePerGas: gasParams.maxFeePerGas,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
          }),
        };
        sendTransaction(txData);
      } else {
        // For ERC20 tokens, check approval status
        console.log("ERC20 token swap, checking approval status...");
        // Explicitly refetch allowance to update UI
        await refetchAllowance();
      }
    } catch (error) {
      console.error("ERC20->BTC swap failed:", error);

      toastError(error, {
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle token approval
  const handleApprove = async () => {
    if (!selectedInputToken?.address || !pendingSwapTransaction || !rawInputAmount) {
      console.error("Missing required data for approval");
      return;
    }

    try {
      console.log("Approving token...", {
        token: selectedInputToken.address,
        spender: pendingSwapTransaction.to,
        amount: rawInputAmount,
      });

      const sellAmount = parseUnits(rawInputAmount, selectedInputToken.decimals);

      const gasParams = await fetchGasParams(evmConnectWalletChainId);
      console.log(
        "Gas params for approval:",
        gasParams
          ? {
              maxFeePerGas: `${Number(gasParams.maxFeePerGas) / 1e9} gwei`,
              maxPriorityFeePerGas: `${Number(gasParams.maxPriorityFeePerGas) / 1e9} gwei`,
            }
          : undefined
      );

      // For V4 swaps, approve Universal Router; for V2/V3, approve SwapRouter02
      const spenderAddress =
        pendingSwapTransaction.routerType === "v4"
          ? UNIVERSAL_ROUTER_ADDRESS
          : pendingSwapTransaction.to;

      console.log(
        "Approving spender:",
        spenderAddress,
        "for router type:",
        pendingSwapTransaction.routerType
      );

      writeApprove({
        address: selectedInputToken.address as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddress, sellAmount],
        ...(gasParams && {
          maxFeePerGas: gasParams.maxFeePerGas,
          maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        }),
      });
    } catch (error) {
      console.error("Approval failed:", error);
      toastError(error, {
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Execute the pending swap transaction
  const handleExecuteSwap = async () => {
    if (!pendingSwapTransaction || !userEvmAccountAddress) {
      console.error("No pending swap transaction or user address");
      return;
    }

    try {
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

      // V4 swaps with ERC20 inputs use standard approval to Universal Router
      if (pendingSwapTransaction.routerType === "v4" && !isNativeETH) {
        console.log("[V4] Executing V4 swap with standard ERC20 approval");

        // Get deposit address from pending transaction or fall back to user address in FAKE_OTC mode
        const depositAddress = (pendingSwapTransaction.depositAddress ||
          userEvmAccountAddress) as Address;
        console.log("Deposit address:", depositAddress);
        const deadline = Math.floor(Date.now() / 1000) + 480; // 8 minutes from now

        // Get output token from route metadata
        const outputToken = pendingSwapTransaction.route?.outputToken as Address;

        // Use RoutePlanner SDK to properly encode Universal Router commands
        const routePlanner = new RoutePlanner();

        // Add V4_SWAP command with encoded actions from server
        routePlanner.addCommand(CommandType.V4_SWAP, [
          pendingSwapTransaction.calldata as `0x${string}`,
        ]);

        // SWEEP no longer needed - tokens go directly to receiver via TAKE action
        // routePlanner.addCommand(CommandType.SWEEP, [
        //   outputToken,
        //   depositAddress,
        //   0n, // minAmount: 0 (we already have slippage protection in V4 actions)
        // ]);

        console.log("[V4] Executing Universal Router with deposit address:", depositAddress);

        // Call UniversalRouter.execute(commands, inputs, deadline)
        writeContract({
          address: UNIVERSAL_ROUTER_ADDRESS,
          abi: [
            {
              inputs: [
                { internalType: "bytes", name: "commands", type: "bytes" },
                { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
                { internalType: "uint256", name: "deadline", type: "uint256" },
              ],
              name: "execute",
              outputs: [],
              stateMutability: "payable",
              type: "function",
            },
          ],
          functionName: "execute",
          args: [
            routePlanner.commands as `0x${string}`,
            routePlanner.inputs as readonly `0x${string}`[],
            BigInt(deadline),
          ],
          ...(gasParams && {
            maxFeePerGas: gasParams.maxFeePerGas,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
          }),
        });
      } else if (pendingSwapTransaction.routerType === "v4" && isNativeETH) {
        // V4 swap with ETH - simpler flow using msg.value
        console.log("[V4] Executing V4 swap with ETH (msg.value)");

        // Get deposit address from pending transaction or fall back to user address in FAKE_OTC mode
        const depositAddress = (pendingSwapTransaction.depositAddress ||
          userEvmAccountAddress) as Address;

        const deadline = Math.floor(Date.now() / 1000) + 480;

        // Get output token from route metadata
        const outputToken = pendingSwapTransaction.route?.outputToken as Address;

        // Use RoutePlanner SDK to properly encode Universal Router commands
        const routePlanner = new RoutePlanner();

        // Add V4_SWAP command with encoded actions from server
        routePlanner.addCommand(CommandType.V4_SWAP, [
          pendingSwapTransaction.calldata as `0x${string}`,
        ]);

        // SWEEP no longer needed - tokens go directly to receiver via TAKE action
        // routePlanner.addCommand(CommandType.SWEEP, [
        //   outputToken,
        //   depositAddress,
        //   0n, // minAmount: 0 (we already have slippage protection in V4 actions)
        // ]);

        console.log("[V4] Executing Universal Router with deposit address:", depositAddress);

        writeContract({
          address: UNIVERSAL_ROUTER_ADDRESS,
          abi: [
            {
              inputs: [
                { internalType: "bytes", name: "commands", type: "bytes" },
                { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
                { internalType: "uint256", name: "deadline", type: "uint256" },
              ],
              name: "execute",
              outputs: [],
              stateMutability: "payable",
              type: "function",
            },
          ],
          functionName: "execute",
          args: [
            routePlanner.commands as `0x${string}`,
            routePlanner.inputs as readonly `0x${string}`[],
            BigInt(deadline),
          ],
          value: BigInt(pendingSwapTransaction.value),
          ...(gasParams && {
            maxFeePerGas: gasParams.maxFeePerGas,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
          }),
        });
      } else {
        // V2/V3 swap - use existing sendTransaction flow
        console.log("[V2/V3] Executing V2/V3 swap");
        const txData = {
          to: pendingSwapTransaction.to,
          data: pendingSwapTransaction.calldata as `0x${string}`,
          value: BigInt(pendingSwapTransaction.value),
          ...(gasParams && {
            maxFeePerGas: gasParams.maxFeePerGas,
            maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
          }),
        };
        sendTransaction(txData);
      }
    } catch (error) {
      console.error("Swap execution failed:", error);
      toastError(error, {
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

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
    if (approveError) {
      console.error("Approve error:", approveError);
      toastError(approveError, {
        title: "Approval Failed",
        description: approveError instanceof Error ? approveError.message : "Unknown error",
      });
    }
  }, [writeError, sendTxError, approveError]);

  // Check if approval is needed when allowance is fetched
  useEffect(() => {
    if (!pendingSwapTransaction || isNativeETH) {
      setNeedsApproval(false);
      return;
    }

    if (allowance !== undefined && rawInputAmount && selectedInputToken) {
      const sellAmount = parseUnits(rawInputAmount, selectedInputToken.decimals);
      const hasEnoughAllowance = allowance >= sellAmount;
      setNeedsApproval(!hasEnoughAllowance);
      console.log("Allowance check:", {
        allowance: allowance.toString(),
        sellAmount: sellAmount.toString(),
        needsApproval: !hasEnoughAllowance,
      });
    }
  }, [allowance, pendingSwapTransaction, rawInputAmount, selectedInputToken, isNativeETH]);

  // Refetch allowance after approval is confirmed
  useEffect(() => {
    if (isApproveConfirmed) {
      console.log("Approval confirmed, refetching allowance...");
      refetchAllowance();

      toastSuccess({
        title: "Approval Confirmed",
        description: "Token approval successful. You can now swap.",
      });
    }
  }, [isApproveConfirmed, refetchAllowance]);

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

  // Handle keyboard events (Enter to submit)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && allFieldsFilled && !isButtonLoading) {
        event.preventDefault();
        handleSwap();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [allFieldsFilled, isButtonLoading]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Flex direction="column" w="100%">
      {/* Approval and Swap Buttons */}
      {pendingSwapTransaction && needsApproval && !isNativeETH ? (
        // Show Approve button when approval is needed
        <Flex gap="8px" w="100%" mt="8px">
          <Flex
            bg={colors.swapBgColor}
            _hover={{
              bg: !isButtonLoading ? colors.swapHoverColor : undefined,
            }}
            w="100%"
            transition="0.2s"
            h="58px"
            onClick={isButtonLoading ? undefined : handleApprove}
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
            {(isApprovePending || isApproveConfirming) && (
              <Spinner size="sm" color={colors.offWhite} mr="10px" />
            )}
            <Text color={colors.offWhite} fontFamily="Nostromo">
              {isApprovePending
                ? "Confirm in Wallet..."
                : isApproveConfirming
                  ? "Confirming..."
                  : `Approve ${selectedInputToken?.ticker || "Token"}`}
            </Text>
          </Flex>
          <Flex
            bg={colors.swapBgColor}
            w="100%"
            transition="0.2s"
            h="58px"
            fontSize="18px"
            align="center"
            userSelect="none"
            cursor="not-allowed"
            borderRadius="16px"
            justify="center"
            border="3px solid"
            borderColor={colors.swapBorderColor}
            opacity={0.5}
          >
            <Text color={colors.offWhite} fontFamily="Nostromo">
              Swap
            </Text>
          </Flex>
        </Flex>
      ) : pendingSwapTransaction && !needsApproval && !isNativeETH ? (
        // Show Swap button when approved
        <Flex
          bg={colors.swapBgColor}
          _hover={{
            bg: !isButtonLoading ? colors.swapHoverColor : undefined,
          }}
          w="100%"
          mt="8px"
          transition="0.2s"
          h="58px"
          onClick={isButtonLoading ? undefined : handleExecuteSwap}
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
          {(isSendTxPending || isConfirming) && (
            <Spinner size="sm" color={colors.offWhite} mr="10px" />
          )}
          <Text color={colors.offWhite} fontFamily="Nostromo">
            {isSendTxPending ? "Confirm in Wallet..." : isConfirming ? "Confirming..." : "Swap"}
          </Text>
        </Flex>
      ) : (
        // Show default Swap button for initial swap or native ETH
        <Flex
          bg={colors.swapBgColor}
          _hover={{
            bg: !isButtonLoading ? colors.swapHoverColor : undefined,
          }}
          w="100%"
          mt="8px"
          transition="0.2s"
          h="58px"
          onClick={isButtonLoading ? undefined : handleSwap}
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
          {isButtonLoading && <Spinner size="sm" color={colors.offWhite} mr="10px" />}
          <Text color={colors.offWhite} fontFamily="Nostromo">
            {isPending || isSendTxPending
              ? "Confirm in Wallet..."
              : isConfirming
                ? "Confirming..."
                : "Swap"}
          </Text>
        </Flex>
      )}

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
