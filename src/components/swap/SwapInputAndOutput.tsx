import { Flex, Text, Input, Spacer, Button, Spinner } from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import { RiftSdk, Currencies, createCurrency, QuoteParameters } from "@riftresearch/sdk";
import {
  GLOBAL_CONFIG,
  ZERO_USD_DISPLAY,
  ETHEREUM_POPULAR_TOKENS,
  BASE_POPULAR_TOKENS,
  BITCOIN_DECIMALS,
  MIN_SWAP_SATS,
  ETH_TOKEN_BASE,
  ETH_TOKEN,
  BTC_TOKEN,
  CBBTC_TOKEN,
  bitcoinStyle,
  evmStyle,
} from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { AddressSelector } from "@/components/other/AddressSelector";
import { PasteAddressModal } from "@/components/other/PasteAddressModal";
import { InfoSVG } from "../other/SVGs";
import { Tooltip } from "@/components/other/Tooltip";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore } from "@/utils/store";
import { TokenData, ApprovalState } from "@/utils/types";
import {
  isAboveMinSwap,
  calculateUsdValue,
  validatePayoutAddress,
  calculateExchangeRate,
  buildFeeOverview,
  getMinSwapValueUsd,
  satsToBtc,
  truncateAmount,
  getSlippageBpsForNotional,
  formatCurrencyAmount,
  calculatePriceImpact,
} from "@/utils/swapHelpers";
import { formatUnits, parseUnits } from "viem";
import { useMaxLiquidity } from "@/hooks/useLiquidity";
import { saveSwapStateToCookie, loadSwapStateFromCookie } from "@/utils/swapStateCookies";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { fetchTokenPrice } from "@/utils/userTokensClient";
import { useBitcoinBalance } from "@/hooks/useBitcoinBalance";
import { getRecommendedFeeRate, estimateTransactionSize } from "@/utils/bitcoinTransactionHelpers";
import { getWalletClientConfig } from "@/utils/wallet";

// Calculate minimum BTC amount once
const MIN_BTC = parseFloat(satsToBtc(MIN_SWAP_SATS));

// Gas units buffer for ETH transfers (cowswap create order is ~56k, using 10M for safety margin)
const ETH_GAS_UNITS = BigInt(10_000_000);

// Base mainnet chainId
const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_FIXED_GAS_COST_ETH = 0.0001;

/**
 * Fetches current gas price and computes estimated gas cost in ETH.
 * Used to reserve ETH for gas when computing max swap amounts.
 * Base mainnet uses a fixed gas cost due to L2 fee predictability.
 */
async function fetchEthGasCost(chainId: number): Promise<number | null> {
  if (chainId === BASE_MAINNET_CHAIN_ID) {
    return BASE_FIXED_GAS_COST_ETH;
  }

  try {
    const response = await fetch(`/api/eth-gas?chainId=${chainId}`);
    if (!response.ok) return null;

    const data = await response.json();
    const maxFeePerGas = BigInt(data.maxFeePerGas);
    const gasCostWei = maxFeePerGas * ETH_GAS_UNITS;
    return parseFloat(formatUnits(gasCostWei, 18));
  } catch (error) {
    console.error("Failed to fetch gas data:", error);
    return null;
  }
}

interface SwapInputAndOutputProps {
  hidePayoutAddress?: boolean;
}

export const SwapInputAndOutput = ({ hidePayoutAddress = false }: SwapInputAndOutputProps) => {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  // Get wallet addresses from global store (set via Dynamic's onWalletAdded callback)
  const evmAddress = useStore((state) => state.evmAddress);
  const btcAddress = useStore((state) => state.btcAddress);
  const setEvmAddress = useStore((state) => state.setEvmAddress);
  const setBtcAddress = useStore((state) => state.setBtcAddress);
  const setEvmWalletClient = useStore((state) => state.setEvmWalletClient);
  const isEvmConnected = !!evmAddress;

  // Dynamic wallet context
  const { primaryWallet } = useDynamicContext();

  // Rift SDK from store
  const rift = useStore((state) => state.rift);
  const setRift = useStore((state) => state.setRift);
  const setExecuteSwap = useStore((state) => state.setExecuteSwap);

  // Liquidity hook
  const liquidity = useMaxLiquidity();

  // Fetch BTC/ETH prices
  useBtcEthPrices();

  // Mobile detection
  const { isMobile } = useWindowSize();

  // Local state
  const [lastEditedField, setLastEditedField] = useState<"input" | "output">("input");
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [assetSelectorDirection, setAssetSelectorDirection] = useState<"input" | "output">("input");
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const [showMaxTooltip, setShowMaxTooltip] = useState(false);
  const [isAtAdjustedMax, setIsAtAdjustedMax] = useState(false);
  const getQuoteForInputRef = useRef(true);
  const [currentInputBalance, setCurrentInputBalance] = useState<string | null>(null);
  const [currentInputTicker, setCurrentInputTicker] = useState<string | null>(null);
  const [currentOutputBalance, setCurrentOutputBalance] = useState<string | null>(null);
  const [currentOutputTicker, setCurrentOutputTicker] = useState<string | null>(null);
  const [outputBelowMinimum, setOutputBelowMinimum] = useState(false);
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
    inputToken,
    outputToken,
    userTokensByChain,
    evmWalletClient,
    displayedInputAmount,
    setDisplayedInputAmount,
    fullPrecisionInputAmount,
    setFullPrecisionInputAmount,
    outputAmount,
    setOutputAmount,
    btcPrice,
    ethPrice,
    inputTokenPrice,
    setInputTokenPrice,
    outputTokenPrice,
    setOutputTokenPrice,
    inputUsdValue,
    setInputUsdValue,
    outputUsdValue,
    setOutputUsdValue,
    quote,
    setQuote,
    payoutAddress,
    setPayoutAddress,
    addressValidation,
    setAddressValidation,
    btcRefundAddress,
    setBtcRefundAddress,
    btcRefundAddressValidation,
    setBtcRefundAddressValidation,
    setApprovalState,
    setInputToken,
    setOutputToken,
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
    refetchQuote,
    setRefetchQuote,
    setIsAwaitingOptimalQuote,
    hasNoRoutesError,
    switchingToInputTokenChain,
    setSwitchingToInputTokenChain,
    selectedInputAddress,
    setSelectedInputAddress,
    selectedOutputAddress,
    setSelectedOutputAddress,
    skipAddressClearOnDirectionChange,
    setSkipAddressClearOnDirectionChange,
  } = useStore();

  // State for paste address modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalType, setPasteModalType] = useState<"EVM" | "BTC">("BTC");

  // Derive swap direction from token chains
  const isSwappingForBTC = outputToken.chain === "bitcoin";

  // Derive EVM chain ID from input token (default to Ethereum mainnet)
  const evmConnectWalletChainId = inputToken.chain === "bitcoin" ? 1 : inputToken.chain;

  // Fetch Bitcoin balance whenever a BTC wallet is connected
  const { balanceBtc: btcBalanceBtc, isLoading: isBtcBalanceLoading } =
    useBitcoinBalance(btcAddress);

  // Note: Auto-selection is now handled by AddressSelector component
  // This effect only runs once on mount to set initial primary wallet if available
  const hasInitializedRef = useRef(false);
  const userWallets = useUserWallets();

  // Sync wallet addresses from useUserWallets to global store on mount/change
  useEffect(() => {
    // Find first EVM wallet
    const evmWallet = userWallets.find((w) => w.chain?.toUpperCase() === "EVM");
    console.log("[syncWalletAddresses] evmWallet", evmWallet);
    if (evmWallet && !evmAddress) {
      setEvmAddress(evmWallet.address);
      // Also fetch and set the wallet client with explicit chain config
      const config = getWalletClientConfig(evmWallet.address, 1); // Default to mainnet
      (evmWallet as any)
        .getWalletClient(config)
        .then((client: any) => {
          console.log("SwapInputAndOutput: Setting wallet client for", evmWallet.address);
          setEvmWalletClient(client);
        })
        .catch((error: any) => {
          console.error("SwapInputAndOutput: Failed to get wallet client:", error);
          setEvmWalletClient(null);
        });
    }

    // Find first BTC wallet
    const btcWallet = userWallets.find((w) => {
      const chain = w.chain?.toUpperCase();
      return chain === "BTC" || chain === "BITCOIN";
    });
    if (btcWallet && !btcAddress) {
      setBtcAddress(btcWallet.address);
    }
  }, [userWallets, evmAddress, btcAddress, setEvmAddress, setBtcAddress, setEvmWalletClient]);

  // Initialize Rift SDK
  useEffect(() => {
    if (!rift) {
      const sdk = new RiftSdk({ integratorName: "app.rift.trade" });
      setRift(sdk);
    }
  }, [rift, setRift]);

  useEffect(() => {
    if (hasInitializedRef.current || !primaryWallet) return;
    hasInitializedRef.current = true;

    const walletChain = primaryWallet.chain?.toUpperCase();
    const isEvmWallet = walletChain === "EVM";
    const isBtcWallet = walletChain === "BTC" || walletChain === "BITCOIN";

    // For input address - only set on mount if matches swap direction
    if (isSwappingForBTC && isEvmWallet) {
      setSelectedInputAddress(primaryWallet.address);
    } else if (!isSwappingForBTC && isBtcWallet) {
      setSelectedInputAddress(primaryWallet.address);
    }

    // For output address
    if (isSwappingForBTC && isBtcWallet) {
      // EVM → BTC: Select BTC wallet for output
      setSelectedOutputAddress(primaryWallet.address);
    } else if (!isSwappingForBTC && isEvmWallet) {
      // BTC → EVM: Select EVM wallet for output
      setSelectedOutputAddress(primaryWallet.address);
    }
  }, [primaryWallet, isSwappingForBTC, setSelectedInputAddress, setSelectedOutputAddress]);

  // Sync input address with primary wallet when user selects a different wallet in the panel
  // This runs after mount when the primary wallet changes
  const prevPrimaryWalletRef = useRef<string | null>(primaryWallet?.address || null);
  useEffect(() => {
    if (!primaryWallet) return;

    // Skip if primary wallet hasn't changed
    if (prevPrimaryWalletRef.current === primaryWallet.address) return;
    prevPrimaryWalletRef.current = primaryWallet.address;

    const walletChain = primaryWallet.chain?.toUpperCase();
    const isEvmWallet = walletChain === "EVM";
    const isBtcWallet = walletChain === "BTC" || walletChain === "BITCOIN";

    // Update input address if wallet type matches swap direction
    if (isSwappingForBTC && isEvmWallet) {
      // EVM → BTC: Update input to the selected EVM wallet
      setSelectedInputAddress(primaryWallet.address);
    } else if (!isSwappingForBTC && isBtcWallet) {
      // BTC → EVM: Update input to the selected BTC wallet
      setSelectedInputAddress(primaryWallet.address);
    }
  }, [primaryWallet, isSwappingForBTC, setSelectedInputAddress]);

  // Auto-select output address when swap direction changes
  useEffect(() => {
    // Skip if addresses are already set (user selected them)
    if (selectedOutputAddress) return;

    // Use store addresses for output based on direction
    if (isSwappingForBTC) {
      // EVM → BTC: Use BTC address from store for output
      if (btcAddress) {
        setSelectedOutputAddress(btcAddress);
      }
    } else {
      // BTC → EVM: Use EVM address from store for output
      if (evmAddress) {
        setSelectedOutputAddress(evmAddress);
      }
    }
  }, [isSwappingForBTC, btcAddress, evmAddress, selectedOutputAddress, setSelectedOutputAddress]);

  // Track previous swap direction to detect actual changes
  const prevIsSwappingForBTCRef = useRef(isSwappingForBTC);

  // Clear addresses when swap direction changes (not on mount)
  // Skip clearing if direction change was triggered by wallet selection in WalletPanel
  useEffect(() => {
    if (prevIsSwappingForBTCRef.current !== isSwappingForBTC) {
      if (!skipAddressClearOnDirectionChange) {
        setSelectedInputAddress(null);
        setSelectedOutputAddress(null);
      } else {
        // Reset the flag after skipping
        setSkipAddressClearOnDirectionChange(false);
      }
      prevIsSwappingForBTCRef.current = isSwappingForBTC;
    }
  }, [
    isSwappingForBTC,
    setSelectedInputAddress,
    setSelectedOutputAddress,
    skipAddressClearOnDirectionChange,
    setSkipAddressClearOnDirectionChange,
  ]);

  // Sync selectedOutputAddress to payoutAddress when swapping for BTC
  useEffect(() => {
    if (isSwappingForBTC && selectedOutputAddress) {
      setPayoutAddress(selectedOutputAddress);
      // Also validate immediately to avoid timing issues
      const validation = validatePayoutAddress(selectedOutputAddress, true);
      setAddressValidation(validation);
    } else if (isSwappingForBTC && !selectedOutputAddress) {
      setPayoutAddress("");
      setAddressValidation({ isValid: false });
    }
  }, [isSwappingForBTC, selectedOutputAddress, setPayoutAddress, setAddressValidation]);

  // Define the styles based on asset chain
  const inputStyle = inputToken.chain === "bitcoin" ? bitcoinStyle : evmStyle;
  const outputStyle = outputToken.chain === "bitcoin" ? bitcoinStyle : evmStyle;

  // For WebAssetTag, we need to pass the right string identifiers
  const inputAssetIdentifier = inputToken.ticker;
  const outputAssetIdentifier = outputToken.ticker;

  // Styling constants
  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  // ============================================================================
  // QUOTING FUNCTIONS
  // ============================================================================

  // Fetch token price - uses store btcPrice/ethPrice for native tokens, fetches from API for ERC20s
  const fetchTokenPriceForDirection = useCallback(
    async (tokenData: TokenData | null, direction: "input" | "output") => {
      const setPrice = direction === "input" ? setInputTokenPrice : setOutputTokenPrice;

      if (!tokenData) {
        setPrice(null);
        return;
      }

      // For BTC/cbBTC, use btcPrice from store
      if (tokenData.ticker === "BTC" || tokenData.ticker === "cbBTC") {
        setPrice(btcPrice);
        setHasNoRoutesError(false);
        return;
      }

      // For ETH, use ethPrice from store
      if (
        tokenData.ticker === "ETH" ||
        tokenData.address === "0x0000000000000000000000000000000000000000"
      ) {
        setPrice(ethPrice);
        setHasNoRoutesError(false);
        return;
      }

      // Use the token's chain to determine the correct chain for price lookup

      const chainName = tokenData.chain === 8453 ? "base" : "ethereum";

      try {
        const tokenPriceResult = await fetchTokenPrice(chainName, tokenData.address);
        if (tokenPriceResult && typeof tokenPriceResult.price === "number") {
          setPrice(tokenPriceResult.price);
          setHasNoRoutesError(false);
        } else {
          setHasNoRoutesError(true);
        }
      } catch (error) {
        console.error(`Failed to fetch ${direction} token price:`, error);
        setHasNoRoutesError(true);
      }
    },
    [evmConnectWalletChainId, setInputTokenPrice, setOutputTokenPrice, btcPrice, ethPrice]
  );

  // Unified quote fetching function using Rift SDK
  const fetchQuote = useCallback(
    async (isInput: boolean, amount: string, requestId?: number) => {
      if (!rift) {
        console.log("[fetchQuote] SDK not initialized");
        return;
      }

      console.log("[fetchQuote] amount", amount);
      if (!amount || parseFloat(amount) <= 0) {
        console.log("[fetchQuote] No amount to quote");
        return;
      }

      setIsLoadingQuote(true);

      try {
        // Build from/to currencies
        const fromCurrency =
          inputToken.chain === "bitcoin"
            ? Currencies.Bitcoin.BTC
            : inputToken.ticker === "ETH" && inputToken.chain === 1
              ? Currencies.Ethereum.ETH
              : inputToken.ticker === "ETH" && inputToken.chain === 8453
                ? Currencies.Base.ETH
                : createCurrency({
                    chainId: inputToken.chain as number,
                    address: inputToken.address as `0x${string}`,
                    decimals: inputToken.decimals,
                  });

        const toCurrency =
          outputToken.chain === "bitcoin"
            ? Currencies.Bitcoin.BTC
            : outputToken.ticker === "ETH" && outputToken.chain === 1
              ? Currencies.Ethereum.ETH
              : outputToken.ticker === "ETH" && outputToken.chain === 8453
                ? Currencies.Base.ETH
                : createCurrency({
                    chainId: outputToken.chain as number,
                    address: outputToken.address as `0x${string}`,
                    decimals: outputToken.decimals,
                  });

        // Normalize amount with token decimals (e.g. "1" USDC -> "1000000")
        const decimals = isInput ? inputToken.decimals : outputToken.decimals;
        const normalizedAmount = parseUnits(amount, decimals).toString();

        // Call SDK getQuote
        const quoteRequest: QuoteParameters = {
          from: fromCurrency,
          to: toCurrency,
          amount: normalizedAmount,
          mode: isInput ? "exact_input" : "exact_output",
        };
        console.log("[fetchQuote] quoteRequest", quoteRequest);
        const { quote, executeSwap } = await rift.getQuote(quoteRequest);

        console.log("[fetchQuote] quote", quote);

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          console.log(`[fetchQuote] Ignoring stale quote response`, requestId);
          return;
        }

        if (quote) {
          setQuote(quote);

          // Extract fee overview from quote response
          const riftFees = quote.fees?.rift;
          if (riftFees) {
            setFeeOverview(
              buildFeeOverview({
                rift: riftFees,
                totalUsd: quote.fees!.totalUsd,
              })
            );
          }

          // Store executeSwap for later use by SwapButton
          setExecuteSwap(executeSwap);

          // Update displayed amounts from quote (convert raw values to human-readable)
          if (isInput && quote.to?.amount) {
            setOutputAmount(formatUnits(BigInt(quote.to.amount), outputToken.decimals));
          } else if (!isInput && quote.from?.amount) {
            setDisplayedInputAmount(formatUnits(BigInt(quote.from.amount), inputToken.decimals));
          }
        }
      } catch (error) {
        console.error("[fetchQuote] Error fetching quote:", error);
        setQuote(null);
        setExecuteSwap(null);
      } finally {
        setIsLoadingQuote(false);
        setRefetchQuote(false);
      }
    },
    [
      rift,
      inputToken,
      outputToken,
      setQuote,
      setExecuteSwap,
      setOutputAmount,
      setDisplayedInputAmount,
    ]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const openAssetSelector = (direction: "input" | "output") => {
    setAssetSelectorDirection(direction);
    setIsAssetSelectorOpen(true);
  };

  const closeAssetSelector = () => {
    setIsAssetSelectorOpen(false);
  };

  const handleSwapReverse = () => {
    // Swap input and output tokens
    const previousInput = inputToken;
    const previousOutput = outputToken;

    setInputToken(previousOutput);
    setOutputToken(previousInput);

    // Zero out amounts and USD values
    setDisplayedInputAmount("");
    setOutputAmount("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setFeeOverview(null);
    setPayoutAddress("");
    setAddressValidation({ isValid: false });
    setHasStartedTyping(false);
  };

  const handleInputOrOutputChange = (e: ChangeEvent<HTMLInputElement>, isInput: boolean) => {
    let value = e.target.value;
    const currentAmount = isInput ? displayedInputAmount : outputAmount;
    const token = isInput ? inputToken : outputToken;
    const setAmount = isInput ? setDisplayedInputAmount : setOutputAmount;
    const setUsdValue = isInput ? setInputUsdValue : setOutputUsdValue;
    const debounceTimerRef = isInput ? quoteDebounceTimerRef : outputQuoteDebounceTimerRef;
    const debounceDelay = 100;

    // If first character is "0" or ".", replace with "0."
    if (currentAmount === "" && (value === "0" || value === ".")) {
      value = "0.";
    }

    // Allow empty string, numbers, and decimal point (max 8 decimals)
    if (value === "" || /^\d*\.?\d{0,8}$/.test(value)) {
      console.log("[handleInputOrOutputChange] value", value);
      setAmount(value);
      setLastEditedField(isInput ? "input" : "output");
      setHasStartedTyping(true);

      // Reset adjusted max flag and full precision when user manually edits input
      if (isInput) {
        setIsAtAdjustedMax(false);
        setFullPrecisionInputAmount(value);
      }

      // Update USD value using helper

      const tokenPrice = isInput ? inputTokenPrice : outputTokenPrice;
      const usdValue = calculateUsdValue(value, token.ticker, ethPrice, btcPrice, tokenPrice);
      setUsdValue(usdValue);

      // Clear existing quotes when user types
      setQuote(null);
      setFeeOverview(null);

      if (!value || parseFloat(value) <= 0) {
        // Clear the other field if this field is empty or 0
        if (isInput) {
          setOutputAmount("");
          setOutputUsdValue(ZERO_USD_DISPLAY);
        } else {
          setDisplayedInputAmount("");
          setInputUsdValue(ZERO_USD_DISPLAY);
          setIsLoadingQuote(false);
        }
      }

      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set up debounced quote fetch
      const shouldFetchQuote = isInput
        ? value && parseFloat(value) > 0 && getQuoteForInputRef.current && !hasNoRoutesError
        : value && parseFloat(value) > 0 && !getQuoteForInputRef.current;

      if (shouldFetchQuote) {
        // For output, check if below min (3000 sats = 0.00003 BTC)
        if (!isInput) {
          const outputFloat = parseFloat(value);
          if (outputFloat < MIN_BTC) {
            // Don't fetch quote if below minimum
            setDisplayedInputAmount("");
            setInputUsdValue(ZERO_USD_DISPLAY);
            setIsLoadingQuote(false);
            return;
          }
        }

        // Show loading state
        setIsLoadingQuote(true);

        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        // Fetch quote
        debounceTimerRef.current = setTimeout(() => {
          fetchQuote(isInput, value, currentRequestId);
        }, debounceDelay);
      } else if (isInput) {
        setIsLoadingQuote(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isInput: boolean) => {
    // Set flag to indicate which field we should quote for
    getQuoteForInputRef.current = isInput;

    const currentAmount = isInput ? displayedInputAmount : outputAmount;

    // If value is "0." and user presses Backspace or Delete, clear both characters
    if (currentAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setDisplayedInputAmount("");
      setOutputAmount("");
      setOutputUsdValue(ZERO_USD_DISPLAY);
      setInputUsdValue(ZERO_USD_DISPLAY);
      setFeeOverview(null);
    }
  };

  const handleMaxClick = async () => {
    if (!currentInputBalance) return;

    // Set flag to indicate we should quote for input field
    getQuoteForInputRef.current = true;
    console.log("currentInputBalance", currentInputBalance);

    // Calculate currentInputBalance in USD for comparisons
    const balanceUsd = calculateUsdValue(
      currentInputBalance,
      inputToken.ticker,
      ethPrice,
      btcPrice,
      inputTokenPrice
    );
    const balanceUsdFloat = parseFloat(balanceUsd.replace(/[$,]/g, ""));

    // Always clear exceeds user balance and output below minimum
    setExceedsUserBalance(false);
    setOutputBelowMinimum(false);

    let adjustedInputAmount = currentInputBalance;
    // Limit to 8 decimal places for display

    // Only clear min swap errors if balance > min swap
    if (btcPrice && isAboveMinSwap(balanceUsdFloat, btcPrice)) {
      setInputBelowMinimum(false);
    } else {
      setInputBelowMinimum(true);
      setOutputAmount("");
      setDisplayedInputAmount(truncateAmount(adjustedInputAmount));
      setFullPrecisionInputAmount(adjustedInputAmount);
      setQuote(null);
      return;
    }

    // Only clear liquidity errors if balance < available liquidity
    const maxLiquidityUsd = parseFloat(liquidity.maxBTCLiquidityInUsd);
    if (balanceUsdFloat < maxLiquidityUsd) {
      setExceedsAvailableBTCLiquidity(false);
    }

    // If ETH is selected, fetch gas data and adjust for gas costs
    if (inputToken.ticker === "ETH") {
      const gasCostEth = await fetchEthGasCost(
        inputToken.chain === "bitcoin" ? 1 : (inputToken.chain ?? 1)
      );
      if (gasCostEth !== null) {
        const balanceFloat = parseFloat(currentInputBalance);
        const adjustedAmount = balanceFloat - gasCostEth;

        if (adjustedAmount > 0) {
          adjustedInputAmount = adjustedAmount.toString();
          setIsAtAdjustedMax(true);
        } else {
          adjustedInputAmount = currentInputBalance;
          setIsAtAdjustedMax(false);
        }
      } else {
        setIsAtAdjustedMax(false);
      }
    } else if (inputToken.ticker === "BTC") {
      // For BTC input, fetch recommended fee rate from network
      const feeRate = await getRecommendedFeeRate("medium");
      // Estimate typical transaction size (1 input, 2 outputs)
      const estimatedSize = estimateTransactionSize(1, 2);
      const btcFeeReserveSats = Math.ceil(feeRate * estimatedSize);
      const btcFeeReserveBtc = btcFeeReserveSats / 100_000_000;

      const balanceFloat = parseFloat(currentInputBalance);
      const adjustedAmount = balanceFloat - btcFeeReserveBtc;

      if (adjustedAmount > 0) {
        adjustedInputAmount = adjustedAmount.toFixed(8);
        setIsAtAdjustedMax(true);
      } else {
        adjustedInputAmount = currentInputBalance;
        setIsAtAdjustedMax(false);
      }
    } else {
      setIsAtAdjustedMax(false);
    }

    console.log("[yee] adjustedInputAmount", adjustedInputAmount);
    // Store full precision for quoting and swap execution
    setFullPrecisionInputAmount(adjustedInputAmount);

    // Set the truncated balance as the displayed input amount
    setDisplayedInputAmount(truncateAmount(adjustedInputAmount));
    setLastEditedField("input");
    setHasStartedTyping(true);

    // Update USD value using full precision
    const usdValue = calculateUsdValue(
      adjustedInputAmount,
      inputToken.ticker,
      ethPrice,
      btcPrice,
      inputTokenPrice
    );
    setInputUsdValue(usdValue);

    // Clear existing quotes when max is clicked
    setQuote(null);

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

      // Fetch exact input quote using full precision
      fetchQuote(true, adjustedInputAmount, currentRequestId);
    }
  };

  const handleOutputMaxClick = () => {
    // Set flag to indicate we should quote for output field
    getQuoteForInputRef.current = false;

    // Clear ALL error flags (both output AND input related since they can cascade)
    setExceedsAvailableBTCLiquidity(false);
    setExceedsAvailableCBBTCLiquidity(false);
    setOutputBelowMinimum(false);
    setExceedsUserBalance(false);
    setInputBelowMinimum(false);
    setFullPrecisionInputAmount(null);

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
    const truncatedOutputAmount = truncateAmount(maxOutputAmount);

    // Set the truncated max liquidity as the output amount
    setOutputAmount(truncatedOutputAmount);
    setLastEditedField("output");
    setHasStartedTyping(true);

    // Update USD value using helper
    const usdValue = calculateUsdValue(
      truncatedOutputAmount,
      outputToken.ticker,
      ethPrice,
      btcPrice,
      outputTokenPrice
    );
    setOutputUsdValue(usdValue);

    // Clear existing quotes when max is clicked
    setQuote(null);

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

      // Fetch exact output quote
      fetchQuote(false, truncatedOutputAmount, currentRequestId);
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
    setOutputBelowMinimum(false);

    // Set minimum output to 3000 sats (0.00003 BTC)
    const minOutputAmountStr = MIN_BTC.toString();

    // Set the minimum amount as the output amount
    setOutputAmount(minOutputAmountStr);
    setLastEditedField("output");
    setHasStartedTyping(true);

    // Update USD value
    const usdValue = calculateUsdValue(
      minOutputAmountStr,
      outputToken.ticker,
      ethPrice,
      btcPrice,
      outputTokenPrice
    );
    setOutputUsdValue(usdValue);

    // Clear existing quotes
    setQuote(null);

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

    // Fetch exact output quote
    fetchQuote(false, minOutputAmountStr, currentRequestId);
  };

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

  // Reset values on mount and cleanup timers on unmount
  useEffect(() => {
    setDisplayedInputAmount("");
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
    setDisplayedInputAmount,
    setOutputAmount,
    setInputUsdValue,
    setOutputUsdValue,
    setPayoutAddress,
    setAddressValidation,
  ]);

  // Load swap state from cookies on initial mount BEFORE setting defaults
  useEffect(() => {
    if (!isInitialMountRef.current || hasLoadedFromCookieRef.current) return;

    const savedState = loadSwapStateFromCookie();
    if (savedState) {
      console.log("Loading swap state from cookie:", savedState);

      // Restore selected tokens (swap direction is derived from token chains)
      if (savedState.inputToken) {
        console.log("Setting selected input token from cookie:", savedState.inputToken);
        setInputToken(savedState.inputToken);
        console.log("inputToken cookie", inputToken);
      }

      if (savedState.outputToken) {
        setOutputToken(savedState.outputToken);
      }

      hasLoadedFromCookieRef.current = true;
    }

    isInitialMountRef.current = false;
  }, [setInputToken, setOutputToken, inputToken]);

  useEffect(() => {
    // If chain switch was triggered from asset selector, just clear the flag and keep the selected token
    // Otherwise, reset to default token for the new chain
    const inputTokenChainId = inputToken.chain === "bitcoin" ? null : inputToken.chain;
    if (
      !switchingToInputTokenChain &&
      inputTokenChainId !== null &&
      inputTokenChainId !== evmConnectWalletChainId
    ) {
      const defaultToken = evmConnectWalletChainId === 8453 ? ETH_TOKEN_BASE : ETH_TOKEN;
      setInputToken(defaultToken);
    }
  }, [
    setInputToken,
    evmConnectWalletChainId,
    inputToken,
    switchingToInputTokenChain,
    setSwitchingToInputTokenChain,
  ]);

  // Fetch token prices when selected tokens change
  useEffect(() => {
    fetchTokenPriceForDirection(inputToken, "input");
  }, [inputToken, fetchTokenPriceForDirection]);

  useEffect(() => {
    fetchTokenPriceForDirection(outputToken, "output");
  }, [outputToken, fetchTokenPriceForDirection]);

  // Update USD values when prices or amounts change
  useEffect(() => {
    const inputUsd = calculateUsdValue(
      displayedInputAmount,
      inputToken.ticker,
      ethPrice,
      btcPrice,
      inputTokenPrice
    );
    setInputUsdValue(inputUsd);

    const outputUsd = calculateUsdValue(
      outputAmount,
      outputToken.ticker,
      ethPrice,
      btcPrice,
      outputTokenPrice
    );
    setOutputUsdValue(outputUsd);
  }, [
    inputTokenPrice,
    outputTokenPrice,
    btcPrice,
    ethPrice,
    displayedInputAmount,
    outputAmount,
    isSwappingForBTC,
    inputToken,
    outputToken,
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

  // Sync selectedInputAddress to btcRefundAddress when in BTC -> EVM mode
  useEffect(() => {
    if (!isSwappingForBTC && selectedInputAddress) {
      setBtcRefundAddress(selectedInputAddress);
      // Also validate immediately
      const validation = validatePayoutAddress(selectedInputAddress, true);
      setBtcRefundAddressValidation(validation);
    } else if (!isSwappingForBTC && !selectedInputAddress) {
      setBtcRefundAddress("");
      setBtcRefundAddressValidation({ isValid: false });
    }
  }, [isSwappingForBTC, selectedInputAddress, setBtcRefundAddress, setBtcRefundAddressValidation]);

  // Auto-refresh quote every 10 seconds when user has entered an amount
  useEffect(() => {
    // Clear any existing interval
    if (quoteRefreshIntervalRef.current) {
      clearInterval(quoteRefreshIntervalRef.current);
      quoteRefreshIntervalRef.current = null;
    }

    // Only set up auto-refresh if conditions are met and we have a quote
    if (displayedInputAmount && parseFloat(displayedInputAmount) > 0 && evmAddress && quote) {
      // Determine the amount to use for refresh based on which field was last edited
      const refreshAmount = getQuoteForInputRef.current
        ? fullPrecisionInputAmount || displayedInputAmount
        : outputAmount;

      // Set up 15-second refresh interval
      // Respect which field the user is editing
      quoteRefreshIntervalRef.current = setInterval(() => {
        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        // Refresh quote based on which field was last edited
        fetchQuote(getQuoteForInputRef.current, refreshAmount, currentRequestId);
      }, 10000);
    }

    // Cleanup on unmount or when conditions change
    return () => {
      if (quoteRefreshIntervalRef.current) {
        clearInterval(quoteRefreshIntervalRef.current);
        quoteRefreshIntervalRef.current = null;
      }
    };
  }, [displayedInputAmount, fullPrecisionInputAmount, outputAmount, evmAddress, quote, fetchQuote]);

  // Update current input balance when wallet connection or token selection changes
  useEffect(() => {
    // Handle BTC input (BTC -> EVM swap direction)
    if (inputAssetIdentifier === "BTC") {
      if (selectedInputAddress && btcBalanceBtc > 0) {
        setCurrentInputBalance(btcBalanceBtc.toFixed(8));
        setCurrentInputTicker("BTC");
      } else {
        setCurrentInputBalance(null);
        setCurrentInputTicker(null);
      }
      return;
    }

    // Handle EVM input (EVM -> BTC swap direction)
    if (!isEvmConnected) {
      setCurrentInputBalance(null);
      setCurrentInputTicker(null);
      return;
    }

    const fallbackList = userTokensByChain?.[evmConnectWalletChainId] || [];
    const fallbackEth = fallbackList.find((t) => t.ticker?.toUpperCase() === "ETH");
    const token = inputToken || fallbackEth;

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
    isEvmConnected,
    evmAddress,
    inputToken,
    userTokensByChain,
    evmConnectWalletChainId,
    inputAssetIdentifier,
    selectedInputAddress,
    btcBalanceBtc,
  ]);

  // Update current output balance when wallet connection or token selection changes
  useEffect(() => {
    // Handle BTC output (EVM -> BTC swap direction)
    if (isSwappingForBTC) {
      if (selectedOutputAddress && btcBalanceBtc > 0) {
        setCurrentOutputBalance(btcBalanceBtc.toFixed(8));
        setCurrentOutputTicker("BTC");
      } else {
        setCurrentOutputBalance(null);
        setCurrentOutputTicker(null);
      }
      return;
    }

    // Handle EVM output (BTC -> EVM swap direction)
    if (!isEvmConnected) {
      setCurrentOutputBalance(null);
      setCurrentOutputTicker(null);
      return;
    }

    // For EVM output, look up the output token balance from user tokens
    const tokenList = userTokensByChain?.[evmConnectWalletChainId] || [];

    if (!outputToken) {
      setCurrentOutputBalance(null);
      setCurrentOutputTicker(null);
      return;
    }

    const balance = tokenList.find((t) => t.ticker === outputToken.ticker)?.balance || "0";

    setCurrentOutputBalance(balance);
    setCurrentOutputTicker(outputToken.ticker || null);
  }, [
    isEvmConnected,
    evmAddress,
    outputToken,
    userTokensByChain,
    evmConnectWalletChainId,
    isSwappingForBTC,
    selectedOutputAddress,
    btcBalanceBtc,
  ]);

  // Note: CowSwap allowance checking removed - SDK handles approvals internally

  // Reset approval state when token changes
  useEffect(() => {
    setApprovalState(ApprovalState.UNKNOWN);
  }, [inputToken, setApprovalState]);

  // Track previous state to detect actual changes and dedupe effect runs
  const prevStateRef = useRef<{
    chainId: number | undefined;
    wasConnected: boolean;
  }>({ chainId: undefined, wasConnected: false });
  // Track when initial connection was detected to handle multi-run connection events
  const initialConnectionTimeRef = useRef<number | null>(null);

  // Invalidate quotes and reset state when chain changes (only for active chain switches)
  useEffect(() => {
    const prev = prevStateRef.current;
    console.log("[alp] prev", prev);

    // Detect transition from disconnected -> connected (this render vs previous render)
    const isInitialConnection = !prev.wasConnected && isEvmConnected;

    // If this is a fresh initial connection, record the timestamp
    if (isInitialConnection) {
      initialConnectionTimeRef.current = Date.now();
    }

    // Consider it part of initial connection if within 500ms of detecting one
    // This handles cases where wallet connection triggers multiple state updates
    const isInInitialConnectionWindow =
      initialConnectionTimeRef.current !== null &&
      Date.now() - initialConnectionTimeRef.current < 500;

    // Compute what changed
    const chainChanged = prev.chainId !== undefined && prev.chainId !== evmConnectWalletChainId;

    // Update tracked state for next run
    prevStateRef.current = {
      chainId: evmConnectWalletChainId,
      wasConnected: isEvmConnected,
    };

    // Skip on initial mount
    if (prev.chainId === undefined) {
      return;
    }

    // If this is an initial connection, just trigger quote refetch (don't clear anything)
    if (isInitialConnection) {
      console.log("[alp] Wallet connected - triggering quote refetch");
      setRefetchQuote(true);
      return;
    }

    // Only process chain changes below this point (and only if already connected)
    if (!chainChanged) {
      return;
    }

    console.log(
      "[alp] Chain changed from",
      prev.chainId,
      "to",
      evmConnectWalletChainId,
      isInInitialConnectionWindow ? "- part of initial connection" : "- invalidating quotes"
    );

    // Reset approval state since approvals are chain-specific
    setApprovalState(ApprovalState.UNKNOWN);

    // If this chain change is part of the initial connection window, don't clear - just refetch
    if (isInInitialConnectionWindow) {
      console.log(
        "[alp] Chain change is part of initial connection - preserving state, refetching"
      );
      setRefetchQuote(true);
    } else {
      console.log("[alp] Clearing quotes and amounts for chain switch");
      // Clear existing quotes and amounts - they're no longer valid for the new chain
      setQuote(null);
      setFeeOverview(null);
      setDisplayedInputAmount("");
      setOutputAmount("");
      setFullPrecisionInputAmount(null);
    }
  }, [evmConnectWalletChainId, isEvmConnected]);

  // Check if input amount exceeds user balance
  useEffect(() => {
    if (!displayedInputAmount || !currentInputBalance || parseFloat(displayedInputAmount) <= 0) {
      setExceedsUserBalance(false);
      return;
    }

    const inputFloat = parseFloat(displayedInputAmount);
    const balanceFloat = parseFloat(currentInputBalance);

    // For ETH, check if input exceeds balance minus gas cost
    const checkEthGasBalance = async () => {
      if (
        inputToken.ticker === "ETH" &&
        inputFloat > balanceFloat * 0.9 &&
        inputFloat <= balanceFloat
      ) {
        const gasCostEth = await fetchEthGasCost(evmConnectWalletChainId || 1);
        if (gasCostEth !== null) {
          const availableBalance = balanceFloat - gasCostEth;
          if (inputFloat > availableBalance) {
            setExceedsUserBalance(true);
            return true;
          }
        }
      }
      return false;
    };

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
          // ERC20 -> BTC: use input token price
          price = inputTokenPrice;
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
      // Even if input doesn't exceed balance, check if ETH exceeds available balance after gas
      checkEthGasBalance().then((exceeded) => {
        if (!exceeded) {
          setExceedsUserBalance(false);
        }
      });
    }
  }, [
    displayedInputAmount,
    currentInputBalance,
    isSwappingForBTC,
    liquidity.maxBTCLiquidityInUsd,
    liquidity.maxCbBTCLiquidityInUsd,
    inputToken,
    ethPrice,
    inputTokenPrice,
    btcPrice,
    evmConnectWalletChainId,
  ]);

  // Check if input/output amount exceeds market maker liquidity
  useEffect(() => {
    // Check based on which field user is editing
    if (lastEditedField === "input") {
      // For ERC20 -> BTC: Check if input exceeds MM liquidity
      if (isSwappingForBTC) {
        //   const maxBtcLiquiditySats = liquidity.maxBTCLiquidity;
        //   if (!maxBtcLiquiditySats || maxBtcLiquiditySats === "0") {
        //     setExceedsAvailableBTCLiquidity(false);
        //     return;
        //   }
        //   // Check input (ERC20 sent) - convert to USD and compare with MM liquidity in USD
        if (displayedInputAmount && parseFloat(displayedInputAmount) > 0 && currentInputBalance) {
          const inputFloat = parseFloat(displayedInputAmount);
          // If user has more than MM liquidity (in terms of what they can swap)
          // and they're trying to swap more than MM liquidity, show the error
          const price = inputTokenPrice;
          if (price && btcPrice) {
            const inputUsdValue = inputFloat * price;
            const mmLiquidityUsd = parseFloat(liquidity.maxBTCLiquidityInUsd);
            if (mmLiquidityUsd > 0 && inputUsdValue < mmLiquidityUsd) {
              setExceedsAvailableBTCLiquidity(false);
              return;
            }
          }
        }
        //   setExceedsAvailableBTCLiquidity(false);
        // } else {
        //   // BTC -> ERC20 (cbBTC): Check maxCbBTCLiquidity
        //   setExceedsAvailableBTCLiquidity(false);
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
    displayedInputAmount,
    outputAmount,
    lastEditedField,
    isSwappingForBTC,
    liquidity.maxBTCLiquidity,
    liquidity.maxCbBTCLiquidity,
    liquidity.maxBTCLiquidityInUsd,
    exceedsUserBalance,
    currentInputBalance,
    inputToken,
    ethPrice,
    inputTokenPrice,
    btcPrice,
  ]);

  // Check if input BTC amount exceeds cbBTC liquidity (BTC -> cbBTC direction)
  useEffect(() => {
    // Only check for BTC -> cbBTC direction
    if (isSwappingForBTC) {
      setExceedsAvailableCBBTCLiquidity(false);
      return;
    }

    if (!displayedInputAmount || parseFloat(displayedInputAmount) <= 0) {
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

    const inputFloat = parseFloat(displayedInputAmount);

    // BTC -> cbBTC: Check if input BTC exceeds maxCbBTCLiquidity
    const maxCbBtcLiquiditySats = liquidity.maxCbBTCLiquidity;
    if (maxCbBtcLiquiditySats && maxCbBtcLiquiditySats !== "0") {
      const maxCbBtcLiquidityBtc = Number(maxCbBtcLiquiditySats) / 100_000_000;

      if (inputFloat > maxCbBtcLiquidityBtc) {
        setExceedsAvailableCBBTCLiquidity(true);
      } else {
        setExceedsAvailableCBBTCLiquidity(false);
      }
    } else {
      setExceedsAvailableCBBTCLiquidity(false);
    }
  }, [
    displayedInputAmount,
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
      setOutputBelowMinimum(false);
      return;
    }

    // Skip check if user balance is already exceeded (takes priority)
    if (exceedsUserBalance) {
      setOutputBelowMinimum(false);
      return;
    }

    // Only show this error when user is editing the output field
    if (lastEditedField !== "output") {
      setOutputBelowMinimum(false);
      return;
    }

    // Check if output exists and is below minimum
    if (outputFloat < MIN_BTC) {
      setOutputBelowMinimum(true);
    } else {
      setOutputBelowMinimum(false);
    }
  }, [outputAmount, exceedsUserBalance, lastEditedField]);

  // Check if input amount would result in below minimum output
  // Only show this error when user is editing the INPUT field
  useEffect(() => {
    // Clear error if input is empty or zero
    const inputFloat = parseFloat(displayedInputAmount);
    if (!displayedInputAmount || !Number.isFinite(inputFloat) || inputFloat <= 0) {
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
      const price = inputTokenPrice;

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
    displayedInputAmount,
    exceedsUserBalance,
    isSwappingForBTC,
    inputToken,
    ethPrice,
    btcPrice,
    inputTokenPrice,
    lastEditedField,
    isAtAdjustedMax,
  ]);

  // Handle refetchQuote - fetch quote when refetchQuote is true
  useEffect(() => {
    if (!refetchQuote) return;

    const fetchAndExecute = async () => {
      try {
        // Increment request ID
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        // Fetch quote based on which field was last edited
        const isInput = lastEditedField === "input";
        const amount = isInput ? fullPrecisionInputAmount || displayedInputAmount : outputAmount;
        console.log(`refetching quote (${isInput ? "exact input" : "exact output"})`);
        await fetchQuote(isInput, amount, currentRequestId);
      } catch (error) {
        console.error("Failed to refetch quote:", error);
        // Reset refetchQuote even on error
        setRefetchQuote(false);
      }
    };

    fetchAndExecute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchQuote, lastEditedField, fullPrecisionInputAmount, displayedInputAmount, outputAmount]);

  // Auto-refetch quotes when prices become available (simplified)
  // The new SDK will handle this internally, so this is a placeholder

  // Save swap state to cookies whenever tokens change
  useEffect(() => {
    // Skip saving during initial mount while we're loading from cookie
    if (isInitialMountRef.current) return;

    // Save current state to cookie
    saveSwapStateToCookie({
      inputToken,
      outputToken,
    });
  }, [inputToken, outputToken]);

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
          h="150px"
          border="2px solid"
          borderColor={inputStyle?.bg_color || "#255283"}
          borderRadius="16px"
        >
          <Flex direction="column" py="12px" px="8px" justify="space-between" h="100%">
            {/* Label at top */}
            <Text
              color={!displayedInputAmount ? colors.offWhite : colors.textGray}
              fontSize="14px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              userSelect="none"
            >
              You Send
            </Text>

            {/* Amount input centered */}
            {isLoadingQuote && !getQuoteForInputRef.current ? (
              <Flex align="center" ml="-5px">
                <Spinner size="lg" color={inputStyle?.border_color_light || colors.textGray} />
              </Flex>
            ) : (
              <Input
                value={displayedInputAmount}
                onChange={(e) => handleInputOrOutputChange(e, true)}
                onKeyDown={(e) => handleKeyDown(e, true)}
                fontFamily="Aux"
                border="none"
                bg="transparent"
                outline="none"
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
                fontSize={isMobile ? "35px" : "46px"}
                placeholder="0.0"
                _placeholder={{
                  color: inputStyle?.light_text_color || "#4A90E2",
                }}
                disabled={isOtcServerDead}
                cursor={isOtcServerDead ? "not-allowed" : "text"}
                opacity={isOtcServerDead ? 0.5 : 1}
              />
            )}

            {/* USD value / errors at bottom */}
            <Flex>
              {exceedsUserBalance &&
              (inputToken.ticker === "ETH" || !isSwappingForBTC) &&
              currentInputBalance &&
              parseFloat(displayedInputAmount) <= parseFloat(currentInputBalance) ? (
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
                    {!isSwappingForBTC ? "Need BTC for fees -" : "Need ETH for gas -"}
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml="8px"
                    color={inputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleMaxClick}
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    MAX
                  </Text>
                </>
              ) : exceedsAvailableBTCLiquidity &&
                isSwappingForBTC &&
                lastEditedField === "input" ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {isMobile ? "" : "Exceeds available liquidity - "}
                  </Text>

                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
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
                    {isMobile ? "" : "Exceeds available liquidity - "}
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
                    color={inputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleOutputMaxClick}
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
                  {isMobile ? undefined : (
                    <Text
                      color={colors.redHover}
                      fontSize="13px"
                      mt="6px"
                      letterSpacing="-1.5px"
                      fontWeight="normal"
                      fontFamily="Aux"
                    >
                      Below minimum swap -
                    </Text>
                  )}
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
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
                <Flex direction="row" align="center" gap="6px" mt="6px">
                  {isMobile && exceedsUserBalance ? undefined : (
                    <Text
                      color={!displayedInputAmount ? colors.offWhite : colors.textGray}
                      fontSize="14px"
                      letterSpacing={
                        isLoadingQuote && !getQuoteForInputRef.current ? "-4px" : "-1px"
                      }
                      fontWeight="normal"
                      fontFamily="Aux"
                    >
                      {isLoadingQuote && !getQuoteForInputRef.current ? "..." : inputUsdValue}
                    </Text>
                  )}
                  {exceedsUserBalance && (
                    <>
                      <Text
                        color={colors.redHover}
                        fontSize="13px"
                        letterSpacing="-1px"
                        fontWeight="normal"
                        fontFamily="Aux"
                      >
                        {isMobile ? "Exceeds balance" : "- Exceeds balance"}
                      </Text>
                      {parseFloat(currentInputBalance || "0") > 0 && (
                        <Text
                          color={colors.redHover}
                          fontSize="13px"
                          letterSpacing="-1px"
                          fontWeight="normal"
                          fontFamily="Aux"
                        >
                          -
                        </Text>
                      )}
                      {parseFloat(currentInputBalance || "0") > 0 && (
                        <Text
                          color={inputStyle?.border_color_light || colors.textGray}
                          fontSize="14px"
                          letterSpacing="-1px"
                          // fontWeight="bold"
                          fontFamily="Aux"
                          cursor="pointer"
                          onClick={handleMaxClick}
                          _hover={{ textDecoration: "underline" }}
                        >
                          MAX
                        </Text>
                      )}
                    </>
                  )}
                </Flex>
              )}
            </Flex>
          </Flex>

          <Spacer />
          <Flex
            mr="8px"
            py="12px"
            direction="column"
            align="flex-end"
            justify="space-between"
            h="100%"
            flexShrink={0}
          >
            {/* Address Selector at top */}
            <AddressSelector
              chainType={isSwappingForBTC ? "EVM" : "BTC"}
              selectedAddress={selectedInputAddress}
              onSelect={setSelectedInputAddress}
              showPasteOption={false}
            />
            {/* Token Selector centered */}
            <WebAssetTag
              cursor="pointer"
              asset={inputAssetIdentifier}
              onDropDown={() => openAssetSelector("input")}
            />
            {/* Balance + MAX button at bottom */}
            <Flex
              direction="row"
              justify="flex-end"
              align="center"
              gap="8px"
              h="21px"
              whiteSpace="nowrap"
            >
              {currentInputBalance && currentInputTicker && parseFloat(currentInputBalance) > 0 && (
                <>
                  <Text
                    color={exceedsUserBalance ? colors.redHover : colors.textGray}
                    fontSize="14px"
                    letterSpacing="-1px"
                    fontWeight="normal"
                    fontFamily="Aux"
                    userSelect="none"
                    whiteSpace="nowrap"
                  >
                    {currentInputBalance.slice(0, 8)} {currentInputTicker}
                  </Text>
                  <Tooltip
                    show={showMaxTooltip && (inputToken.ticker === "ETH" || !isSwappingForBTC)}
                    onMouseEnter={() => setShowMaxTooltip(true)}
                    onMouseLeave={() => setShowMaxTooltip(false)}
                    hoverText={
                      !isSwappingForBTC
                        ? "Max excludes BTC for network fee"
                        : "Max excludes ETH for gas"
                    }
                    body={
                      <Button
                        onClick={handleMaxClick}
                        size="xs"
                        h="21px"
                        px="8px"
                        bg={
                          !isSwappingForBTC
                            ? inputStyle?.dark_bg_color || "#291B0D"
                            : colors.swapBgColor
                        }
                        color={
                          !isSwappingForBTC
                            ? inputStyle?.border_color || "#FFA04C"
                            : colors.textGray
                        }
                        fontSize="12px"
                        fontWeight="bold"
                        fontFamily="Aux"
                        letterSpacing="-0.5px"
                        border="1px solid"
                        borderColor={
                          !isSwappingForBTC
                            ? inputStyle?.border_color || "#FFA04C"
                            : colors.swapBorderColor
                        }
                        borderRadius="8px"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          bg: !isSwappingForBTC
                            ? inputStyle?.bg_color || "#9B602F"
                            : colors.swapBorderColor,
                        }}
                        _active={{
                          transform: "scale(0.95)",
                        }}
                      >
                        MAX
                      </Button>
                    }
                  />
                </>
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
          _hover={{ bg: "#242424" }}
          onClick={handleSwapReverse}
          bg="#161616"
          border="2px solid #323232"
          mt="-16px"
          mb="-20px"
          position="relative"
          transition="background 0.2s ease-in-out"
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
          h="150px"
          border="2px solid"
          borderColor={outputStyle?.bg_color || "#78491F"}
          borderRadius="16px"
        >
          <Flex direction="column" py="12px" px="8px" justify="space-between" h="100%">
            {/* Label at top */}
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

            {/* Amount input centered */}
            {isLoadingQuote && getQuoteForInputRef.current ? (
              <Flex align="center" ml="-5px">
                <Spinner size="lg" color={outputStyle?.border_color_light || colors.textGray} />
              </Flex>
            ) : (
              <Input
                value={outputAmount}
                readOnly
                fontFamily="Aux"
                border="none"
                bg="transparent"
                outline="none"
                mr="-150px"
                ml="-5px"
                p="0px"
                letterSpacing="-6px"
                color={outputBelowMinimum ? colors.red : colors.offWhite}
                _active={{ border: "none", boxShadow: "none", outline: "none" }}
                _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                _selected={{
                  border: "none",
                  boxShadow: "none",
                  outline: "none",
                }}
                fontSize={isMobile ? "35px" : "46px"}
                placeholder="0.0"
                _placeholder={{
                  color: outputStyle?.light_text_color || "#805530",
                }}
                disabled={isOtcServerDead}
                cursor={isOtcServerDead ? "not-allowed" : "not-allowed"}
                opacity={isOtcServerDead ? 0.5 : 1}
              />
            )}

            {/* USD value / errors at bottom */}
            <Flex>
              {exceedsAvailableBTCLiquidity && lastEditedField === "output" ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {isMobile ? "" : "Exceeds available liquidity - "}
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
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
              ) : outputBelowMinimum ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {isMobile ? "" : "Below minimum output -"}
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
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
                <Flex direction="row" align="center" gap="6px" mt="6px">
                  <Text
                    color={!outputAmount ? colors.offWhite : colors.textGray}
                    fontSize="14px"
                    letterSpacing={isLoadingQuote && getQuoteForInputRef.current ? "-4px" : "-1px"}
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {isLoadingQuote && getQuoteForInputRef.current ? "..." : outputUsdValue}
                  </Text>
                  {(() => {
                    if (isLoadingQuote && getQuoteForInputRef.current) return null;
                    const impact = calculatePriceImpact(inputUsdValue, outputUsdValue);
                    if (!impact) return null;
                    return (
                      <Text
                        fontSize="13px"
                        letterSpacing="-1px"
                        fontWeight="normal"
                        fontFamily="Aux"
                        color={impact.percent < 0 ? colors.textGray : colors.greenOutline}
                      >
                        ({impact.display})
                      </Text>
                    );
                  })()}
                </Flex>
              )}
            </Flex>
          </Flex>

          <Spacer />
          <Flex
            mr="8px"
            py="12px"
            direction="column"
            align="flex-end"
            justify="space-between"
            h="100%"
            flexShrink={0}
          >
            {/* Address Selector at top */}
            {isSwappingForBTC ? (
              // EVM → BTC: Show BTC address selector with paste option
              <AddressSelector
                chainType="BTC"
                selectedAddress={selectedOutputAddress}
                onSelect={setSelectedOutputAddress}
                onPasteAddress={() => {
                  setPasteModalType("BTC");
                  setIsPasteModalOpen(true);
                }}
                showPasteOption={true}
              />
            ) : (
              // BTC → EVM: Show EVM address selector with paste option
              <AddressSelector
                chainType="EVM"
                selectedAddress={selectedOutputAddress}
                onSelect={setSelectedOutputAddress}
                onPasteAddress={() => {
                  setPasteModalType("EVM");
                  setIsPasteModalOpen(true);
                }}
                showPasteOption={true}
              />
            )}
            {/* Asset tag centered */}
            <WebAssetTag
              cursor="pointer"
              asset={outputAssetIdentifier}
              onDropDown={() => openAssetSelector("output")}
              isOutput={true}
            />
            {/* Output balance display */}
            <Flex direction="row" align="center" gap="8px" h="21px" whiteSpace="nowrap">
              {currentOutputBalance &&
                currentOutputTicker &&
                parseFloat(currentOutputBalance) > 0 && (
                  <Text
                    color={colors.textGray}
                    fontSize="14px"
                    letterSpacing="-1px"
                    fontWeight="normal"
                    fontFamily="Aux"
                    userSelect="none"
                    whiteSpace="nowrap"
                  >
                    {currentOutputBalance.slice(0, 8)} {currentOutputTicker}
                  </Text>
                )}
            </Flex>
          </Flex>
        </Flex>

        {/* Paste Address Modal */}
        <PasteAddressModal
          isOpen={isPasteModalOpen}
          onClose={() => setIsPasteModalOpen(false)}
          addressType={pasteModalType}
          onConfirm={(address) => {
            setSelectedOutputAddress(address);
          }}
        />

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
              displayedInputAmount,
              outputAmount,
              ethPrice,
              btcPrice,
              isSwappingForBTC ? inputTokenPrice : outputTokenPrice,
              isSwappingForBTC ? inputToken.ticker : outputToken?.ticker || "CBBTC"
            )}
          </Text>
          <Spacer />
          <Flex
            color={colors.textGray}
            fontSize="13px"
            mr="3px"
            letterSpacing="-1.5px"
            fontWeight="normal"
            fontFamily="Helvetica"
          >
            <Tooltip
              show={showFeeTooltip && !!feeOverview}
              onMouseEnter={() => setShowFeeTooltip(true)}
              onMouseLeave={() => setShowFeeTooltip(false)}
              width="145px"
              hoverText={
                feeOverview ? (
                  <>
                    {[
                      { key: "protocol", ...feeOverview.protocolFee },
                      { key: "network", ...feeOverview.networkFee },
                    ]
                      .filter((fee) => fee.fee !== "$0.00")
                      .map((fee) => (
                        <Flex key={fee.key} justify="space-between" w="100%">
                          <Text fontFamily="Monospace">{fee.description}:</Text>
                          <Text fontFamily="Monospace">{fee.fee}</Text>
                        </Flex>
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
      </Flex>

      {/* Asset Selector Modal */}
      <AssetSelectorModal
        isOpen={isAssetSelectorOpen}
        onClose={closeAssetSelector}
        currentAsset={inputAssetIdentifier}
        direction={assetSelectorDirection}
      />
    </Flex>
  );
};
