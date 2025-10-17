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
  pollCowSwapOrderStatus,
} from "@/utils/swapHelpers";
import { createCowSwapClient } from "@/utils/cowswapClient";
import { isAboveMinSwap } from "@/utils/tokenHelpers";

export const SwapWidget = () => {
  const { isValidTEE, isLoading: teeAttestationLoading } = useTDXAttestation();
  const { isMobile } = useWindowSize();
  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();
  const router = useRouter();
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
  const formatUsdValue = (value: number) =>
    value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  const [quote, setQuote] = useState<Quote | null>(null);
  const quoteRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSigningOrder, setIsSigningOrder] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
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
    cowswapOrder,
    setCowswapOrder,
    rfqQuote,
    setRfqQuote,
  } = useStore();

  // Update input USD value based on cached prices
  const updateInputUsdValue = useCallback(
    (amount: string) => {
      const parsed = parseFloat(amount);

      if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
        setInputUsdValue(ZERO_USD_DISPLAY);
        return;
      }

      let price: number | null = null;

      if (isSwappingForBTC) {
        // Input is ERC20 or ETH
        if (!selectedInputToken || selectedInputToken.ticker === "ETH") {
          price = ethPrice;
        } else if (selectedInputToken.address) {
          price = erc20Price;
        }
      } else {
        // Input is BTC
        price = btcPrice;
      }

      if (price === null) {
        setInputUsdValue(ZERO_USD_DISPLAY);
        return;
      }

      setInputUsdValue(formatUsdValue(parsed * price));
    },
    [isSwappingForBTC, selectedInputToken, ethPrice, erc20Price, btcPrice]
  );

  // Update output USD value based on cached prices
  const updateOutputUsdValue = useCallback(
    (amount: string) => {
      const parsed = parseFloat(amount);

      if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
        setOutputUsdValue(ZERO_USD_DISPLAY);
        return;
      }

      let price: number | null = null;

      if (isSwappingForBTC) {
        // Output is BTC
        price = btcPrice;
      } else {
        // Output is ERC20 or ETH
        if (!selectedInputToken || selectedInputToken.ticker === "ETH") {
          price = ethPrice;
        } else if (selectedInputToken.address) {
          price = erc20Price;
        }
      }

      if (price === null) {
        setOutputUsdValue(ZERO_USD_DISPLAY);
        return;
      }

      setOutputUsdValue(formatUsdValue(parsed * price));
    },
    [isSwappingForBTC, selectedInputToken, ethPrice, erc20Price, btcPrice]
  );

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

  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Hook for signing typed data (EIP-712)
  const {
    data: signatureData,
    signTypedData,
    isPending: isSignaturePending,
    error: signatureError,
  } = useSignTypedData();

  // Update store when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      setTransactionConfirmed(true);
    }
  }, [isConfirmed, setTransactionConfirmed]);

  // Handle writeContract errors (user declined in wallet)
  useEffect(() => {
    if (writeError) {
      console.warn("Write contract error:", writeError);
      // Custom BTC orange toast for transaction declined
      toastInfo({
        title: "Transaction Declined",
        description: "The user declined the transaction request",
        customStyle: {
          background: `linear-gradient(155deg, ${colors.currencyCard.btc.background} 0%, ${colors.assetTag.btc.background} 42%, ${colors.RiftOrange} 100%)`,
        },
      });
    }
  }, [writeError]);

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

  // Button loading state combines pending transaction and confirmation waiting
  const isButtonLoading = isPending || isConfirming;

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

  const convertInputAmountToFullDecimals = (amount?: string): bigint | undefined => {
    try {
      const inputAmount = amount || rawInputAmount;
      if (!selectedInputToken) {
        console.error("No input token selected");
        return undefined;
      }
      return parseUnits(inputAmount, selectedInputToken.decimals);
    } catch (error) {
      console.error("Error converting input amount to full decimals:", error);
      return undefined;
    }
  };

  // Styling constants
  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  useEffect(() => {
    // Reset values on mount
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
    updateInputUsdValue(rawInputAmount);
    updateOutputUsdValue(outputAmount);
  }, [
    erc20Price,
    btcPrice,
    ethPrice,
    rawInputAmount,
    outputAmount,
    isSwappingForBTC,
    updateInputUsdValue,
    updateOutputUsdValue,
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

  // Fetch quote for ERC20/ETH -> BTC (combines CowSwap + RFQ)
  const fetchERC20ToBTCQuote = useCallback(
    async (inputAmount?: string) => {
      // Use provided amount or fall back to state
      const amountToQuote = inputAmount ?? rawInputAmount;

      if (!isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        return;
      }

      if (!userEvmAccountAddress) {
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
          setCowswapOrder(null);
          setRfqQuote(null);
          setOutputAmount("");
          return;
        }
      }

      try {
        // Determine sell token
        const sellToken = selectedInputToken?.address || "ETH";

        // Convert amount to base units
        const decimals = selectedInputToken?.address ? 18 : 18; // TODO: get actual decimals
        const sellAmount = parseUnits(amountToQuote, decimals).toString();

        // Get combined quote
        const quoteResponse = await getERC20ToBTCQuote(
          sellToken,
          sellAmount,
          userEvmAccountAddress
        );

        if (quoteResponse) {
          setCowswapOrder(quoteResponse.cowswapOrder);
          setRfqQuote(quoteResponse.rfqQuote);
          setOutputAmount(quoteResponse.btcOutputAmount);
          setQuote(quoteResponse.rfqQuote); // Keep for compatibility
        } else {
          // Clear state on failure
          setCowswapOrder(null);
          setRfqQuote(null);
          setOutputAmount("");
        }
      } catch (error) {
        console.error("Failed to fetch ERC20 to BTC quote:", error);
        setCowswapOrder(null);
        setRfqQuote(null);
        setOutputAmount("");
      }
    },
    [
      isSwappingForBTC,
      rawInputAmount,
      userEvmAccountAddress,
      selectedInputToken,
      setCowswapOrder,
      setRfqQuote,
      setOutputAmount,
      ethPrice,
      erc20Price,
      btcPrice,
    ]
  );

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
      (cowswapOrder || rfqQuote)
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
    cowswapOrder,
    rfqQuote,
    fetchERC20ToBTCQuote,
  ]);

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
        writeContract({
          address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
          abi: erc20Abi,
          functionName: "transfer",
          args: [swap.deposit_address as `0x${string}`, amount],
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
      updateInputUsdValue(value);

      // Clear existing quotes when user types
      setCowswapOrder(null);
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
      setOutputUsdValue(ZERO_USD_DISPLAY);
      updateInputUsdValue("");
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
      updateOutputUsdValue(value);
    }
  };

  const handleOutputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If value is "0." and user presses Backspace or Delete, clear both characters
    if (outputAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setOutputAmount("");
      updateOutputUsdValue("");
    }
  };

  const handleMaxClick = () => {
    if (!currentInputBalance) return;

    // Set the balance as the input amount
    setRawInputAmount(currentInputBalance);
    setLastEditedField("input");
    setHasStartedTyping(true);
    updateInputUsdValue(currentInputBalance);

    const from_amount = convertInputAmountToFullDecimals(currentInputBalance);
    // if (from_amount && from_amount > 0n) {
    //   getQuote(from_amount);
    // }
  };

  // useEffect(() => {
  //   console.log("teeAttestationLoading", teeAttestationLoading);
  //   console.log("isValidTEE", isValidTEE);
  //   if (!teeAttestationLoading && !isValidTEE) {
  //     toastInfo({
  //       title: "TEE Attestation Failed",
  //     });
  //   }
  // }, [isValidTEE, teeAttestationLoading]);

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

      // For ERC20->BTC swaps, use the new CowSwap flow
      if (isSwappingForBTC && cowswapOrder && rfqQuote) {
        await handleERC20ToBTCSwap();
        return;
      }

      // For BTC->ERC20 swaps, use the existing flow
      const inputAmountInSatoshis = convertInputAmountToFullDecimals();
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

  // Handle ERC20->BTC swap using CowSwap + OTC
  const handleERC20ToBTCSwap = async () => {
    if (!cowswapOrder || !rfqQuote || !userEvmAccountAddress) {
      toastError(new Error("Missing quote data"), {
        title: "Swap Failed",
        description: "Please refresh the quote and try again",
      });
      return;
    }

    try {
      // Step 1: Create OTC swap to get deposit address
      console.log("Creating OTC swap...");
      const otcSwap = await otcClient.createSwap({
        quote: rfqQuote,
        user_destination_address: payoutAddress,
        user_evm_account_address: userEvmAccountAddress,
      });

      const depositAddress = otcSwap.deposit_address;
      console.log("OTC deposit address:", depositAddress);

      // Step 2: Fetch fresh CowSwap quote with deposit address as receiver
      setIsSigningOrder(true);
      console.log("Fetching fresh CowSwap quote with deposit address as receiver...");

      const cowswapClient = createCowSwapClient();
      const sellToken = selectedInputToken?.address || "ETH";
      const decimals = selectedInputToken?.address ? 18 : 18;
      const sellAmount = parseUnits(rawInputAmount, decimals).toString();

      const freshCowswapOrder = await cowswapClient.buildOrder(
        {
          sellToken,
          sellAmount,
          userAddress: userEvmAccountAddress,
          slippageBps: 10, // 0.1% default
          validFor: 60, // 60 seconds default
        },
        depositAddress // Set receiver to OTC deposit address
      );

      // Step 3: Sign CowSwap order with EIP-712
      console.log("Signing CowSwap order...");
      const typedData = cowswapClient.getOrderTypedData(freshCowswapOrder.order);

      // Sign the order using wagmi's signTypedData
      await new Promise<void>((resolve, reject) => {
        signTypedData(
          {
            domain: typedData.domain as any,
            types: typedData.types as any,
            primaryType: "Order",
            message: typedData.message as any,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });

      // Wait for signature
      if (!signatureData) {
        throw new Error("Failed to get signature");
      }

      setIsSigningOrder(false);
      setIsSubmittingOrder(true);

      // Step 4: Submit signed order to CowSwap
      console.log("Submitting order to CowSwap...");
      const orderUid = await cowswapClient.submitOrder(freshCowswapOrder.order, signatureData);
      console.log("Order submitted with UID:", orderUid);

      // Step 5: Poll for order status
      console.log("Polling order status...");
      const status = await pollCowSwapOrderStatus(orderUid);

      setIsSubmittingOrder(false);

      // Step 6: Show result toast
      if (status === "filled") {
        toastSuccess({
          title: "Order Filled Successfully",
          description: "Your swap is complete!",
        });
      } else {
        toastWarning({
          title: "Order Not Filled",
          description: "The order was not filled. Please submit a new order.",
        });
      }
    } catch (error) {
      console.error("ERC20->BTC swap failed:", error);
      setIsSigningOrder(false);
      setIsSubmittingOrder(false);

      toastError(error, {
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Check if all required fields are filled
  const allFieldsFilled =
    rawInputAmount &&
    outputAmount &&
    parseFloat(rawInputAmount) > 0 &&
    parseFloat(outputAmount) > 0 &&
    payoutAddress &&
    addressValidation.isValid;

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter" && allFieldsFilled && !isButtonLoading) {
        event.preventDefault();
        handleSwap();
      }
    },
    [allFieldsFilled, isButtonLoading]
  );

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
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
            <Flex mr="8px" py="12px" direction="column" align="flex-end" justify="center" h="100%">
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
            <svg xmlns="http://www.w3.org/2000/svg" width="22px" height="22px" viewBox="0 0 20 20">
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

        {/* Swap Button */}
        <Flex
          bg={colors.swapBgColor}
          _hover={{
            bg:
              !isButtonLoading && !isSigningOrder && !isSubmittingOrder
                ? colors.swapHoverColor
                : undefined,
          }}
          w="100%"
          mt="8px"
          transition="0.2s"
          h="58px"
          onClick={isButtonLoading || isSigningOrder || isSubmittingOrder ? undefined : handleSwap}
          fontSize="18px"
          align="center"
          userSelect="none"
          cursor={
            !isButtonLoading && !isSigningOrder && !isSubmittingOrder ? "pointer" : "not-allowed"
          }
          borderRadius="16px"
          justify="center"
          border="3px solid"
          borderColor={colors.swapBorderColor}
          opacity={isButtonLoading || isSigningOrder || isSubmittingOrder ? 0.7 : 1}
          pointerEvents={isButtonLoading || isSigningOrder || isSubmittingOrder ? "none" : "auto"}
        >
          {(isButtonLoading || isSigningOrder || isSubmittingOrder) && (
            <Spinner size="sm" color={colors.offWhite} mr="10px" />
          )}
          <Text color={colors.offWhite} fontFamily="Nostromo">
            {isSigningOrder
              ? "Sign Order..."
              : isSubmittingOrder
                ? "Submitting Order..."
                : isPending
                  ? "Confirm in Wallet..."
                  : isConfirming
                    ? "Confirming..."
                    : "Swap"}
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

      {/* Asset Selector Modal */}
      <AssetSelectorModal
        isOpen={isAssetSelectorOpen}
        onClose={closeAssetSelector}
        currentAsset={inputAssetIdentifier}
      />
    </Flex>
  );
};
