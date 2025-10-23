import {
  Flex,
  Text,
  Input,
  Spacer,
  Tooltip as ChakraTooltip,
  Portal,
  Button,
} from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { colors } from "@/utils/colors";
import { GLOBAL_CONFIG, ZERO_USD_DISPLAY } from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { InfoSVG } from "../other/SVGs";
import { FONT_FAMILIES } from "@/utils/font";
import BitcoinAddressValidation from "../other/BitcoinAddressValidation";
import { useStore } from "@/utils/store";
import { TokenData } from "@/utils/types";
import { Quote, formatLotAmount } from "@/utils/rfqClient";
import {
  getERC20ToBTCQuote,
  getERC20ToBTCQuoteExactOutput,
  getCBBTCtoBTCQuote,
  isAboveMinSwap,
  calculateUsdValue,
  validatePayoutAddress,
} from "@/utils/swapHelpers";
import { parseUnits } from "viem";

export const SwapInputAndOutput = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();

  // Local state
  const [lastEditedField, setLastEditedField] = useState<"input" | "output">("input");
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const getQuoteForInputRef = useRef(true);
  const [currentInputBalance, setCurrentInputBalance] = useState<string | null>(null);
  const [currentInputTicker, setCurrentInputTicker] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  // Refs
  const quoteRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const outputQuoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quoteRequestIdRef = useRef(0);

  // Global store
  const {
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
    setUniswapQuote,
    setRfqQuote,
    slippageBips,
    payoutAddress,
    setPayoutAddress,
    addressValidation,
    setAddressValidation,
  } = useStore();

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

  // ============================================================================
  // QUOTING FUNCTIONS
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
    async (inputAmount?: string, requestId?: number) => {
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

          // Check if this is still the latest request
          if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
            console.log("Ignoring stale quote response (cbBTC)", requestId);
            return;
          }

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

          // Check if this is still the latest request
          if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
            console.log("Ignoring stale quote response (ERC20)", requestId);
            return;
          }

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

  // Fetch quote for ERC20/ETH -> BTC (exact output mode)
  const fetchERC20ToBTCQuoteExactOutput = useCallback(
    async (outputAmountOverride?: string, requestId?: number) => {
      // Use provided amount or fall back to state
      const btcAmountToQuote = outputAmountOverride ?? outputAmount;

      if (!isSwappingForBTC || !btcAmountToQuote || parseFloat(btcAmountToQuote) <= 0) {
        return;
      }

      if (!selectedInputToken) {
        return;
      }

      // Check if the output BTC value is above minimum swap threshold
      const outputValue = parseFloat(btcAmountToQuote);

      if (btcPrice) {
        const usdValue = outputValue * btcPrice;

        if (!isAboveMinSwap(usdValue, btcPrice)) {
          console.log("Output value below minimum swap threshold");
          // Clear quotes but don't show error - just wait for larger amount
          setUniswapQuote(null);
          setRfqQuote(null);
          setRawInputAmount("");
          return;
        }
      }

      try {
        const quoteResponse = await getERC20ToBTCQuoteExactOutput(
          btcAmountToQuote,
          selectedInputToken,
          userEvmAccountAddress
            ? userEvmAccountAddress
            : "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          slippageBips
        );

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          console.log("Ignoring stale exact output quote response", requestId);
          return;
        }

        if (quoteResponse) {
          setUniswapQuote(quoteResponse.uniswapQuote || null);
          setRfqQuote(quoteResponse.rfqQuote);
          setRawInputAmount(quoteResponse.erc20InputAmount);
          setQuote(quoteResponse.rfqQuote); // Keep for compatibility
        } else {
          // Clear state on failure
          setUniswapQuote(null);
          setRfqQuote(null);
          setRawInputAmount("");
        }
      } catch (error) {
        console.error("Failed to fetch exact output quote:", error);
        setUniswapQuote(null);
        setRfqQuote(null);
        setRawInputAmount("");
      }
    },
    [
      isSwappingForBTC,
      outputAmount,
      userEvmAccountAddress,
      selectedInputToken,
      setUniswapQuote,
      setRfqQuote,
      setRawInputAmount,
      btcPrice,
      slippageBips,
    ]
  );

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

      // Set up debounced quote fetch (125ms delay)
      // Pass the value directly to avoid stale closure issues
      if (value && parseFloat(value) > 0 && isSwappingForBTC && getQuoteForInputRef.current) {
        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        quoteDebounceTimerRef.current = setTimeout(() => {
          fetchERC20ToBTCQuote(value, currentRequestId);
        }, 125);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Set flag to indicate we should quote for input field
    getQuoteForInputRef.current = true;

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

      // Clear existing quotes when user types
      setUniswapQuote(null);
      setRfqQuote(null);
      setQuote(null);

      if (!value || parseFloat(value) <= 0) {
        // Clear input if output is empty or 0
        setRawInputAmount("");
        setInputUsdValue(ZERO_USD_DISPLAY);
      }

      // Clear any existing debounce timer
      if (outputQuoteDebounceTimerRef.current) {
        clearTimeout(outputQuoteDebounceTimerRef.current);
      }

      // Set up debounced quote fetch (125ms delay)
      if (value && parseFloat(value) > 0 && !getQuoteForInputRef.current) {
        if (isSwappingForBTC) {
          // Increment request ID and capture it
          quoteRequestIdRef.current += 1;
          const currentRequestId = quoteRequestIdRef.current;

          // Fetch exact output quote for ERC20/ETH -> BTC
          outputQuoteDebounceTimerRef.current = setTimeout(() => {
            fetchERC20ToBTCQuoteExactOutput(value, currentRequestId);
          }, 125);
        } else {
          // TODO: Implement BTC -> ERC20/ETH exact output quoting logic
          console.log("Exact output quoting for BTC -> ERC20/ETH not yet implemented");
        }
      }
    }
  };

  const handleOutputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Set flag to indicate we should quote for output field
    getQuoteForInputRef.current = false;

    // If value is "0." and user presses Backspace or Delete, clear both characters
    if (outputAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setOutputAmount("");
      setOutputUsdValue(ZERO_USD_DISPLAY);
    }
  };

  const handleMaxClick = () => {
    if (!currentInputBalance) return;

    // Set flag to indicate we should quote for input field
    getQuoteForInputRef.current = true;

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

    // Clear existing quotes when max is clicked
    setUniswapQuote(null);
    setRfqQuote(null);
    setQuote(null);

    // Clear any existing debounce timer
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    // Fetch quote immediately (no debounce for MAX button)
    if (parseFloat(currentInputBalance) > 0 && isSwappingForBTC && getQuoteForInputRef.current) {
      // Increment request ID and capture it
      quoteRequestIdRef.current += 1;
      const currentRequestId = quoteRequestIdRef.current;

      // Fetch immediately
      fetchERC20ToBTCQuote(currentInputBalance, currentRequestId);
    }
  };

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
    setAddressValidation({ isValid: false });

    // Cleanup debounce timers on unmount
    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
      if (outputQuoteDebounceTimerRef.current) {
        clearTimeout(outputQuoteDebounceTimerRef.current);
      }
    };
  }, [
    setRawInputAmount,
    setOutputAmount,
    setInputUsdValue,
    setOutputUsdValue,
    setPayoutAddress,
    setAddressValidation,
  ]);

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
      const validation = validatePayoutAddress(payoutAddress, isSwappingForBTC);
      setAddressValidation(validation);
    } else {
      setAddressValidation({ isValid: false });
    }
  }, [payoutAddress, isSwappingForBTC, setAddressValidation]);

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
      quote
    ) {
      // Set up 15-second refresh interval
      // Respect which field the user is editing
      quoteRefreshIntervalRef.current = setInterval(() => {
        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        if (getQuoteForInputRef.current) {
          // User is editing input field - fetch exact input quote
          fetchERC20ToBTCQuote(undefined, currentRequestId);
        } else {
          // User is editing output field - fetch exact output quote
          fetchERC20ToBTCQuoteExactOutput(undefined, currentRequestId);
        }
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
    quote,
    fetchERC20ToBTCQuote,
    fetchERC20ToBTCQuoteExactOutput,
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Flex w="100%" direction="column">
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

      {/* Asset Selector Modal */}
      <AssetSelectorModal
        isOpen={isAssetSelectorOpen}
        onClose={closeAssetSelector}
        currentAsset={inputAssetIdentifier}
      />
    </Flex>
  );
};
