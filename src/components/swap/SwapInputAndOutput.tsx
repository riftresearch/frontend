import { Flex, Text, Input, Spacer, Button, Spinner } from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { colors } from "@/utils/colors";
import {
  GLOBAL_CONFIG,
  ZERO_USD_DISPLAY,
  UNIVERSAL_ROUTER_ADDRESS,
  SWAP_ROUTER02_ADDRESS,
  ETHEREUM_POPULAR_TOKENS,
  BITCOIN_DECIMALS,
} from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { InfoSVG } from "../other/SVGs";
import { Tooltip } from "@/components/other/Tooltip";
import { FONT_FAMILIES } from "@/utils/font";
import BitcoinAddressValidation from "../other/BitcoinAddressValidation";
import { useStore } from "@/utils/store";
import { TokenData, ApprovalState } from "@/utils/types";
import { Quote, formatLotAmount } from "@/utils/rfqClient";
import {
  getERC20ToBTCQuote,
  getERC20ToBTCQuoteExactOutput,
  callRFQ,
  isAboveMinSwap,
  calculateUsdValue,
  validatePayoutAddress,
  calculateExchangeRate,
  calculateFees,
  getMinSwapValueUsd,
  satsToBtc,
  MIN_SWAP_SATS,
} from "@/utils/swapHelpers";
import { formatUnits, parseUnits } from "viem";
import { useMaxLiquidity } from "@/hooks/useLiquidity";
import { saveSwapStateToCookie, loadSwapStateFromCookie } from "@/utils/swapStateCookies";

// Calculate minimum BTC amount once
const MIN_BTC = parseFloat(satsToBtc(MIN_SWAP_SATS));

export const SwapInputAndOutput = () => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();

  // Liquidity hook
  const liquidity = useMaxLiquidity();

  // Local state
  const [lastEditedField, setLastEditedField] = useState<"input" | "output">("input");
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const [showAddressTooltip, setShowAddressTooltip] = useState(false);
  const [showMaxTooltip, setShowMaxTooltip] = useState(false);
  const [isAtAdjustedMax, setIsAtAdjustedMax] = useState(false);
  const getQuoteForInputRef = useRef(true);
  const [currentInputBalance, setCurrentInputBalance] = useState<string | null>(null);
  const [currentInputTicker, setCurrentInputTicker] = useState<string | null>(null);
  const [belowMinimumSwap, setBelowMinimumSwap] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Refs
  const quoteRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const outputQuoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quoteRequestIdRef = useRef(0);
  const approvalDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);
  const hasLoadedFromCookieRef = useRef(false);

  // Global store
  const {
    selectedInputToken,
    selectedOutputToken,
    userTokensByChain,
    evmConnectWalletChainId,
    rawInputAmount,
    setRawInputAmount,
    fullPrecisionInputAmount,
    setFullPrecisionInputAmount,
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
    rfqQuote,
    uniswapQuote,
    slippageBips,
    payoutAddress,
    setPayoutAddress,
    addressValidation,
    setAddressValidation,
    permitAllowance,
    setPermitAllowance,
    setApprovalState,
    setSelectedInputToken,
    setSelectedOutputToken,
    setFeeOverview,
    feeOverview,
    isOtcServerDead,
    setHasNoRoutesError,
    exceedsAvailableBTCLiquidity,
    setExceedsAvailableBTCLiquidity,
    exceedsAvailableCBBTCLiquidity,
    setExceedsAvailableCBBTCLiquidity,
    exceedsUserBalance,
    setExceedsUserBalance,
    inputBelowMinimum,
    setInputBelowMinimum,
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
  const outputAssetIdentifier = isSwappingForBTC ? "BTC" : "CBBTC";

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
      if (
        !tokenData?.address ||
        tokenData.address === "0x0000000000000000000000000000000000000000"
      ) {
        setErc20Price(null);
        return;
      }

      const chainName =
        evmConnectWalletChainId === 1 || !evmConnectWalletChainId ? "ethereum" : "base";
      try {
        console.log(`Fetching ERC20 price for ${tokenData.ticker} (${tokenData.address})`);
        const response = await fetch(
          `/api/token-price?chain=${chainName}&addresses=${tokenData.address}`
        );
        if (response.ok) {
          const data = await response.json();
          const key = `${chainName}:${tokenData.address.toLowerCase()}`;
          const coin = data?.coins?.[key];
          if (coin && typeof coin.price === "number") {
            console.log(`ERC20 price for ${tokenData.ticker}: $${coin.price}`);
            setErc20Price(coin.price);
          } else {
            console.warn(`No price data found for ${tokenData.ticker} at key ${key}`);
          }
        } else {
          console.error(`Failed to fetch price for ${tokenData.ticker}: ${response.status}`);
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
        console.log("no selected input token");
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
          setIsLoadingQuote(false);
          return;
        }

        // Check if input value exceeds maximum BTC liquidity
        if (
          parseFloat(liquidity.maxBTCLiquidityInUsd) > 0 &&
          usdValue > parseFloat(liquidity.maxBTCLiquidityInUsd)
        ) {
          console.log("Input value exceeds maximum BTC liquidity");
          setUniswapQuote(null);
          setRfqQuote(null);
          setOutputAmount("");
          setIsLoadingQuote(false);
          return;
        }
      } else {
        setIsLoadingQuote(false);
        return;
      }

      try {
        // Clear any previous "no routes" error
        setHasNoRoutesError(false);

        // Convert amount to base units
        const decimals = selectedInputToken.decimals;
        const sellAmount = parseUnits(amountToQuote, decimals).toString();
        const sellToken = selectedInputToken?.address || "ETH";

        // Get combined quote (handles cbBTC internally)
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
          console.log("Ignoring stale quote response", requestId);
          return;
        }

        if (quoteResponse) {
          setUniswapQuote(quoteResponse.uniswapQuote || null);
          setRfqQuote(quoteResponse.rfqQuote);
          setOutputAmount(quoteResponse.btcOutputAmount || "");
          setIsLoadingQuote(false);

          // Calculate and set fee overview
          if (btcPrice && erc20Price) {
            const fees = calculateFees(
              quoteResponse.rfqQuote.fee_schedule.network_fee_sats,
              quoteResponse.rfqQuote.fee_schedule.protocol_fee_sats,
              quoteResponse.uniswapQuote?.amountOut || "0",
              quoteResponse.uniswapQuote?.amountIn || "0",
              erc20Price,
              btcPrice,
              selectedInputToken.decimals
            );
            setFeeOverview(fees);
          }
        } else {
          // Clear state on failure
          setUniswapQuote(null);
          setRfqQuote(null);
          setOutputAmount("");
          setFeeOverview(null);
          setIsLoadingQuote(false);
        }
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        setUniswapQuote(null);
        setRfqQuote(null);
        setOutputAmount("");
        setFeeOverview(null);
        setIsLoadingQuote(false);
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
      setFeeOverview,
      liquidity,
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
          setIsLoadingQuote(false);
          return;
        }

        // Check if output value exceeds maximum BTC liquidity
        // Check if input value exceeds maximum BTC liquidity
        if (
          parseFloat(liquidity.maxBTCLiquidityInUsd) > 0 &&
          usdValue > parseFloat(liquidity.maxBTCLiquidityInUsd)
        ) {
          console.log("Output value exceeds maximum BTC liquidity");
          setUniswapQuote(null);
          setRfqQuote(null);
          setRawInputAmount("");
          setIsLoadingQuote(false);
          return;
        }
      } else {
        setIsLoadingQuote(false);
        return;
      }

      try {
        // Clear any previous "no routes" error
        setHasNoRoutesError(false);

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

          // Truncate input amount to 8 decimals for display
          const inputAmount = quoteResponse.erc20InputAmount || "";
          const truncatedInput = (() => {
            const parts = inputAmount.split(".");
            if (parts.length === 2 && parts[1].length > 8) {
              return `${parts[0]}.${parts[1].substring(0, 8)}`;
            }
            return inputAmount;
          })();

          setRawInputAmount(truncatedInput);
          setIsLoadingQuote(false);

          // Calculate and set fee overview
          if (btcPrice && erc20Price) {
            const fees = calculateFees(
              quoteResponse.rfqQuote.fee_schedule.network_fee_sats,
              quoteResponse.rfqQuote.fee_schedule.protocol_fee_sats,
              quoteResponse.uniswapQuote?.amountOut || "0",
              quoteResponse.uniswapQuote?.amountIn || "0",
              erc20Price,
              btcPrice,
              selectedInputToken.decimals
            );
            setFeeOverview(fees);
          }
        } else {
          // Clear state on failure
          setUniswapQuote(null);
          setRfqQuote(null);
          setRawInputAmount("");
          setFeeOverview(null);
          setIsLoadingQuote(false);
        }
      } catch (error) {
        console.error("Failed to fetch exact output quote:", error);
        setUniswapQuote(null);
        setRfqQuote(null);
        setRawInputAmount("");
        setFeeOverview(null);
        setIsLoadingQuote(false);
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
      erc20Price,
      setFeeOverview,
      liquidity,
    ]
  );

  // Fetch quote for BTC -> ERC20/ETH
  const fetchBTCtoERC20Quote = useCallback(
    async (
      amount?: string,
      mode: "ExactInput" | "ExactOutput" = "ExactInput",
      requestId?: number
    ) => {
      // Use provided amount or fall back to state based on mode
      const amountToQuote = amount ?? (mode === "ExactInput" ? rawInputAmount : outputAmount);

      // Validate inputs
      if (isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        return;
      }

      if (!selectedInputToken) {
        return;
      }

      // Calculate USD value for min swap and max liquidity checks
      const amountValue = parseFloat(amountToQuote);
      let usdValue = 0;

      if (mode === "ExactInput") {
        // Input is BTC
        if (btcPrice) {
          usdValue = amountValue * btcPrice;
        }
      } else {
        // Output is ERC20
        if (selectedOutputToken?.ticker === "cbBTC" && btcPrice) {
          usdValue = amountValue * btcPrice;
        } else if (erc20Price) {
          usdValue = amountValue * erc20Price;
        }
      }

      // console.log("usdValue", usdValue);
      // console.log("btcPrice", btcPrice);
      // console.log("isAboveMinSwap", isAboveMinSwap(usdValue, btcPrice || 0));
      // console.log("liquidity", liquidity);
      // Check minimum swap threshold

      if (!btcPrice) {
        setIsLoadingQuote(false);
        return;
      }

      if (!isAboveMinSwap(usdValue, btcPrice)) {
        console.log("Value below minimum swap threshold");
        setUniswapQuote(null);
        setRfqQuote(null);
        setIsLoadingQuote(false);
        if (mode === "ExactInput") {
          setOutputAmount("");
        } else {
          setRawInputAmount("");
        }
        return;
      }

      // Check maximum liquidity
      if (
        parseFloat(liquidity.maxCbBTCLiquidityInUsd) > 0 &&
        usdValue > parseFloat(liquidity.maxCbBTCLiquidityInUsd)
      ) {
        console.log("Value exceeds maximum cbBTC liquidity");
        setUniswapQuote(null);
        setRfqQuote(null);
        setIsLoadingQuote(false);
        if (mode === "ExactInput") {
          setOutputAmount("");
        } else {
          setRawInputAmount("");
        }
        return;
      }

      try {
        // Convert amount to base units (satoshis for BTC)
        const decimals =
          mode === "ExactInput"
            ? BITCOIN_DECIMALS
            : selectedOutputToken?.decimals || BITCOIN_DECIMALS;
        const quoteAmount = parseUnits(amountToQuote, decimals).toString();

        // Call RFQ with the provided params
        const rfqQuoteResponse = await callRFQ(quoteAmount, mode, false);

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          console.log(`Ignoring stale BTC->ERC20 quote response (${mode})`, requestId);
          return;
        }

        if (rfqQuoteResponse) {
          // Clear Uniswap quote (not needed for BTC -> cbBTC)
          setUniswapQuote(null);
          setRfqQuote(rfqQuoteResponse);
          setIsLoadingQuote(false);

          if (mode === "ExactInput") {
            // Set output amount (ERC20/ETH) - truncate to 8 decimals
            const outputAmount = formatLotAmount(rfqQuoteResponse.to);
            const truncatedOutput = (() => {
              const parts = outputAmount.split(".");
              if (parts.length === 2 && parts[1].length > 8) {
                return `${parts[0]}.${parts[1].substring(0, 8)}`;
              }
              return outputAmount;
            })();
            setOutputAmount(truncatedOutput);
          } else {
            // Set input amount (BTC) - truncate to 8 decimals
            console.log("rfqQuoteResponse.from", rfqQuoteResponse);
            const inputAmount = formatLotAmount(rfqQuoteResponse.from);
            const truncatedInput = (() => {
              const parts = inputAmount.split(".");
              if (parts.length === 2 && parts[1].length > 8) {
                return `${parts[0]}.${parts[1].substring(0, 8)}`;
              }
              return inputAmount;
            })();
            setRawInputAmount(truncatedInput);
          }

          // Calculate and set fee overview (erc20Fee will be $0.00)
          if (btcPrice && erc20Price) {
            const fees = calculateFees(
              rfqQuoteResponse.fee_schedule.network_fee_sats,
              rfqQuoteResponse.fee_schedule.protocol_fee_sats,
              "0",
              "0",
              erc20Price,
              btcPrice,
              selectedOutputToken?.decimals || BITCOIN_DECIMALS
            );
            setFeeOverview(fees);
          }
        } else {
          // Clear state on failure
          setUniswapQuote(null);
          setRfqQuote(null);
          setFeeOverview(null);
          setIsLoadingQuote(false);
          if (mode === "ExactInput") {
            setOutputAmount("");
          } else {
            setRawInputAmount("");
          }
        }
      } catch (error) {
        console.error(`Failed to fetch BTC->ERC20 quote (${mode}):`, error);
        setUniswapQuote(null);
        setRfqQuote(null);
        setFeeOverview(null);
        setIsLoadingQuote(false);
        if (mode === "ExactInput") {
          setOutputAmount("");
        } else {
          setRawInputAmount("");
        }
      }
    },
    [
      isSwappingForBTC,
      rawInputAmount,
      outputAmount,
      selectedInputToken,
      setUniswapQuote,
      setRfqQuote,
      setOutputAmount,
      setRawInputAmount,
      btcPrice,
      erc20Price,
      setFeeOverview,
      liquidity,
      selectedOutputToken?.decimals,
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
    const newIsSwappingForBTC = !isSwappingForBTC;
    setIsSwappingForBTC(newIsSwappingForBTC);

    // Set selectedOutputToken based on new swap direction
    if (newIsSwappingForBTC) {
      // Swapping TO BTC
      setSelectedOutputToken(null);
    } else {
      // Swapping TO ERC20 (cbBTC hardcoded for now)
      const cbBTC = ETHEREUM_POPULAR_TOKENS.find((token) => token.ticker === "cbBTC");
      setSelectedOutputToken(cbBTC || null);
    }

    // Zero out amounts and USD values
    setRawInputAmount("");
    setOutputAmount("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);

    setPayoutAddress("");
    setAddressValidation({ isValid: false });
    setHasStartedTyping(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // If first character is "0" or ".", replace with "0."
    if (rawInputAmount === "" && (value === "0" || value === ".")) {
      value = "0.";
    }

    // Allow empty string, numbers, and decimal point (max 8 decimals)
    if (value === "" || /^\d*\.?\d{0,8}$/.test(value)) {
      setRawInputAmount(value);
      setLastEditedField("input");
      setHasStartedTyping(true);
      // Reset adjusted max flag and full precision when user manually edits
      setIsAtAdjustedMax(false);
      setFullPrecisionInputAmount(null);

      // Update USD value using helper
      const inputTicker = isSwappingForBTC ? selectedInputToken?.ticker || "" : "BTC";
      console.log(
        `Calculating USD for input: amount=${value}, ticker=${inputTicker}, ethPrice=${ethPrice}, btcPrice=${btcPrice}, erc20Price=${erc20Price}`
      );
      const usdValue = calculateUsdValue(value, inputTicker, ethPrice, btcPrice, erc20Price);
      console.log(`Calculated USD value: ${usdValue}`);
      setInputUsdValue(usdValue);

      // Clear existing quotes when user types
      setUniswapQuote(null);
      setRfqQuote(null);

      if (!value || parseFloat(value) <= 0) {
        // Clear output if input is empty or 0
        setOutputAmount("");
        setOutputUsdValue(ZERO_USD_DISPLAY);
        setIsLoadingQuote(false);
      }

      // Clear any existing debounce timer
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }

      // Set up debounced quote fetch (125ms delay)
      // Pass the value directly to avoid stale closure issues
      if (value && parseFloat(value) > 0 && getQuoteForInputRef.current) {
        // Show loading state
        setIsLoadingQuote(true);

        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        // Use full precision if available, otherwise use displayed value
        const amountToQuote = fullPrecisionInputAmount || value;

        if (isSwappingForBTC) {
          // Fetch exact input quote for ERC20/ETH -> BTC
          quoteDebounceTimerRef.current = setTimeout(() => {
            fetchERC20ToBTCQuote(amountToQuote, currentRequestId);
          }, 125);
        } else {
          // Fetch exact input quote for BTC -> ERC20/ETH
          quoteDebounceTimerRef.current = setTimeout(() => {
            fetchBTCtoERC20Quote(amountToQuote, "ExactInput", currentRequestId);
          }, 125);
        }
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

    // Allow empty string, numbers, and decimal point (max 8 decimals)
    if (value === "" || /^\d*\.?\d{0,8}$/.test(value)) {
      setOutputAmount(value);
      setLastEditedField("output");
      setHasStartedTyping(true);

      // Update USD value using helper
      const outputTicker = isSwappingForBTC ? "BTC" : selectedOutputToken?.ticker || "ETH";
      const usdValue = calculateUsdValue(value, outputTicker, ethPrice, btcPrice, erc20Price);
      setOutputUsdValue(usdValue);

      // Clear existing quotes when user types
      setUniswapQuote(null);
      setRfqQuote(null);

      if (!value || parseFloat(value) <= 0) {
        // Clear input if output is empty or 0
        setRawInputAmount("");
        setInputUsdValue(ZERO_USD_DISPLAY);
        setIsLoadingQuote(false);
      }

      // Clear any existing debounce timer
      if (outputQuoteDebounceTimerRef.current) {
        clearTimeout(outputQuoteDebounceTimerRef.current);
      }

      // Set up debounced quote fetch (75ms delay)
      if (value && parseFloat(value) > 0 && !getQuoteForInputRef.current) {
        // Check if output is below minimum (3000 sats = 0.00003 BTC)
        const outputFloat = parseFloat(value);

        if (outputFloat < MIN_BTC) {
          // Don't fetch quote if below minimum
          setRawInputAmount("");
          setInputUsdValue(ZERO_USD_DISPLAY);
          setIsLoadingQuote(false);
          return;
        }

        // Show loading state
        setIsLoadingQuote(true);

        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        if (isSwappingForBTC) {
          // Fetch exact output quote for ERC20/ETH -> BTC
          outputQuoteDebounceTimerRef.current = setTimeout(() => {
            fetchERC20ToBTCQuoteExactOutput(value, currentRequestId);
          }, 75);
        } else {
          // Fetch exact output quote for BTC -> ERC20/ETH
          outputQuoteDebounceTimerRef.current = setTimeout(() => {
            fetchBTCtoERC20Quote(value, "ExactOutput", currentRequestId);
          }, 75);
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

  const handleMaxClick = async () => {
    if (!currentInputBalance) return;

    // Set flag to indicate we should quote for input field
    getQuoteForInputRef.current = true;
    console.log("currentInputBalance", currentInputBalance);

    // Clear ALL error flags
    setExceedsUserBalance(false);
    setExceedsAvailableBTCLiquidity(false);
    setExceedsAvailableCBBTCLiquidity(false);
    setInputBelowMinimum(false);
    setBelowMinimumSwap(false);

    let adjustedInputAmount = currentInputBalance;

    // If ETH is selected, fetch gas data and adjust for gas costs
    if (selectedInputToken?.ticker === "ETH") {
      try {
        const response = await fetch(`/api/eth-gas?chainId=${evmConnectWalletChainId || 1}`);
        if (response.ok) {
          const data = await response.json();
          const maxFeePerGasHex = data.maxFeePerGas;

          // Parse hex to BigInt
          const maxFeePerGas = BigInt(maxFeePerGasHex);

          // Calculate gas cost: maxFeePerGas * 400000 (gas units)
          const gasCostWei = maxFeePerGas * BigInt(400000);

          // Convert wei to ETH
          const gasCostEth = formatUnits(gasCostWei, 18);

          // Calculate adjusted amount: balance - gas cost
          const balanceFloat = parseFloat(currentInputBalance);
          const gasCostFloat = parseFloat(gasCostEth);
          const adjustedAmount = balanceFloat - gasCostFloat;

          // Ensure we don't go negative
          if (adjustedAmount > 0) {
            adjustedInputAmount = adjustedAmount.toString();
            setIsAtAdjustedMax(true);
          } else {
            adjustedInputAmount = currentInputBalance;
            setIsAtAdjustedMax(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch gas data:", error);
        // Fall back to using full balance if gas fetch fails
        setIsAtAdjustedMax(false);
      }
    } else {
      setIsAtAdjustedMax(false);
    }

    // Limit to 8 decimal places for display
    const truncatedAmount = (() => {
      const parts = adjustedInputAmount.split(".");
      if (parts.length === 2 && parts[1].length > 8) {
        return `${parts[0]}.${parts[1].substring(0, 8)}`;
      }
      return adjustedInputAmount;
    })();

    // Store full precision for quoting and swap execution
    setFullPrecisionInputAmount(adjustedInputAmount);

    // Set the truncated balance as the displayed input amount
    setRawInputAmount(truncatedAmount);
    setLastEditedField("input");
    setHasStartedTyping(true);

    // Update USD value using full precision
    const inputTicker = isSwappingForBTC ? selectedInputToken?.ticker || "ETH" : "BTC";
    const usdValue = calculateUsdValue(
      adjustedInputAmount,
      inputTicker,
      ethPrice,
      btcPrice,
      erc20Price
    );
    setInputUsdValue(usdValue);

    // Clear existing quotes when max is clicked
    setUniswapQuote(null);
    setRfqQuote(null);

    // Set loading state
    setIsLoadingQuote(true);

    // Clear any existing debounce timer
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    // Fetch quote immediately (no debounce for MAX button)
    if (parseFloat(adjustedInputAmount) > 0 && getQuoteForInputRef.current) {
      // Increment request ID and capture it
      quoteRequestIdRef.current += 1;
      const currentRequestId = quoteRequestIdRef.current;

      if (isSwappingForBTC) {
        // Fetch exact input quote for ERC20/ETH -> BTC using full precision
        fetchERC20ToBTCQuote(adjustedInputAmount, currentRequestId);
      } else {
        // there is no max button for BTC -> ERC20/ETH
        // Fetch exact input quote for BTC -> ERC20/ETH
        // fetchBTCtoERC20Quote(adjustedInputAmount, "ExactInput", currentRequestId);
      }
    }
  };

  const handleOutputMaxClick = () => {
    // Set flag to indicate we should quote for output field
    getQuoteForInputRef.current = false;

    // Clear ALL error flags (both output AND input related since they can cascade)
    setExceedsAvailableBTCLiquidity(false);
    setExceedsAvailableCBBTCLiquidity(false);
    setBelowMinimumSwap(false);
    setExceedsUserBalance(false);
    setInputBelowMinimum(false);

    // Determine the max liquidity based on swap direction
    let maxLiquidityBtc: number;
    if (isSwappingForBTC) {
      // ERC20 -> BTC: Use maxBTCLiquidity
      const maxBtcLiquiditySats = liquidity.maxBTCLiquidity;
      maxLiquidityBtc = Number(maxBtcLiquiditySats) / 100_000_000; // Convert satoshis to BTC
    } else {
      // BTC -> ERC20 (cbBTC): Use maxCbBTCLiquidity
      const maxCbBtcLiquiditySats = liquidity.maxCbBTCLiquidity;
      maxLiquidityBtc = Number(maxCbBtcLiquiditySats) / 100_000_000; // Convert satoshis to BTC
    }

    const maxOutputAmount = maxLiquidityBtc.toString();

    // Limit to 8 decimal places for display
    const truncatedOutputAmount = (() => {
      const parts = maxOutputAmount.split(".");
      if (parts.length === 2 && parts[1].length > 8) {
        return `${parts[0]}.${parts[1].substring(0, 8)}`;
      }
      return maxOutputAmount;
    })();

    // Set the truncated max liquidity as the output amount
    setOutputAmount(truncatedOutputAmount);
    setLastEditedField("output");
    setHasStartedTyping(true);

    // Update USD value using helper
    const outputTicker = isSwappingForBTC ? "BTC" : selectedOutputToken?.ticker || "cbBTC";
    const usdValue = calculateUsdValue(
      truncatedOutputAmount,
      outputTicker,
      ethPrice,
      btcPrice,
      erc20Price
    );
    setOutputUsdValue(usdValue);

    // Clear existing quotes when max is clicked
    setUniswapQuote(null);
    setRfqQuote(null);

    // Set loading state
    setIsLoadingQuote(true);

    // Clear any existing debounce timer
    if (outputQuoteDebounceTimerRef.current) {
      clearTimeout(outputQuoteDebounceTimerRef.current);
    }

    // Fetch quote immediately (no debounce for MAX button)
    if (parseFloat(truncatedOutputAmount) > 0) {
      // Increment request ID and capture it
      quoteRequestIdRef.current += 1;
      const currentRequestId = quoteRequestIdRef.current;

      if (isSwappingForBTC) {
        // Fetch exact output quote for ERC20/ETH -> BTC
        fetchERC20ToBTCQuoteExactOutput(truncatedOutputAmount, currentRequestId);
      } else {
        // Fetch exact output quote for BTC -> ERC20/ETH
        fetchBTCtoERC20Quote(truncatedOutputAmount, "ExactOutput", currentRequestId);
      }
    }
  };

  const handleInputLiquidityMaxClick = () => {
    // Set flag to indicate we should quote for input field
    getQuoteForInputRef.current = true;

    // Clear ALL error flags
    setExceedsUserBalance(false);
    setExceedsAvailableBTCLiquidity(false);
    setExceedsAvailableCBBTCLiquidity(false);
    setInputBelowMinimum(false);
    setBelowMinimumSwap(false);

    // Get max cbBTC liquidity for BTC -> cbBTC swap
    const maxCbBtcLiquiditySats = liquidity.maxCbBTCLiquidity;
    const maxCbBtcLiquidityBtc = Number(maxCbBtcLiquiditySats) / 100_000_000;

    // Truncate to 8 decimals for display
    const maxInputAmount = maxCbBtcLiquidityBtc.toString();
    const truncatedAmount = (() => {
      const parts = maxInputAmount.split(".");
      if (parts.length === 2 && parts[1].length > 8) {
        return `${parts[0]}.${parts[1].substring(0, 8)}`;
      }
      return maxInputAmount;
    })();

    // Set the max liquidity as the input amount (no full precision needed here)
    setRawInputAmount(truncatedAmount);
    setFullPrecisionInputAmount(null);
    setLastEditedField("input");
    setHasStartedTyping(true);

    // Update USD value
    const inputTicker = "BTC";
    const usdValue = calculateUsdValue(
      truncatedAmount,
      inputTicker,
      ethPrice,
      btcPrice,
      erc20Price
    );
    setInputUsdValue(usdValue);

    // Clear existing quotes
    setUniswapQuote(null);
    setRfqQuote(null);

    // Set loading state
    setIsLoadingQuote(true);

    // Clear any existing debounce timer
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    // Fetch quote immediately (no debounce for MAX button)
    if (parseFloat(truncatedAmount) > 0) {
      // Increment request ID and capture it
      quoteRequestIdRef.current += 1;
      const currentRequestId = quoteRequestIdRef.current;

      // Fetch exact input quote for BTC -> cbBTC
      fetchBTCtoERC20Quote(truncatedAmount, "ExactInput", currentRequestId);
    }
  };

  const handleMinimumClick = () => {
    // Set flag to indicate we should quote for output field
    getQuoteForInputRef.current = false;

    // Clear ALL error flags
    setExceedsUserBalance(false);
    setExceedsAvailableBTCLiquidity(false);
    setExceedsAvailableCBBTCLiquidity(false);
    setInputBelowMinimum(false);
    setBelowMinimumSwap(false);

    // Set minimum output to 3000 sats (0.00003 BTC)
    const minOutputAmountStr = MIN_BTC.toString();

    // Set the minimum amount as the output amount
    setOutputAmount(minOutputAmountStr);
    setLastEditedField("output");
    setHasStartedTyping(true);

    // Update USD value
    const outputTicker = isSwappingForBTC ? "BTC" : selectedOutputToken?.ticker || "cbBTC";
    const usdValue = calculateUsdValue(
      minOutputAmountStr,
      outputTicker,
      ethPrice,
      btcPrice,
      erc20Price
    );
    setOutputUsdValue(usdValue);

    // Clear existing quotes
    setUniswapQuote(null);
    setRfqQuote(null);

    // Set loading state
    setIsLoadingQuote(true);

    // Clear any existing debounce timer
    if (outputQuoteDebounceTimerRef.current) {
      clearTimeout(outputQuoteDebounceTimerRef.current);
    }

    // Fetch quote immediately (no debounce for MIN button)
    // Increment request ID and capture it
    quoteRequestIdRef.current += 1;
    const currentRequestId = quoteRequestIdRef.current;

    if (isSwappingForBTC) {
      // Fetch exact output quote for ERC20/ETH -> BTC
      fetchERC20ToBTCQuoteExactOutput(minOutputAmountStr, currentRequestId);
    } else {
      // Fetch exact output quote for BTC -> ERC20/ETH
      fetchBTCtoERC20Quote(minOutputAmountStr, "ExactOutput", currentRequestId);
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

    console.log("resetting values");
    // Cleanup debounce timers on unmount
    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
      if (outputQuoteDebounceTimerRef.current) {
        clearTimeout(outputQuoteDebounceTimerRef.current);
      }
      if (approvalDebounceTimerRef.current) {
        clearTimeout(approvalDebounceTimerRef.current);
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

  // Load swap state from cookies on initial mount BEFORE setting defaults
  useEffect(() => {
    if (!isInitialMountRef.current || hasLoadedFromCookieRef.current) return;

    const savedState = loadSwapStateFromCookie();
    if (savedState) {
      console.log("Loading swap state from cookie:", savedState);

      // Restore swap direction
      setIsSwappingForBTC(savedState.isSwappingForBTC);

      // Restore selected tokens
      if (savedState.selectedInputToken) {
        console.log("Setting selected input token from cookie:", savedState.selectedInputToken);
        setSelectedInputToken(savedState.selectedInputToken);
        // console log selectedInputToken
        console.log("selectedInputToken cookie", selectedInputToken);
      }

      if (savedState.selectedOutputToken) {
        setSelectedOutputToken(savedState.selectedOutputToken);
      }

      hasLoadedFromCookieRef.current = true;
    }

    isInitialMountRef.current = false;
  }, [setIsSwappingForBTC, setSelectedInputToken, setSelectedOutputToken]);

  // Set default input token if no cookie state was loaded
  useEffect(() => {
    // Only set default if:
    // 1. We've checked for cookies (isInitialMountRef is false)
    // 2. No token is currently selected
    // 3. We haven't loaded from cookie
    if (!isInitialMountRef.current && !selectedInputToken && !hasLoadedFromCookieRef.current) {
      const ETH_TOKEN = ETHEREUM_POPULAR_TOKENS[0];
      setSelectedInputToken(ETH_TOKEN);
    }
  }, [selectedInputToken, setSelectedInputToken]);

  // Initialize selectedOutputToken based on swap direction
  useEffect(() => {
    // Skip if we're still on initial mount and might load from cookie
    if (isInitialMountRef.current) return;

    if (isSwappingForBTC) {
      setSelectedOutputToken(null);
    } else {
      const cbBTC = ETHEREUM_POPULAR_TOKENS.find((token) => token.ticker === "cbBTC");
      setSelectedOutputToken(cbBTC || null);
    }
  }, [isSwappingForBTC, setSelectedOutputToken]);

  // Fetch ERC20 token price when selected token changes
  useEffect(() => {
    fetchErc20TokenPrice(selectedInputToken);
  }, [selectedInputToken, fetchErc20TokenPrice]);

  // Update USD values when prices or amounts change
  useEffect(() => {
    const inputTicker = isSwappingForBTC ? selectedInputToken?.ticker || "ETH" : "BTC";
    const inputUsd = calculateUsdValue(rawInputAmount, inputTicker, ethPrice, btcPrice, erc20Price);
    setInputUsdValue(inputUsd);

    const outputTicker = isSwappingForBTC ? "BTC" : selectedOutputToken?.ticker || "ETH";
    const outputUsd = calculateUsdValue(outputAmount, outputTicker, ethPrice, btcPrice, erc20Price);
    setOutputUsdValue(outputUsd);
  }, [
    erc20Price,
    btcPrice,
    ethPrice,
    rawInputAmount,
    outputAmount,
    isSwappingForBTC,
    selectedInputToken,
    selectedOutputToken,
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
      rfqQuote
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
    rfqQuote,
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

    console.log("fallbackList", fallbackList);
    console.log("fallbackEth", fallbackEth);
    console.log("token", token);
    if (!token) {
      setCurrentInputBalance(null);
      setCurrentInputTicker(null);
      return;
    }

    const balance = fallbackList.find((t) => t.ticker === token?.ticker)?.balance || "0";
    const amt = parseFloat(balance);

    // if (!balance || !Number.isFinite(amt) || amt <= 0) {
    //   setCurrentInputBalance(null);
    //   setCurrentInputTicker(null);
    //   return;
    // }

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

  // Fetch permit allowance when input amount changes (debounced)
  useEffect(() => {
    const fetchApproval = async () => {
      // Only fetch if:
      // 1. permitAllowance is null (not yet fetched)
      // 2. Token is ERC20 (not ETH or cbBTC)
      // 3. We have a valid input amount
      if (
        permitAllowance !== null ||
        !selectedInputToken?.address ||
        selectedInputToken.ticker === "ETH" ||
        selectedInputToken.ticker === "cbBTC" ||
        !userEvmAccountAddress ||
        !rawInputAmount ||
        parseFloat(rawInputAmount) <= 0
      ) {
        return;
      }

      try {
        const response = await fetch(
          `/api/permit-allowance?userAddress=${userEvmAccountAddress}&tokenAddress=${selectedInputToken.address}&rawInputAmount=${rawInputAmount}&decimals=${selectedInputToken.decimals}`
        );

        if (response.ok) {
          const data = await response.json();
          console.log("Permit allowance data:", data);
          setPermitAllowance(data);

          // Set approval state based on whether token has allowance to Permit2
          if (data.permit2HasAllowance) {
            setApprovalState(ApprovalState.APPROVED);
          } else {
            setApprovalState(ApprovalState.NEEDS_APPROVAL);
          }
        } else {
          console.error("Failed to fetch permit allowance");
        }
      } catch (error) {
        console.error("Error fetching permit allowance:", error);
      }
    };

    // Clear any existing debounce timer
    if (approvalDebounceTimerRef.current) {
      clearTimeout(approvalDebounceTimerRef.current);
    }

    // Set up debounced approval fetch (250ms delay)
    if (
      rawInputAmount &&
      parseFloat(rawInputAmount) > 0 &&
      selectedInputToken?.address &&
      selectedInputToken.ticker !== "cbBTC" &&
      userEvmAccountAddress &&
      permitAllowance === null
    ) {
      approvalDebounceTimerRef.current = setTimeout(() => {
        fetchApproval();
      }, 250);
    }

    return () => {
      if (approvalDebounceTimerRef.current) {
        clearTimeout(approvalDebounceTimerRef.current);
      }
    };
  }, [
    permitAllowance,
    selectedInputToken,
    userEvmAccountAddress,
    setPermitAllowance,
    setApprovalState,
    rawInputAmount,
  ]);

  // Reset permitAllowance when input token changes
  useEffect(() => {
    setPermitAllowance(null);
  }, [selectedInputToken, setPermitAllowance]);

  // Reset approval state when token or amount changes
  useEffect(() => {
    setApprovalState(ApprovalState.UNKNOWN);
  }, [selectedInputToken, setApprovalState]);

  // Check if input amount exceeds user balance
  useEffect(() => {
    if (!rawInputAmount || !currentInputBalance || parseFloat(rawInputAmount) <= 0) {
      setExceedsUserBalance(false);
      return;
    }

    const inputFloat = parseFloat(rawInputAmount);
    const balanceFloat = parseFloat(currentInputBalance);

    // Show "exceeds user balance" if:
    // 1. Input exceeds balance, AND
    // 2. User's BALANCE (in USD) < MM liquidity (in USD)
    //
    // If user's BALANCE >= MM liquidity, show "exceeds MM liquidity" instead
    // (This means the user has enough money, but MM doesn't have enough liquidity)

    if (inputFloat > balanceFloat) {
      // Check if user's BALANCE is less than MM liquidity (compare in USD)
      const mmLiquidityUsdStr = isSwappingForBTC
        ? liquidity.maxBTCLiquidityInUsd
        : liquidity.maxCbBTCLiquidityInUsd;

      const mmLiquidityUsd = parseFloat(mmLiquidityUsdStr);

      if (mmLiquidityUsd > 0) {
        // Calculate user's BALANCE in USD
        let price: number | null = null;
        if (isSwappingForBTC) {
          // ERC20 -> BTC
          if (selectedInputToken?.ticker === "ETH") {
            price = ethPrice;
          } else if (selectedInputToken?.address) {
            price = erc20Price;
          }
        } else {
          // BTC -> ERC20
          price = btcPrice;
        }

        if (price) {
          const balanceUsdValue = balanceFloat * price;

          // If user's balance USD value < MM liquidity USD, show "exceeds balance"
          // If user's balance USD value >= MM liquidity USD, don't show this error (defer to MM liquidity check)
          if (balanceUsdValue < mmLiquidityUsd) {
            setExceedsUserBalance(true);
          } else {
            setExceedsUserBalance(false);
          }
        } else {
          // No price data, default to showing balance error
          setExceedsUserBalance(true);
        }
      } else {
        // No liquidity data, default to showing balance error
        setExceedsUserBalance(true);
      }
    } else {
      setExceedsUserBalance(false);
    }
  }, [
    rawInputAmount,
    currentInputBalance,
    isSwappingForBTC,
    liquidity.maxBTCLiquidityInUsd,
    liquidity.maxCbBTCLiquidityInUsd,
    selectedInputToken,
    ethPrice,
    erc20Price,
    btcPrice,
  ]);

  // Check if input/output amount exceeds market maker liquidity
  useEffect(() => {
    // Check based on which field user is editing
    if (lastEditedField === "input") {
      // For ERC20 -> BTC: Check if input exceeds MM liquidity
      if (isSwappingForBTC) {
        const maxBtcLiquiditySats = liquidity.maxBTCLiquidity;
        if (!maxBtcLiquiditySats || maxBtcLiquiditySats === "0") {
          setExceedsAvailableBTCLiquidity(false);
          return;
        }

        // Check input (ERC20 sent) - convert to USD and compare with MM liquidity in USD
        if (rawInputAmount && parseFloat(rawInputAmount) > 0 && currentInputBalance) {
          const inputFloat = parseFloat(rawInputAmount);

          // If user has more than MM liquidity (in terms of what they can swap)
          // and they're trying to swap more than MM liquidity, show the error
          let price: number | null = null;
          if (selectedInputToken?.ticker === "ETH") {
            price = ethPrice;
          } else if (selectedInputToken?.address) {
            price = erc20Price;
          }

          if (price && btcPrice) {
            const inputUsdValue = inputFloat * price;
            const mmLiquidityUsd = parseFloat(liquidity.maxBTCLiquidityInUsd);

            if (mmLiquidityUsd > 0 && inputUsdValue > mmLiquidityUsd) {
              setExceedsAvailableBTCLiquidity(true);
              return;
            }
          }
        }

        setExceedsAvailableBTCLiquidity(false);
      } else {
        // BTC -> ERC20 (cbBTC): Check maxCbBTCLiquidity
        setExceedsAvailableBTCLiquidity(false);
      }
    } else if (lastEditedField === "output") {
      // Check output (BTC or cbBTC received)
      if (!outputAmount || parseFloat(outputAmount) <= 0) {
        setExceedsAvailableBTCLiquidity(false);
        return;
      }

      const outputFloat = parseFloat(outputAmount);
      const maxLiquiditySats = isSwappingForBTC
        ? liquidity.maxBTCLiquidity
        : liquidity.maxCbBTCLiquidity;

      if (maxLiquiditySats && maxLiquiditySats !== "0") {
        const maxLiquidityBtc = Number(maxLiquiditySats) / 100_000_000;
        const tolerance = maxLiquidityBtc * 0.001;

        if (outputFloat > maxLiquidityBtc + tolerance) {
          setExceedsAvailableBTCLiquidity(true);
          return;
        }
      }

      setExceedsAvailableBTCLiquidity(false);
    } else {
      setExceedsAvailableBTCLiquidity(false);
    }
  }, [
    rawInputAmount,
    outputAmount,
    lastEditedField,
    isSwappingForBTC,
    liquidity.maxBTCLiquidity,
    liquidity.maxCbBTCLiquidity,
    liquidity.maxBTCLiquidityInUsd,
    exceedsUserBalance,
    currentInputBalance,
    selectedInputToken,
    ethPrice,
    erc20Price,
    btcPrice,
  ]);

  // Check if input BTC amount exceeds cbBTC liquidity (BTC -> cbBTC direction)
  useEffect(() => {
    // Only check for BTC -> cbBTC direction
    if (isSwappingForBTC) {
      setExceedsAvailableCBBTCLiquidity(false);
      return;
    }

    if (!rawInputAmount || parseFloat(rawInputAmount) <= 0) {
      setExceedsAvailableCBBTCLiquidity(false);
      return;
    }

    // Skip check if user balance is already exceeded (takes priority)
    if (exceedsUserBalance) {
      setExceedsAvailableCBBTCLiquidity(false);
      return;
    }

    // Skip check if user is editing the output field (lastEditedField === "output")
    // because the input is being calculated from the output and may temporarily exceed
    if (lastEditedField === "output") {
      setExceedsAvailableCBBTCLiquidity(false);
      return;
    }

    const inputFloat = parseFloat(rawInputAmount);

    // BTC -> cbBTC: Check if input BTC exceeds maxCbBTCLiquidity
    const maxCbBtcLiquiditySats = liquidity.maxCbBTCLiquidity;
    if (maxCbBtcLiquiditySats && maxCbBtcLiquiditySats !== "0") {
      const maxCbBtcLiquidityBtc = Number(maxCbBtcLiquiditySats) / 100_000_000;
      console.log("[sameer] maxCbBtcLiquidityBtc", maxCbBtcLiquidityBtc);
      console.log("[sameer] inputFloat", inputFloat);
      if (inputFloat > maxCbBtcLiquidityBtc) {
        setExceedsAvailableCBBTCLiquidity(true);
      } else {
        setExceedsAvailableCBBTCLiquidity(false);
      }
    } else {
      setExceedsAvailableCBBTCLiquidity(false);
    }
  }, [
    rawInputAmount,
    isSwappingForBTC,
    liquidity.maxCbBTCLiquidity,
    exceedsUserBalance,
    lastEditedField,
  ]);

  // Check if output amount is below minimum swap amount (3000 sats)
  // Only show this error when user is editing the OUTPUT field
  useEffect(() => {
    // Clear error if output is empty or zero
    const outputFloat = parseFloat(outputAmount);
    if (!outputAmount || !Number.isFinite(outputFloat) || outputFloat <= 0) {
      setBelowMinimumSwap(false);
      return;
    }

    // Skip check if user balance is already exceeded (takes priority)
    if (exceedsUserBalance) {
      setBelowMinimumSwap(false);
      return;
    }

    // Only show this error when user is editing the output field
    if (lastEditedField !== "output") {
      setBelowMinimumSwap(false);
      return;
    }

    // Check if output exists and is below minimum
    if (outputFloat < MIN_BTC) {
      setBelowMinimumSwap(true);
    } else {
      setBelowMinimumSwap(false);
    }
  }, [outputAmount, exceedsUserBalance, lastEditedField]);

  // Check if input amount would result in below minimum output
  // Only show this error when user is editing the INPUT field
  useEffect(() => {
    // Clear error if input is empty or zero
    const inputFloat = parseFloat(rawInputAmount);
    if (!rawInputAmount || !Number.isFinite(inputFloat) || inputFloat <= 0) {
      setInputBelowMinimum(false);
      return;
    }

    // Skip check if user balance is already exceeded (takes priority)
    if (exceedsUserBalance) {
      setInputBelowMinimum(false);
      return;
    }

    // Only show this error when user is editing the input field
    if (lastEditedField !== "input") {
      setInputBelowMinimum(false);
      return;
    }

    // Skip check if user clicked MAX (isAtAdjustedMax flag set for ETH gas-adjusted max)
    // User is using their maximum available balance, so we shouldn't show an error
    if (isAtAdjustedMax) {
      setInputBelowMinimum(false);
      return;
    }

    // Check 1: If output exists and is below minimum (user typed in input, got small output)
    // Also verify input is still > 0 (to handle React batched state updates)
    if (inputFloat > 0 && outputAmount && parseFloat(outputAmount) > 0) {
      const outputFloat = parseFloat(outputAmount);
      if (outputFloat < MIN_BTC) {
        setInputBelowMinimum(true);
        return;
      }
    }

    // Check 2: If input exists but output is empty/zero (quote was blocked)
    if (inputFloat > 0 && (!outputAmount || parseFloat(outputAmount) <= 0)) {
      // Get the price of the input token
      let price: number | null = null;
      const inputTicker = isSwappingForBTC ? selectedInputToken?.ticker || "ETH" : "BTC";

      if (inputTicker === "ETH") {
        price = ethPrice;
      } else if (inputTicker === "BTC") {
        price = btcPrice;
      } else if (selectedInputToken?.address) {
        price = erc20Price;
      }

      // Calculate USD value and check against minimum
      if (price && btcPrice) {
        const usdValue = inputFloat * price;
        const minSwapUsd = getMinSwapValueUsd(btcPrice);

        if (usdValue < minSwapUsd && usdValue > 0) {
          setInputBelowMinimum(true);
          return;
        }
      }
    }

    // If condition is not met, clear the flag
    setInputBelowMinimum(false);
  }, [
    outputAmount,
    rawInputAmount,
    exceedsUserBalance,
    isSwappingForBTC,
    selectedInputToken,
    ethPrice,
    btcPrice,
    erc20Price,
    lastEditedField,
    isAtAdjustedMax,
  ]);

  // Save swap state to cookies whenever direction or tokens change
  useEffect(() => {
    // Skip saving during initial mount while we're loading from cookie
    if (isInitialMountRef.current) return;

    // Save current state to cookie
    saveSwapStateToCookie({
      isSwappingForBTC,
      selectedInputToken,
      selectedOutputToken,
    });
  }, [isSwappingForBTC, selectedInputToken, selectedOutputToken]);

  // ============================================================================
  // RENDER
  // ============================================================================
  console.log("[sameer] exceedsAvailableBTCLiquidity", exceedsAvailableBTCLiquidity);
  console.log("[sameer] exceedsAvailableCBBTCLiquidity", exceedsAvailableCBBTCLiquidity);
  console.log("[sameer] exceedsUserBalance", exceedsUserBalance);
  // console.log("[sameer] inputBelowMinimum", inputBelowMinimum);
  // console.log("[sameer] belowMinimumSwap", belowMinimumSwap);
  // console.log("[sameer] isLoadingQuote", isLoadingQuote);
  // console.log("[sameer] getQuoteForInputRef.current", getQuoteForInputRef.current);
  // console.log("[sameer] rawInputAmount", rawInputAmount);

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

            {isLoadingQuote && !getQuoteForInputRef.current ? (
              <Flex align="center" mt="6px" ml="-5px">
                <Spinner size="lg" color={inputStyle?.border_color_light || colors.textGray} />
              </Flex>
            ) : (
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
                color={
                  exceedsUserBalance ||
                  (exceedsAvailableBTCLiquidity && lastEditedField === "input") ||
                  exceedsAvailableCBBTCLiquidity ||
                  inputBelowMinimum
                    ? colors.red
                    : colors.offWhite
                }
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
                disabled={isOtcServerDead}
                cursor={isOtcServerDead ? "not-allowed" : "text"}
                opacity={isOtcServerDead ? 0.5 : 1}
              />
            )}

            <Flex>
              {exceedsAvailableBTCLiquidity && isSwappingForBTC && lastEditedField === "input" ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    ml="1px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    Exceeds available liquidity -
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml="8px"
                    color={inputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleOutputMaxClick}
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {(() => {
                      const maxBtcLiquiditySats = liquidity.maxBTCLiquidity;
                      const maxBtcLiquidityBtc = Number(maxBtcLiquiditySats) / 100_000_000;
                      return `${maxBtcLiquidityBtc.toFixed(4)} BTC Max`;
                    })()}
                  </Text>
                </>
              ) : exceedsAvailableCBBTCLiquidity ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    ml="1px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    Exceeds available liquidity -
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml="8px"
                    color={inputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleInputLiquidityMaxClick}
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {(() => {
                      const maxCbBtcLiquiditySats = liquidity.maxCbBTCLiquidity;
                      const maxCbBtcLiquidityBtc = Number(maxCbBtcLiquiditySats) / 100_000_000;
                      return `${maxCbBtcLiquidityBtc.toFixed(4)} BTC Max`;
                    })()}
                  </Text>
                </>
              ) : inputBelowMinimum ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    ml="1px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    Below minimum output -
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml="8px"
                    color={inputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleMinimumClick}
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {(() => {
                      const ticker = isSwappingForBTC ? "BTC" : "cbBTC";
                      return `${MIN_BTC.toFixed(5)} ${ticker} Min`;
                    })()}
                  </Text>
                </>
              ) : (
                <Text
                  color={!rawInputAmount ? colors.offWhite : colors.textGray}
                  fontSize="14px"
                  mt="6px"
                  ml="1px"
                  letterSpacing="-1px"
                  fontWeight="normal"
                  fontFamily="Aux"
                >
                  {isLoadingQuote && !getQuoteForInputRef.current ? "..." : inputUsdValue}
                </Text>
              )}
            </Flex>
          </Flex>

          <Spacer />
          <Flex mr="8px" py="12px" direction="column" align="flex-end" justify="center" h="100%">
            <Flex direction="row" justify="flex-end" h="21px" align="center">
              {currentInputBalance && parseFloat(currentInputBalance) > 0 && (
                <Tooltip
                  show={showMaxTooltip && selectedInputToken?.ticker === "ETH" && isAtAdjustedMax}
                  onMouseEnter={() => setShowMaxTooltip(true)}
                  onMouseLeave={() => setShowMaxTooltip(false)}
                  hoverText="Max excludes ETH for gas"
                  body={
                    <Button
                      onClick={handleMaxClick}
                      size="xs"
                      h="21px"
                      px="8px"
                      bg={colors.swapBgColor}
                      color={colors.textGray}
                      fontSize="12px"
                      fontWeight="bold"
                      fontFamily="Aux"
                      letterSpacing="-0.5px"
                      border="1px solid"
                      borderColor={colors.swapBorderColor}
                      borderRadius="8px"
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
                  }
                />
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
                  {currentInputBalance.slice(0, 8)} {currentInputTicker}
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

            {isLoadingQuote && getQuoteForInputRef.current ? (
              <Flex align="center" mt="6px" ml="-5px">
                <Spinner size="lg" color={outputStyle?.border_color_light || colors.textGray} />
              </Flex>
            ) : (
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
                color={
                  (exceedsAvailableBTCLiquidity && lastEditedField === "output") || belowMinimumSwap
                    ? colors.red
                    : colors.offWhite
                }
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
                disabled={isOtcServerDead}
                cursor={isOtcServerDead ? "not-allowed" : "text"}
                opacity={isOtcServerDead ? 0.5 : 1}
              />
            )}

            <Flex>
              {exceedsAvailableBTCLiquidity && lastEditedField === "output" ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    ml="1px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    Exceeds available liquidity -
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml="8px"
                    color={outputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleOutputMaxClick}
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {(() => {
                      const maxLiquiditySats = isSwappingForBTC
                        ? liquidity.maxBTCLiquidity
                        : liquidity.maxCbBTCLiquidity;
                      const maxLiquidityBtc = Number(maxLiquiditySats) / 100_000_000;
                      const ticker = isSwappingForBTC ? "BTC" : "cbBTC";
                      return `${maxLiquidityBtc.toFixed(4)} ${ticker} Max`;
                    })()}
                  </Text>
                </>
              ) : belowMinimumSwap ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    ml="1px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    Below minimum output -
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml="8px"
                    color={outputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleMinimumClick}
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {(() => {
                      const ticker = isSwappingForBTC ? "BTC" : "cbBTC";
                      return `${MIN_BTC.toFixed(5)} ${ticker} Min`;
                    })()}
                  </Text>
                </>
              ) : (
                <Text
                  color={!outputAmount ? colors.offWhite : colors.textGray}
                  fontSize="14px"
                  mt="6px"
                  ml="1px"
                  letterSpacing="-1px"
                  fontWeight="normal"
                  fontFamily="Aux"
                >
                  {isLoadingQuote && getQuoteForInputRef.current ? "..." : outputUsdValue}
                </Text>
              )}
            </Flex>
          </Flex>

          <Spacer />
          <Flex mr="8px">
            <WebAssetTag
              cursor={
                outputAssetIdentifier !== "BTC" && outputAssetIdentifier !== "CBBTC"
                  ? "pointer"
                  : "default"
              }
              asset={outputAssetIdentifier}
              onDropDown={
                outputAssetIdentifier !== "BTC" && outputAssetIdentifier !== "CBBTC"
                  ? openAssetSelector
                  : undefined
              }
              isOutput={true}
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
            {calculateExchangeRate(
              isSwappingForBTC,
              rawInputAmount,
              outputAmount,
              ethPrice,
              btcPrice,
              erc20Price,
              isSwappingForBTC
                ? selectedInputToken?.ticker || "ETH"
                : selectedOutputToken?.ticker || "CBBTC"
            )}
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
            <Tooltip
              show={showFeeTooltip && !!feeOverview}
              onMouseEnter={() => setShowFeeTooltip(true)}
              onMouseLeave={() => setShowFeeTooltip(false)}
              hoverText={
                feeOverview ? (
                  <>
                    {[
                      { key: "erc20", ...feeOverview.erc20Fee },
                      { key: "network", ...feeOverview.networkFee },
                      { key: "protocol", ...feeOverview.protocolFee },
                    ]
                      .filter((fee) => fee.fee !== "$0.00")
                      .map((fee) => (
                        <Text key={fee.key}>
                          {fee.description}: {fee.fee}
                        </Text>
                      ))}
                  </>
                ) : null
              }
              body={
                <Flex pr="3px" mt="-2px">
                  <Text
                    color={colors.textGray}
                    fontSize="14px"
                    mr="8px"
                    mt="1px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    Fees: {feeOverview?.totalFees || ""}
                  </Text>
                  <Flex mt="0px" mr="2px">
                    <InfoSVG width="14px" />
                  </Flex>
                </Flex>
              }
            />
          </Flex>
        </Flex>

        {/* Recipient Address - Animated (appears second) */}
        {isSwappingForBTC && (
          <Flex
            direction="column"
            w="100%"
            // mb="5px"
            opacity={hasStartedTyping ? 1 : 0}
            transform={hasStartedTyping ? "translateY(0px)" : "translateY(-20px)"}
            transition="all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            transitionDelay={hasStartedTyping ? "0.2s" : "0s"}
            pointerEvents={hasStartedTyping ? "auto" : "none"}
            overflow="visible"
            maxHeight={hasStartedTyping ? "200px" : "0px"}
          >
            {/* Payout Recipient Address */}
            <Flex ml="8px" alignItems="center" mt="18px" w="100%" mb="10px">
              <Text fontSize="15px" fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                Bitcoin Recipient Address
              </Text>
              <Flex pl="5px" mt="-2px">
                <Tooltip
                  show={showAddressTooltip}
                  onMouseEnter={() => setShowAddressTooltip(true)}
                  onMouseLeave={() => setShowAddressTooltip(false)}
                  hoverText={
                    <Text>Only P2WPKH, P2PKH, or P2SH Bitcoin addresses are supported.</Text>
                  }
                  iconWidth="12px"
                />
              </Flex>
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
