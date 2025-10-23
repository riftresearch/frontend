import {
  Flex,
  Text,
  Input,
  Spacer,
  Box,
  Tooltip as ChakraTooltip,
  Portal,
  Spinner,
  Button,
} from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignTypedData,
  useSendTransaction,
  useBlockNumber,
  useReadContract,
} from "wagmi";
import { colors } from "@/utils/colors";
import {
  BITCOIN_DECIMALS,
  GLOBAL_CONFIG,
  opaqueBackgroundColor,
  otcClient,
  rfqClient,
  ZERO_USD_DISPLAY,
} from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { BitcoinQRCode } from "@/components/other/BitcoinQRCode";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { InfoSVG } from "../other/SVGs";
import {
  convertToBitcoinLockingScript,
  validateBitcoinPayoutAddress,
  validateBitcoinPayoutAddressWithNetwork,
  generateBitcoinURI,
} from "@/utils/bitcoinUtils";
import { FONT_FAMILIES } from "@/utils/font";
import BitcoinAddressValidation from "../other/BitcoinAddressValidation";
import { useStore } from "@/utils/store";
import { toastInfo, toastWarning, toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { Asset, TokenData, TokenStyle } from "@/utils/types";
import { Hex } from "bitcoinjs-lib/src/types";
import { reownModal, wagmiAdapter } from "@/utils/wallet";
import { Address, erc20Abi, parseUnits } from "viem";
import { Quote, formatLotAmount, RfqClientError } from "@/utils/rfqClient";
import { CreateSwapResponse } from "@/utils/otcClient";
import { useSwapStatus } from "@/hooks/useSwapStatus";
import { useTDXAttestation } from "@/hooks/useTDXAttestation";
import {
  getERC20ToBTCQuote,
  getCBBTCtoBTCQuote,
  isAboveMinSwap,
  applySlippage,
  formatUsdValue,
  convertInputAmountToFullDecimals,
  calculateUsdValue,
  fetchGasParams,
} from "@/utils/swapHelpers";
import { createUniswapRouter } from "@/utils/uniswapRouter";
import {
  EVMAccountWarningModal,
  hasAcknowledgedEVMWarning,
} from "@/components/other/EVMAccountWarningModal";

export const SwapWidget = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isValidTEE, isLoading: teeAttestationLoading } = useTDXAttestation();
  // const { isChainSafe, isLoading: chainSyncVerificationLoading } = useTEEChainSyncVerification();
  const { isMobile } = useWindowSize();
  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();
  const router = useRouter();

  // Local state
  const [payoutAddress, setPayoutAddress] = useState("");
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }>({ isValid: false });
  const [lastEditedField, setLastEditedField] = useState<"input" | "output">("input");
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [bitcoinDepositInfo, setBitcoinDepositInfo] = useState<{
    address: string;
    amount: number;
    uri: string;
  } | null>(null);
  const [currentInputBalance, setCurrentInputBalance] = useState<string | null>(null);
  const [currentInputTicker, setCurrentInputTicker] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  // EVM warning modal state
  const [showEVMWarning, setShowEVMWarning] = useState(false);

  // Token approval state
  const [pendingSwapTransaction, setPendingSwapTransaction] = useState<{
    to: Address;
    calldata: string;
    value: string;
  } | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Refs
  const quoteRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Global store
  const {
    swapResponse,
    setSwapResponse,
    setTransactionConfirmed,
    selectedInputToken,
    userTokensByChain,
    evmConnectWalletChainId,
    rawInputAmount,
    setRawInputAmount,
    outputAmount,
    setOutputAmount,
    isSwappingForBTC,
    setIsSwappingForBTC,
    setBtcPrice,
    setEthPrice,
    btcPrice,
    ethPrice,
    erc20Price,
    setErc20Price,
    inputUsdValue,
    setInputUsdValue,
    outputUsdValue,
    setOutputUsdValue,
    uniswapQuote,
    setUniswapQuote,
    rfqQuote,
    setRfqQuote,
    slippageBips,
  } = useStore();

  // Wagmi hooks for contract interactions
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const {
    data: sendTxHash,
    sendTransaction,
    isPending: isSendTxPending,
    error: sendTxError,
  } = useSendTransaction();
  const {
    data: blockNumber,
    isLoading,
    error,
  } = useBlockNumber({
    watch: true, // 👈 keeps it updated as new blocks are mined
  });

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
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedInputToken?.address as Address | undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: [userEvmAccountAddress as Address, pendingSwapTransaction?.to as Address],
    query: {
      enabled: Boolean(
        !isNativeETH &&
          userEvmAccountAddress &&
          pendingSwapTransaction?.to &&
          selectedInputToken?.address
      ),
    },
  });

  // Wait for approval confirmation
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

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

  // Wait for transaction confirmation (use either hash from writeContract or sendTransaction)
  const txHash = hash || sendTxHash;
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Hook for signing typed data (EIP-712)
  const {
    data: signatureData,
    signTypedData,
    signTypedDataAsync,
    isPending: isSignaturePending,
    error: signatureError,
  } = useSignTypedData();

  // Button loading state combines pending transaction and confirmation waiting
  const isButtonLoading =
    isPending || isSendTxPending || isConfirming || isApprovePending || isApproveConfirming;

  // Define the styles based on swap direction
  const inputStyle = isSwappingForBTC
    ? GLOBAL_CONFIG.underlyingSwappingAssets[1].style
    : GLOBAL_CONFIG.underlyingSwappingAssets[0].style;
  const outputStyle = isSwappingForBTC
    ? GLOBAL_CONFIG.underlyingSwappingAssets[0].style
    : GLOBAL_CONFIG.underlyingSwappingAssets[1].style;

  // For WebAssetTag, we need to pass the right string identifiers
  const inputAssetIdentifier = isSwappingForBTC ? "ETH" : "BTC";
  const outputAssetIdentifier = isSwappingForBTC ? "BTC" : "ETH";

  // Styling constants
  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

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

  // Fetch ERC20 token price from API
  const fetchErc20TokenPrice = useCallback(
    async (tokenData: TokenData | null) => {
      // Only fetch if token has an address (ERC20 token, not ETH)
      if (!tokenData?.address) {
        setErc20Price(null);
        return;
      }

      const chainName =
        evmConnectWalletChainId === 1 || !evmConnectWalletChainId ? "ethereum" : "base";
      try {
        const response = await fetch(
          `/api/token-price?chain=${chainName}&addresses=${tokenData.address}`
        );
        if (response.ok) {
          const data = await response.json();
          const key = `${chainName}:${tokenData.address.toLowerCase()}`;
          const coin = data?.coins?.[key];
          if (coin && typeof coin.price === "number") {
            setErc20Price(coin.price);
          }
        }
      } catch (error) {
        console.error("Failed to fetch ERC20 price:", error);
      }
    },
    [evmConnectWalletChainId, setErc20Price]
  );

  // Fetch quote for ERC20/ETH -> BTC (combines CowSwap + RFQ)
  const fetchERC20ToBTCQuote = useCallback(
    async (inputAmount?: string) => {
      // Use provided amount or fall back to state
      const amountToQuote = inputAmount ?? rawInputAmount;

      if (!isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        return;
      }

      if (!selectedInputToken) {
        return;
      }

      // Check if the input value is above minimum swap threshold
      const inputValue = parseFloat(amountToQuote);
      let price: number | null = null;

      if (!selectedInputToken || selectedInputToken.ticker === "ETH") {
        price = ethPrice;
      } else if (selectedInputToken.address) {
        price = erc20Price;
      }

      if (price && btcPrice) {
        const usdValue = inputValue * price;

        if (!isAboveMinSwap(usdValue, btcPrice)) {
          console.log("Input value below minimum swap threshold");
          // Clear quotes but don't show error - just wait for larger amount
          setUniswapQuote(null);
          setRfqQuote(null);
          setOutputAmount("");
          return;
        }
      }

      try {
        // Convert amount to base units
        const decimals = selectedInputToken.decimals;
        const sellAmount = parseUnits(amountToQuote, decimals).toString();

        // Check if token is cbBTC
        const isCbBTC = selectedInputToken.ticker === "cbBTC";

        if (isCbBTC) {
          // For cbBTC, use direct RFQ quote
          const rfqQuoteResponse = await getCBBTCtoBTCQuote(sellAmount);

          if (rfqQuoteResponse) {
            setUniswapQuote(null); // No Uniswap needed for cbBTC
            setRfqQuote(rfqQuoteResponse);
            setOutputAmount(formatLotAmount(rfqQuoteResponse.to));
            setQuote(rfqQuoteResponse);
          } else {
            // Clear state on failure
            setUniswapQuote(null);
            setRfqQuote(null);
            setOutputAmount("");
          }
        } else {
          // For other ERC20 tokens, use combined quote with Uniswap
          const sellToken = selectedInputToken?.address || "ETH";
          const quoteResponse = await getERC20ToBTCQuote(
            sellToken,
            sellAmount,
            decimals,
            userEvmAccountAddress
              ? userEvmAccountAddress
              : "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
            slippageBips
          );

          if (quoteResponse) {
            setUniswapQuote(quoteResponse.uniswapQuote);
            setRfqQuote(quoteResponse.rfqQuote);
            setOutputAmount(quoteResponse.btcOutputAmount);
            setQuote(quoteResponse.rfqQuote); // Keep for compatibility
          } else {
            // Clear state on failure
            setUniswapQuote(null);
            setRfqQuote(null);
            setOutputAmount("");
          }
        }
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        setUniswapQuote(null);
        setRfqQuote(null);
        setOutputAmount("");
      }
    },
    [
      isSwappingForBTC,
      rawInputAmount,
      userEvmAccountAddress,
      selectedInputToken,
      setUniswapQuote,
      setRfqQuote,
      setOutputAmount,
      ethPrice,
      erc20Price,
      btcPrice,
      slippageBips,
    ]
  );

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

  // Handle EVM warning confirmation
  const handleEVMWarningConfirm = async (): Promise<void> => {
    setShowEVMWarning(false);
    await reownModal.open();
  };

  // Main swap handler - routes to appropriate swap function
  const handleSwap = async () => {
    try {
      if (!isWalletConnected) {
        // Check if user has already acknowledged the EVM warning
        if (!hasAcknowledgedEVMWarning()) {
          setShowEVMWarning(true);
          return;
        }
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
      const inputAmountInSatoshis = convertInputAmountToFullDecimals(
        rawInputAmount,
        selectedInputToken
      );
      console.log("inputAmountInSatoshis", inputAmountInSatoshis);
      if (quote && inputAmountInSatoshis) {
        console.log("sending swap request");
        await sendOTCRequest(quote, payoutAddress, userEvmAccountAddress!);
      }
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
      writeContract({
        address: cbBTCAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [depositAddress as Address, transferAmount],
        ...(gasParams && {
          maxFeePerGas: gasParams.maxFeePerGas,
          maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        }),
      });
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
      });

      // For native ETH, no approval needed - execute immediately
      if (sellToken.toLowerCase() === "eth" || !sellToken) {
        console.log("Native ETH swap, executing immediately...");
        const gasParams = await fetchGasParams(evmConnectWalletChainId);
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
        // The useEffect will handle setting needsApproval state
        console.log("ERC20 token swap, checking approval status...");
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
      writeApprove({
        address: selectedInputToken.address as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [pendingSwapTransaction.to, sellAmount],
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
    if (!pendingSwapTransaction) {
      console.error("No pending swap transaction");
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
    } catch (error) {
      console.error("Swap execution failed:", error);
      toastError(error, {
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const openAssetSelector = () => {
    setIsAssetSelectorOpen(true);
  };

  const closeAssetSelector = () => {
    setIsAssetSelectorOpen(false);
  };

  const handleSwapReverse = () => {
    setIsSwappingForBTC(!isSwappingForBTC);
    // Keep input/output amounts when reversing
    setRawInputAmount(outputAmount);
    setOutputAmount(rawInputAmount);
    setInputUsdValue(outputUsdValue);
    setOutputUsdValue(inputUsdValue);

    setPayoutAddress("");
    setAddressValidation({ isValid: false });
    setBitcoinDepositInfo(null); // Clear Bitcoin deposit info when switching directions
    // Don't reset hasStartedTyping if we have amounts, so sections stay visible
    if (!rawInputAmount && !outputAmount) {
      setHasStartedTyping(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // If first character is "0" or ".", replace with "0."
    if (rawInputAmount === "" && (value === "0" || value === ".")) {
      value = "0.";
    }

    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setRawInputAmount(value);
      setLastEditedField("input");
      setHasStartedTyping(true);

      // Update USD value using helper
      const usdValue = calculateUsdValue(
        value,
        isSwappingForBTC,
        selectedInputToken,
        ethPrice,
        btcPrice,
        erc20Price,
        true // isInputField
      );
      setInputUsdValue(usdValue);

      // Clear existing quotes when user types
      setUniswapQuote(null);
      setRfqQuote(null);
      setQuote(null);

      if (!value || parseFloat(value) <= 0) {
        // Clear output if input is empty or 0
        setOutputAmount("");
        setOutputUsdValue(ZERO_USD_DISPLAY);
      }

      // Clear any existing debounce timer
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }

      // Set up debounced quote fetch (150ms delay)
      // Pass the value directly to avoid stale closure issues
      if (value && parseFloat(value) > 0) {
        quoteDebounceTimerRef.current = setTimeout(() => {
          fetchERC20ToBTCQuote(value);
        }, 150);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If value is "0." and user presses Backspace or Delete, clear both characters
    if (rawInputAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setRawInputAmount("");
      setOutputAmount("");
      setInputUsdValue(ZERO_USD_DISPLAY);
      setOutputUsdValue(ZERO_USD_DISPLAY);
    }
  };

  const handleOutputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // If first character is "0" or ".", replace with "0."
    if (outputAmount === "" && (value === "0" || value === ".")) {
      value = "0.";
    }

    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setOutputAmount(value);
      setLastEditedField("output");
      setHasStartedTyping(true);

      // Update USD value using helper
      const usdValue = calculateUsdValue(
        value,
        isSwappingForBTC,
        selectedInputToken,
        ethPrice,
        btcPrice,
        erc20Price,
        false // isInputField
      );
      setOutputUsdValue(usdValue);
    }
  };

  const handleOutputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If value is "0." and user presses Backspace or Delete, clear both characters
    if (outputAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setOutputAmount("");
      setOutputUsdValue(ZERO_USD_DISPLAY);
    }
  };

  const handleMaxClick = () => {
    if (!currentInputBalance) return;

    // Set the balance as the input amount
    setRawInputAmount(currentInputBalance);
    setLastEditedField("input");
    setHasStartedTyping(true);

    // Update USD value using helper
    const usdValue = calculateUsdValue(
      currentInputBalance,
      isSwappingForBTC,
      selectedInputToken,
      ethPrice,
      btcPrice,
      erc20Price,
      true // isInputField
    );
    setInputUsdValue(usdValue);
  };

  // Handle keyboard events (Enter to submit)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter" && allFieldsFilled && !isButtonLoading) {
        event.preventDefault();
        handleSwap();
      }
    },
    [allFieldsFilled, isButtonLoading]
  );

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

  // Reset values on mount and cleanup timers on unmount
  useEffect(() => {
    setRawInputAmount("");
    setOutputAmount("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setPayoutAddress("");
    setBitcoinDepositInfo(null);

    // Cleanup debounce timer on unmount
    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
    };
  }, [setRawInputAmount, setOutputAmount, setInputUsdValue, setOutputUsdValue]);

  // Fetch BTC and ETH prices on mount
  useEffect(() => {
    const fetchETHandBTCPrice = async () => {
      try {
        // Fetch BTC price
        const btcResponse = await fetch("/api/token-price?chain=coingecko&addresses=bitcoin");
        if (btcResponse.ok) {
          const btcData = await btcResponse.json();
          const btcKey = "coingecko:bitcoin";
          const btcCoin = btcData?.coins?.[btcKey];
          if (btcCoin && typeof btcCoin.price === "number") {
            setBtcPrice(btcCoin.price);
          }
        }

        // Fetch ETH price
        const ethResponse = await fetch(
          "/api/token-price?chain=ethereum&addresses=0x0000000000000000000000000000000000000000"
        );
        if (ethResponse.ok) {
          const ethData = await ethResponse.json();
          const ethKey = "ethereum:0x0000000000000000000000000000000000000000";
          const ethCoin = ethData?.coins?.[ethKey];
          if (ethCoin && typeof ethCoin.price === "number") {
            setEthPrice(ethCoin.price);
          }
        }
      } catch (error) {
        console.error("Failed to fetch BTC/ETH prices:", error);
      }
    };

    fetchETHandBTCPrice();
  }, [setBtcPrice, setEthPrice]);

  // Fetch ERC20 token price when selected token changes
  useEffect(() => {
    fetchErc20TokenPrice(selectedInputToken);
  }, [selectedInputToken, fetchErc20TokenPrice]);

  // Update USD values when prices or amounts change
  useEffect(() => {
    const inputUsd = calculateUsdValue(
      rawInputAmount,
      isSwappingForBTC,
      selectedInputToken,
      ethPrice,
      btcPrice,
      erc20Price,
      true
    );
    setInputUsdValue(inputUsd);

    const outputUsd = calculateUsdValue(
      outputAmount,
      isSwappingForBTC,
      selectedInputToken,
      ethPrice,
      btcPrice,
      erc20Price,
      false
    );
    setOutputUsdValue(outputUsd);
  }, [
    erc20Price,
    btcPrice,
    ethPrice,
    rawInputAmount,
    outputAmount,
    isSwappingForBTC,
    selectedInputToken,
    setInputUsdValue,
    setOutputUsdValue,
  ]);

  // Validate payout address whenever it changes (Bitcoin or Ethereum based on swap direction)
  useEffect(() => {
    if (payoutAddress) {
      if (!isSwappingForBTC) {
        // For BTC -> ERC20 swaps, validate Ethereum address for payout
        const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        setAddressValidation({
          isValid: ethAddressRegex.test(payoutAddress),
        });
      } else {
        // For ERC20 -> BTC swaps, validate Bitcoin address for payout
        const validation = validateBitcoinPayoutAddressWithNetwork(payoutAddress, "mainnet");
        setAddressValidation(validation);
      }
    } else {
      setAddressValidation({ isValid: false });
    }
  }, [payoutAddress, isSwappingForBTC]);

  // Auto-refresh quote every 15 seconds when user has entered an amount
  useEffect(() => {
    // Clear any existing interval
    if (quoteRefreshIntervalRef.current) {
      clearInterval(quoteRefreshIntervalRef.current);
      quoteRefreshIntervalRef.current = null;
    }

    // Only set up auto-refresh if conditions are met and we have a quote
    if (
      isSwappingForBTC &&
      rawInputAmount &&
      parseFloat(rawInputAmount) > 0 &&
      userEvmAccountAddress &&
      (uniswapQuote || rfqQuote)
    ) {
      // Set up 15-second refresh interval
      // Don't pass a value to fetchERC20ToBTCQuote - it will use current rawInputAmount from state
      quoteRefreshIntervalRef.current = setInterval(() => {
        fetchERC20ToBTCQuote();
      }, 15000);
    }

    // Cleanup on unmount or when conditions change
    return () => {
      if (quoteRefreshIntervalRef.current) {
        clearInterval(quoteRefreshIntervalRef.current);
        quoteRefreshIntervalRef.current = null;
      }
    };
  }, [
    isSwappingForBTC,
    rawInputAmount,
    userEvmAccountAddress,
    uniswapQuote,
    rfqQuote,
    fetchERC20ToBTCQuote,
  ]);

  // Update current input balance when wallet connection or token selection changes
  useEffect(() => {
    if (!isWalletConnected || inputAssetIdentifier === "BTC") {
      setCurrentInputBalance(null);
      setCurrentInputTicker(null);
      return;
    }

    const fallbackList = userTokensByChain?.[evmConnectWalletChainId] || [];
    const fallbackEth = fallbackList.find((t) => t.ticker?.toUpperCase() === "ETH");
    const token = selectedInputToken || fallbackEth;

    if (!token) {
      setCurrentInputBalance(null);
      setCurrentInputTicker(null);
      return;
    }

    const balance = token.balance;
    const amt = parseFloat(balance);

    if (!balance || !Number.isFinite(amt) || amt <= 0) {
      setCurrentInputBalance(null);
      setCurrentInputTicker(null);
      return;
    }

    setCurrentInputBalance(balance);
    setCurrentInputTicker(token.ticker || null);
  }, [
    isWalletConnected,
    userEvmAccountAddress,
    selectedInputToken,
    userTokensByChain,
    evmConnectWalletChainId,
    inputAssetIdentifier,
  ]);

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

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <>
      <EVMAccountWarningModal isOpen={showEVMWarning} onConfirm={handleEVMWarningConfirm} />

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
        <Flex w="91.5%" direction="column">
          {/* Input Asset Section */}
          <Flex w="100%" flexDir="column" position="relative">
            <Flex
              px="10px"
              bg={inputStyle?.dark_bg_color || "rgba(37, 82, 131, 0.66)"}
              w="100%"
              h="121px"
              border="2px solid"
              borderColor={inputStyle?.bg_color || "#255283"}
              borderRadius="16px"
            >
              <Flex direction="column" py="12px" px="8px">
                <Flex align="center" justify="space-between">
                  <Text
                    color={!rawInputAmount ? colors.offWhite : colors.textGray}
                    fontSize="14px"
                    letterSpacing="-1px"
                    fontWeight="normal"
                    fontFamily="Aux"
                    userSelect="none"
                  >
                    You Send
                  </Text>
                </Flex>

                <Input
                  value={rawInputAmount}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  fontFamily="Aux"
                  border="none"
                  bg="transparent"
                  outline="none"
                  mt="6px"
                  mr="-150px"
                  ml="-5px"
                  p="0px"
                  letterSpacing="-6px"
                  color={colors.offWhite}
                  _active={{ border: "none", boxShadow: "none", outline: "none" }}
                  _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                  _selected={{
                    border: "none",
                    boxShadow: "none",
                    outline: "none",
                  }}
                  fontSize="46px"
                  placeholder="0.0"
                  _placeholder={{
                    color: inputStyle?.light_text_color || "#4A90E2",
                  }}
                />

                <Text
                  color={!rawInputAmount ? colors.offWhite : colors.textGray}
                  fontSize="14px"
                  mt="6px"
                  ml="1px"
                  letterSpacing="-1px"
                  fontWeight="normal"
                  fontFamily="Aux"
                >
                  {inputUsdValue}
                </Text>
              </Flex>

              <Spacer />
              <Flex
                mr="8px"
                py="12px"
                direction="column"
                align="flex-end"
                justify="center"
                h="100%"
              >
                <Flex direction="row" justify="flex-end" h="21px" align="center">
                  {currentInputBalance && (
                    <Button
                      onClick={handleMaxClick}
                      size="xs"
                      h="21px"
                      px="10px"
                      bg={colors.swapBgColor}
                      color={colors.offWhite}
                      fontSize="12px"
                      fontWeight="bold"
                      fontFamily="Aux"
                      letterSpacing="-0.5px"
                      border="1px solid"
                      borderColor={colors.swapBorderColor}
                      borderRadius="6px"
                      cursor="pointer"
                      transition="all 0.2s"
                      _hover={{
                        bg: colors.swapBorderColor,
                      }}
                      _active={{
                        transform: "scale(0.95)",
                      }}
                    >
                      MAX
                    </Button>
                  )}
                </Flex>
                {/* <Spacer /> */}
                <Flex align="center" justify="center" direction="column" mt="6px">
                  <WebAssetTag
                    cursor={inputAssetIdentifier !== "BTC" ? "pointer" : "default"}
                    asset={inputAssetIdentifier}
                    onDropDown={inputAssetIdentifier !== "BTC" ? openAssetSelector : undefined}
                  />
                </Flex>
                <Spacer />
                <Flex direction="row" justify="flex-end">
                  {currentInputBalance && currentInputTicker && (
                    <Text
                      mt="6px"
                      color={colors.textGray}
                      fontSize="14px"
                      letterSpacing="-1px"
                      fontWeight="normal"
                      fontFamily="Aux"
                      userSelect="none"
                    >
                      {currentInputBalance} {currentInputTicker}
                    </Text>
                  )}
                </Flex>
              </Flex>
            </Flex>

            {/* Swap Arrow */}
            <Flex
              zIndex="overlay"
              w="36px"
              h="36px"
              borderRadius="20%"
              alignSelf="center"
              align="center"
              justify="center"
              cursor="pointer"
              _hover={{ bg: "#333" }}
              onClick={handleSwapReverse}
              bg="#161616"
              border="2px solid #323232"
              mt="-16px"
              mb="-20px"
              position="relative"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22px"
                height="22px"
                viewBox="0 0 20 20"
              >
                <path
                  fill="#909090"
                  fillRule="evenodd"
                  d="M2.24 6.8a.75.75 0 0 0 1.06-.04l1.95-2.1v8.59a.75.75 0 0 0 1.5 0V4.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0L2.2 5.74a.75.75 0 0 0 .04 1.06m8 6.4a.75.75 0 0 0-.04 1.06l3.25 3.5a.75.75 0 0 0 1.1 0l3.25-3.5a.75.75 0 1 0-1.1-1.02l-1.95 2.1V6.75a.75.75 0 0 0-1.5 0v8.59l-1.95-2.1a.75.75 0 0 0-1.06-.04"
                  clipRule="evenodd"
                />
              </svg>
            </Flex>

            {/* Output Asset Section */}
            <Flex
              mt="5px"
              px="10px"
              bg={outputStyle?.dark_bg_color || "rgba(46, 29, 14, 0.66)"}
              w="100%"
              h="121px"
              border="2px solid"
              borderColor={outputStyle?.bg_color || "#78491F"}
              borderRadius="16px"
            >
              <Flex direction="column" py="12px" px="8px">
                <Text
                  color={!outputAmount ? colors.offWhite : colors.textGray}
                  fontSize="14px"
                  letterSpacing="-1px"
                  fontWeight="normal"
                  fontFamily="Aux"
                  userSelect="none"
                >
                  You Receive
                </Text>

                <Input
                  value={outputAmount}
                  onChange={handleOutputChange}
                  onKeyDown={handleOutputKeyDown}
                  fontFamily="Aux"
                  border="none"
                  bg="transparent"
                  outline="none"
                  mt="6px"
                  mr="-150px"
                  ml="-5px"
                  p="0px"
                  letterSpacing="-6px"
                  color={colors.offWhite}
                  _active={{ border: "none", boxShadow: "none", outline: "none" }}
                  _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                  _selected={{
                    border: "none",
                    boxShadow: "none",
                    outline: "none",
                  }}
                  fontSize="46px"
                  placeholder="0.0"
                  _placeholder={{
                    color: outputStyle?.light_text_color || "#805530",
                  }}
                />

                <Text
                  color={!outputAmount ? colors.offWhite : colors.textGray}
                  fontSize="14px"
                  mt="6px"
                  ml="1px"
                  letterSpacing="-1px"
                  fontWeight="normal"
                  fontFamily="Aux"
                >
                  {outputUsdValue}
                </Text>
              </Flex>

              <Spacer />
              <Flex mr="8px">
                <WebAssetTag
                  cursor={outputAssetIdentifier !== "BTC" ? "pointer" : "default"}
                  asset={outputAssetIdentifier}
                  onDropDown={outputAssetIdentifier !== "BTC" ? openAssetSelector : undefined}
                />
              </Flex>
            </Flex>

            {/* Exchange Rate */}
            <Flex mt="12px">
              <Text
                color={colors.textGray}
                fontSize="14px"
                ml="3px"
                letterSpacing="-1.5px"
                fontWeight="normal"
                fontFamily="Aux"
              >
                {quote && quote.from.amount && quote.to.amount
                  ? `1 ${inputStyle?.symbol} = ${(parseFloat(formatLotAmount(quote.to)) / parseFloat(formatLotAmount(quote.from))).toFixed(6)} ${outputStyle?.symbol}`
                  : `1 ${inputStyle?.symbol} = 1 ${outputStyle?.symbol}`}
              </Text>
              <Spacer />
              <Flex
                color={colors.textGray}
                fontSize="13px"
                mr="3px"
                letterSpacing="-1.5px"
                fontWeight="normal"
                fontFamily="Aux"
              >
                <ChakraTooltip.Root>
                  <ChakraTooltip.Trigger asChild>
                    <Flex pr="3px" mt="-2px" cursor="pointer" userSelect="none">
                      <Text
                        color={colors.textGray}
                        fontSize="14px"
                        mr="8px"
                        mt="1px"
                        letterSpacing="-1.5px"
                        fontWeight="normal"
                        fontFamily="Aux"
                      >
                        Includes Fees
                      </Text>
                      <Flex mt="0px" mr="2px">
                        <InfoSVG width="14px" />
                      </Flex>
                    </Flex>
                  </ChakraTooltip.Trigger>
                  <Portal>
                    <ChakraTooltip.Positioner>
                      <ChakraTooltip.Content
                        fontFamily="Aux"
                        letterSpacing="-0.5px"
                        color={colors.offWhite}
                        bg="#121212"
                        fontSize="12px"
                      >
                        Exchange rate includes protocol fees. No additional fees.
                      </ChakraTooltip.Content>
                    </ChakraTooltip.Positioner>
                  </Portal>
                </ChakraTooltip.Root>
              </Flex>
            </Flex>

            {/* Recipient Address - Animated (appears second) */}
            {isSwappingForBTC && (
              <Flex
                direction="column"
                w="100%"
                mb="5px"
                opacity={hasStartedTyping ? 1 : 0}
                transform={hasStartedTyping ? "translateY(0px)" : "translateY(-20px)"}
                transition="all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                transitionDelay={hasStartedTyping ? "0.2s" : "0s"}
                pointerEvents={hasStartedTyping ? "auto" : "none"}
                overflow="hidden"
                maxHeight={hasStartedTyping ? "200px" : "0px"}
              >
                {/* Payout Recipient Address */}
                <Flex ml="8px" alignItems="center" mt="18px" w="100%" mb="10px">
                  <Text fontSize="15px" fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                    Bitcoin Recipient Address
                  </Text>
                  <ChakraTooltip.Root>
                    <ChakraTooltip.Trigger asChild>
                      <Flex pl="5px" mt="-2px" cursor="pointer" userSelect="none">
                        <Flex mt="0px" mr="2px">
                          <InfoSVG width="12px" />
                        </Flex>
                      </Flex>
                    </ChakraTooltip.Trigger>
                    <Portal>
                      <ChakraTooltip.Positioner>
                        <ChakraTooltip.Content
                          fontFamily="Aux"
                          letterSpacing="-0.5px"
                          color={colors.offWhite}
                          bg="#121212"
                          fontSize="12px"
                        >
                          Only P2WPKH, P2PKH, or P2SH Bitcoin addresses are supported.
                        </ChakraTooltip.Content>
                      </ChakraTooltip.Positioner>
                    </Portal>
                  </ChakraTooltip.Root>
                </Flex>
                <Flex
                  mt="-4px"
                  mb="10px"
                  px="10px"
                  bg={outputStyle?.dark_bg_color || "rgba(46, 29, 14, 0.66)"}
                  border={`2px solid ${outputStyle?.bg_color || "#78491F"}`}
                  w="100%"
                  h="60px"
                  borderRadius="16px"
                >
                  <Flex direction="row" py="6px" px="8px">
                    <Input
                      value={payoutAddress}
                      onChange={(e) => setPayoutAddress(e.target.value)}
                      fontFamily="Aux"
                      border="none"
                      bg="transparent"
                      outline="none"
                      mt="3.5px"
                      mr="15px"
                      ml="-4px"
                      p="0px"
                      w="500px"
                      letterSpacing="-5px"
                      color={colors.offWhite}
                      _active={{
                        border: "none",
                        boxShadow: "none",
                        outline: "none",
                      }}
                      _focus={{
                        border: "none",
                        boxShadow: "none",
                        outline: "none",
                      }}
                      _selected={{
                        border: "none",
                        boxShadow: "none",
                        outline: "none",
                      }}
                      fontSize="28px"
                      placeholder="bc1q5d7rjq7g6rd2d..."
                      _placeholder={{
                        color: outputStyle?.light_text_color || "#856549",
                      }}
                      spellCheck={false}
                    />

                    {payoutAddress.length > 0 && (
                      <Flex ml="0px">
                        <BitcoinAddressValidation
                          address={payoutAddress}
                          validation={addressValidation}
                        />
                      </Flex>
                    )}
                  </Flex>
                </Flex>
              </Flex>
            )}
          </Flex>

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

        {/* Asset Selector Modal */}
        <AssetSelectorModal
          isOpen={isAssetSelectorOpen}
          onClose={closeAssetSelector}
          currentAsset={inputAssetIdentifier}
        />
      </Flex>
    </>
  );
};
