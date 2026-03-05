import { Flex, Text, Input, Spacer, Button, Spinner } from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef, useMemo } from "react";
import { useSwitchNetwork, useSwitchWallet, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import { Currencies, createCurrency, QuoteParameters } from "@riftresearch/sdk";
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
  btcToSats,
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

// Calculate minimum BTC amount once
const MIN_BTC = parseFloat(satsToBtc(MIN_SWAP_SATS));
const MIN_SWAP_SATS_BIGINT = BigInt(MIN_SWAP_SATS);

const isBtcLikeTicker = (ticker: string): boolean => ticker === "BTC" || ticker === "cbBTC";

const isBelowMinBtcAmount = (amount: string): boolean => {
  if (!amount) return false;
  const normalizedAmount = amount.startsWith(".") ? `0${amount}` : amount;
  try {
    return btcToSats(normalizedAmount) < MIN_SWAP_SATS_BIGINT;
  } catch {
    return false;
  }
};

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
  const primaryEvmAddress = useStore((state) => state.primaryEvmAddress);
  const setPrimaryEvmAddress = useStore((state) => state.setPrimaryEvmAddress);
  const outputEvmAddress = useStore((state) => state.outputEvmAddress);
  const btcAddress = useStore((state) => state.btcAddress);
  const setBtcAddress = useStore((state) => state.setBtcAddress);
  const pastedBTCAddress = useStore((state) => state.pastedBTCAddress);
  const setPastedBTCAddress = useStore((state) => state.setPastedBTCAddress);
  const setOutputEvmAddress = useStore((state) => state.setOutputEvmAddress);
  const isEvmConnected = !!primaryEvmAddress;

  const switchWallet = useSwitchWallet();
  const switchNetwork = useSwitchNetwork();
  const userWallets = useUserWallets();

  // Get all EVM wallet addresses (memoized)
  const evmWalletAddresses = useMemo(
    () =>
      userWallets
        .filter((w) => w.chain?.toUpperCase() === "EVM")
        .map((w) => w.address.toLowerCase()),
    [userWallets]
  );

  // Rift SDK from store
  const rift = useStore((state) => state.rift);
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
  const [adjustedInputBalance, setAdjustedInputBalance] = useState<string | null>(null);
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
  const quoteContextVersionRef = useRef(0);
  const approvalDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);
  const hasLoadedFromCookieRef = useRef(false);

  // Global store
  const {
    inputToken,
    outputToken,
    userTokensByWallet,
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
    exceedsAvailableLiquidity,
    setExceedsAvailableLiquidity,
    maxAvailableLiquidity,
    setMaxAvailableLiquidity,
    refetchQuote,
    setRefetchQuote,
    setIsAwaitingOptimalQuote,
    hasNoRoutesError,
    switchingToInputTokenChain,
    isSwapInProgress,
  } = useStore();

  // State for paste address modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalType, setPasteModalType] = useState<"EVM" | "BTC">("BTC");

  // Derive swap direction from token chains
  const isSwappingForBTC = outputToken.chain === "bitcoin";
  const isOutputFieldLocked =
    inputToken.chain === "bitcoin" && outputToken.ticker.toLowerCase() !== "cbbtc";
  const canEditOutputField = !isOutputFieldLocked;

  // Derive EVM chain ID from input token (default to Ethereum mainnet)
  const evmConnectWalletChainId = inputToken.chain === "bitcoin" ? 1 : inputToken.chain;

  // Aggregate tokens from ALL connected EVM wallets for balance lookup
  // This ensures we find tokens regardless of which wallet they're in
  const aggregatedTokens = useMemo(() => {
    const tokens: TokenData[] = [];
    for (const addr of evmWalletAddresses) {
      const walletTokens = userTokensByWallet[addr];
      if (walletTokens) {
        tokens.push(...Object.values(walletTokens).flat());
      }
    }
    // Deduplicate and sum balances for same token across wallets
    const tokenMap = new Map<string, TokenData>();
    for (const t of tokens) {
      const key = `${t.chain}-${t.address.toLowerCase()}`;
      if (tokenMap.has(key)) {
        const existing = tokenMap.get(key)!;
        const existingBalance = parseFloat(existing.balance) || 0;
        const newBalance = parseFloat(t.balance) || 0;
        const totalBalance = existingBalance + newBalance;
        const existingUsd = parseFloat(existing.usdValue.replace("$", "").replace(",", "")) || 0;
        const newUsd = parseFloat(t.usdValue.replace("$", "").replace(",", "")) || 0;
        const totalUsd = existingUsd + newUsd;
        tokenMap.set(key, {
          ...existing,
          balance: totalBalance.toString(),
          usdValue: `$${totalUsd.toFixed(2)}`,
        });
      } else {
        tokenMap.set(key, t);
      }
    }
    return Array.from(tokenMap.values());
  }, [evmWalletAddresses, userTokensByWallet]);

  // Get tokens ONLY from the selected input wallet (for Max button balance)
  // This prevents showing combined balances from all wallets
  const selectedWalletTokens = useMemo(() => {
    if (!primaryEvmAddress) return [];
    const walletTokens = userTokensByWallet[primaryEvmAddress.toLowerCase()];
    if (!walletTokens) return [];
    return Object.values(walletTokens).flat();
  }, [primaryEvmAddress, userTokensByWallet]);

  // Fetch Bitcoin balance whenever a BTC wallet is connected
  const { balanceBtc: btcBalanceBtc, isLoading: isBtcBalanceLoading } =
    useBitcoinBalance(btcAddress);

  const resolvedInputAddress = inputToken.chain === "bitcoin" ? btcAddress : primaryEvmAddress;
  const resolvedOutputAddress =
    outputToken.chain === "bitcoin"
      ? pastedBTCAddress || btcAddress
      : inputToken.chain === "bitcoin"
        ? outputEvmAddress || primaryEvmAddress
        : primaryEvmAddress;

  useEffect(() => {
    if (outputToken.chain !== "bitcoin" && pastedBTCAddress) {
      setPastedBTCAddress(null);
    }
  }, [outputToken.chain, pastedBTCAddress, setPastedBTCAddress]);

  const selectEvmWallet = useCallback(
    async (address: string, targetChainId?: number) => {
      const wallet = userWallets.find(
        (candidate) =>
          candidate.chain?.toUpperCase() === "EVM" &&
          candidate.address.toLowerCase() === address.toLowerCase()
      );
      if (!wallet) return false;

      try {
        await switchWallet(wallet.id);
        setPrimaryEvmAddress(wallet.address);
        if (targetChainId !== undefined) {
          const currentNetwork = Number(await wallet.getNetwork());
          if (currentNetwork !== targetChainId) {
            await switchNetwork({ wallet, network: targetChainId });
          }
        }
        return true;
      } catch (error) {
        console.error("[SwapInputAndOutput] Failed to select EVM wallet:", error);
        return false;
      }
    },
    [setPrimaryEvmAddress, switchNetwork, switchWallet, userWallets]
  );

  const handleInputAddressSelect = useCallback(
    async (address: string | null) => {
      if (!address) return;
      if (inputToken.chain === "bitcoin") {
        setBtcAddress(address);
        return;
      }
      await selectEvmWallet(address, inputToken.chain);
    },
    [inputToken.chain, selectEvmWallet, setBtcAddress]
  );

  const handleOutputAddressSelect = useCallback(
    async (address: string | null) => {
      if (!address) return;

      if (outputToken.chain === "bitcoin") {
        if (!validatePayoutAddress(address, true).isValid) return;
        setPastedBTCAddress(null);
        setBtcAddress(address);
        return;
      }

      if (inputToken.chain === "bitcoin") {
        if (!validatePayoutAddress(address, false).isValid) return;
        setOutputEvmAddress(address);
        return;
      }

      await selectEvmWallet(address, inputToken.chain);
    },
    [
      inputToken.chain,
      outputToken.chain,
      selectEvmWallet,
      setBtcAddress,
      setOutputEvmAddress,
      setPastedBTCAddress,
    ]
  );

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

      const belowMinInput = isInput && inputToken.ticker === "BTC" && isBelowMinBtcAmount(amount);
      const belowMinOutput =
        !isInput && isBtcLikeTicker(outputToken.ticker) && isBelowMinBtcAmount(amount);

      if (belowMinInput) {
        setOutputAmount("");
        setOutputUsdValue(ZERO_USD_DISPLAY);
        setInputBelowMinimum(true);
        setIsLoadingQuote(false);
        setRefetchQuote(false);
        return;
      }

      if (belowMinOutput) {
        setDisplayedInputAmount("");
        setInputUsdValue(ZERO_USD_DISPLAY);
        setOutputBelowMinimum(true);
        setIsLoadingQuote(false);
        setRefetchQuote(false);
        return;
      }

      setIsLoadingQuote(true);
      setExceedsAvailableLiquidity(false);
      setMaxAvailableLiquidity(null);
      const startContextVersion = quoteContextVersionRef.current;

      try {
        // Build from/to currencies
        const fromCurrency = toSdkCurrency(inputToken);
        const toCurrency = toSdkCurrency(outputToken);

        // Normalize amount with token decimals (e.g. "1" USDC -> "1000000")
        const decimals = isInput ? inputToken.decimals : outputToken.decimals;
        const normalizedAmount = parseUnits(amount, decimals).toString();

        // Call SDK getQuote
        const quoteRequest: QuoteParameters = {
          from: fromCurrency,
          to: toCurrency,
          amount: normalizedAmount,
          mode: isInput ? "exact_input" : "exact_output",
          slippageBps: useStore.getState().slippageBips || 100,
        };
        console.log("[fetchQuote] quoteRequest", quoteRequest);
        const { quote, executeSwap } = await rift.getQuote(quoteRequest);

        console.log("[fetchQuote] quote", quote);

        if (startContextVersion !== quoteContextVersionRef.current) {
          console.log("[fetchQuote] Ignoring stale quote response after token change");
          return;
        }

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
          } else if (quote.fees?.preswap) {
            // ERC20-to-ERC20 swap (no BTC involved) — only preswap + totalUsd
            setFeeOverview({
              gasFee: { fee: "$0.00", description: "Gas Fee" },
              riftFee: { fee: "$0.00", description: "Rift Fee" },
              totalFees: `$${quote.fees.totalUsd.toFixed(2)}`,
            });
          }

          // Store executeSwap for later use by SwapButton
          setExecuteSwap(executeSwap);

          // Update displayed amounts from quote (convert raw values to human-readable)
          if (isInput && quote.to?.expected) {
            setOutputAmount(formatUnits(BigInt(quote.to.expected), outputToken.decimals));
          } else if (!isInput && quote.from?.expected) {
            setDisplayedInputAmount(formatUnits(BigInt(quote.from.expected), inputToken.decimals));
          }
        }
      } catch (error) {
        if (startContextVersion !== quoteContextVersionRef.current) {
          console.log("[fetchQuote] Ignoring stale quote error after token change");
          return;
        }
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          console.log("[fetchQuote] Ignoring stale quote error", requestId);
          return;
        }

        console.error("[fetchQuote] Error fetching quote:", error);
        setQuote(null);
        setExecuteSwap(null);

        // Zero out the non-last-edited field on any quote error
        if (isInput) {
          setOutputAmount("");
          setOutputUsdValue(ZERO_USD_DISPLAY);
        } else {
          setDisplayedInputAmount("");
          setInputUsdValue(ZERO_USD_DISPLAY);
        }

        // Parse insufficient liquidity errors from market maker
        const errorMessage = error instanceof Error ? error.message : String(error);
        const liquidityMatch = errorMessage.match(
          /Insufficient liquidity: requires \d+ but max available is (\d+)/
        );
        if (liquidityMatch) {
          const maxAvailable = Number(liquidityMatch[1]);
          if (outputToken.chain === "bitcoin") {
            // Output is BTC: apply safety haircut to avoid near-boundary failures
            setMaxAvailableLiquidity(Math.floor(maxAvailable * 0.995).toString());
          } else {
            // Input is BTC: use 99.9%, will set as input
            setMaxAvailableLiquidity(Math.floor(maxAvailable * 0.999).toString());
          }
          setExceedsAvailableLiquidity(true);
        }

        // DEX quote failure = not enough DEX liquidity
        if (errorMessage.includes("DEX quote failed")) {
          setExceedsAvailableLiquidity(true);
        }
      } finally {
        if (
          startContextVersion === quoteContextVersionRef.current &&
          (requestId === undefined || requestId === quoteRequestIdRef.current)
        ) {
          setIsLoadingQuote(false);
          setRefetchQuote(false);
        }
      }
    },
    [
      rift,
      inputToken,
      outputToken,
      toSdkCurrency,
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
    setPastedBTCAddress(null);
    setHasStartedTyping(false);
    setExceedsAvailableLiquidity(false);
    setMaxAvailableLiquidity(null);
  };

  const getDirectionLiquidity = () => {
    const maxLiquiditySats = isSwappingForBTC
      ? liquidity.maxBTCLiquidity
      : liquidity.maxCbBTCLiquidity;
    const maxLiquidityUsd = parseFloat(
      isSwappingForBTC ? liquidity.maxBTCLiquidityInUsd : liquidity.maxCbBTCLiquidityInUsd
    );
    return { maxLiquiditySats, maxLiquidityUsd };
  };

  const clearLiquidityErrorState = () => {
    setExceedsAvailableLiquidity(false);
    setMaxAvailableLiquidity(null);
    setExceedsAvailableBTCLiquidity(false);
    setExceedsAvailableCBBTCLiquidity(false);
  };

  const setAmountAndFetchQuote = (targetField: "input" | "output", amount: string) => {
    if (targetField === "output" && !canEditOutputField) return;
    if (!amount || parseFloat(amount) <= 0) return;

    const quoteForInput = targetField === "input";
    getQuoteForInputRef.current = quoteForInput;

    if (quoteDebounceTimerRef.current) clearTimeout(quoteDebounceTimerRef.current);
    if (outputQuoteDebounceTimerRef.current) clearTimeout(outputQuoteDebounceTimerRef.current);

    setIsAtAdjustedMax(false);
    setHasStartedTyping(true);
    setLastEditedField(targetField);
    setQuote(null);
    setFeeOverview(null);
    setExceedsUserBalance(false);
    setInputBelowMinimum(false);
    setOutputBelowMinimum(false);
    clearLiquidityErrorState();

    let quoteAmount = amount;

    if (targetField === "input") {
      setDisplayedInputAmount(truncateAmount(amount));
      setFullPrecisionInputAmount(amount);
      const usdValue = calculateUsdValue(
        amount,
        inputToken.ticker,
        ethPrice,
        btcPrice,
        inputTokenPrice
      );
      setInputUsdValue(usdValue);
    } else {
      const outputAmountForDisplay = truncateAmount(amount);
      setOutputAmount(outputAmountForDisplay);
      setFullPrecisionInputAmount(null);
      const usdValue = calculateUsdValue(
        outputAmountForDisplay,
        outputToken.ticker,
        ethPrice,
        btcPrice,
        outputTokenPrice
      );
      setOutputUsdValue(usdValue);
      quoteAmount = outputAmountForDisplay;
    }

    if (quoteForInput && inputToken.ticker === "BTC" && isBelowMinBtcAmount(quoteAmount)) {
      setInputBelowMinimum(true);
      setOutputAmount("");
      setOutputUsdValue(ZERO_USD_DISPLAY);
      setIsLoadingQuote(false);
      return;
    }

    if (!quoteForInput && isBtcLikeTicker(outputToken.ticker) && isBelowMinBtcAmount(quoteAmount)) {
      setOutputBelowMinimum(true);
      setDisplayedInputAmount("");
      setInputUsdValue(ZERO_USD_DISPLAY);
      setIsLoadingQuote(false);
      return;
    }

    setIsLoadingQuote(true);

    quoteRequestIdRef.current += 1;
    const currentRequestId = quoteRequestIdRef.current;
    fetchQuote(quoteForInput, quoteAmount, currentRequestId);
  };

  const handleLiquidityMaxClick = () => {
    if (!maxAvailableLiquidity) return;
    let formattedMax: string;
    try {
      formattedMax = formatUnits(BigInt(maxAvailableLiquidity), 8);
    } catch {
      return;
    }
    const targetField = isSwappingForBTC ? "output" : "input";
    setAmountAndFetchQuote(targetField, formattedMax);
  };

  const handleInputOrOutputChange = (e: ChangeEvent<HTMLInputElement>, isInput: boolean) => {
    if (!isInput && !canEditOutputField) return;

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
      getQuoteForInputRef.current = isInput;
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

      // Clear existing quotes and liquidity error when user types
      setQuote(null);
      setFeeOverview(null);
      clearLiquidityErrorState();

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

      // Pre-check MM liquidity before fetching quotes to avoid spinner flicker
      // and unnecessary requests
      if (isInput && value && parseFloat(value) > 0) {
        const { maxLiquiditySats, maxLiquidityUsd } = getDirectionLiquidity();
        const maxLiquiditySatsBigInt = BigInt(maxLiquiditySats || "0");
        const inputUsd = parseFloat(usdValue.replace(/[$,]/g, ""));
        const hasLiquidityCap = Number.isFinite(maxLiquidityUsd) && maxLiquidityUsd > 0;

        if (
          hasLiquidityCap &&
          maxLiquiditySatsBigInt > 0n &&
          Number.isFinite(inputUsd) &&
          inputUsd > maxLiquidityUsd
        ) {
          // Keep a safety buffer so suggested max avoids boundary failures
          const maxForCta =
            outputToken.chain === "bitcoin"
              ? (maxLiquiditySatsBigInt * 995n) / 1000n
              : (maxLiquiditySatsBigInt * 999n) / 1000n;

          setMaxAvailableLiquidity(maxForCta.toString());
          setExceedsAvailableLiquidity(true);
          setExceedsUserBalance(false);
          setOutputAmount("");
          setOutputUsdValue(ZERO_USD_DISPLAY);
          setIsLoadingQuote(false);
          quoteRequestIdRef.current += 1;
          return;
        }
      }

      // Set up debounced quote fetch
      const shouldFetchQuote = isInput
        ? value && parseFloat(value) > 0 && getQuoteForInputRef.current && !hasNoRoutesError
        : value && parseFloat(value) > 0 && !getQuoteForInputRef.current && canEditOutputField;

      if (shouldFetchQuote) {
        if (isInput && inputToken.ticker === "BTC") {
          if (isBelowMinBtcAmount(value)) {
            // Don't fetch quote if below minimum BTC input
            setInputBelowMinimum(true);
            setOutputAmount("");
            setOutputUsdValue(ZERO_USD_DISPLAY);
            setIsLoadingQuote(false);
            return;
          }
          setInputBelowMinimum(false);
        }

        if (!isInput && isBtcLikeTicker(outputToken.ticker) && isBelowMinBtcAmount(value)) {
          // Don't fetch quote if below minimum BTC-like output
          setOutputBelowMinimum(true);
          setDisplayedInputAmount("");
          setInputUsdValue(ZERO_USD_DISPLAY);
          setIsLoadingQuote(false);
          return;
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
    if (!isInput && !canEditOutputField) return;

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
      clearLiquidityErrorState();
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
    clearLiquidityErrorState();

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

    // Use pre-calculated gas-adjusted balance for ETH/BTC
    // This ensures consistency with the displayed balance next to Max button
    if (inputToken.ticker === "ETH" || inputToken.ticker === "BTC") {
      if (adjustedInputBalance && adjustedInputBalance !== currentInputBalance) {
        adjustedInputAmount = adjustedInputBalance;
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
    if (!canEditOutputField) return;

    // Determine the max liquidity based on swap direction
    let maxLiquidityBtc: number;
    if (isSwappingForBTC) {
      // ERC20 -> BTC: Use maxBTCLiquidity
      const maxBtcLiquiditySats = liquidity.maxBTCLiquidity;
      maxLiquidityBtc = Number(maxBtcLiquiditySats) / 100_000_000; // Convert satoshis to BTC
      maxLiquidityBtc *= 0.995; // Safety haircut to avoid near-boundary insufficient liquidity errors
    } else {
      // BTC -> ERC20 (cbBTC): Use maxCbBTCLiquidity
      const maxCbBtcLiquiditySats = liquidity.maxCbBTCLiquidity;
      maxLiquidityBtc = Number(maxCbBtcLiquiditySats) / 100_000_000; // Convert satoshis to BTC
    }

    const maxOutputAmount = maxLiquidityBtc.toString();

    // Limit to 8 decimal places for display
    const truncatedOutputAmount = truncateAmount(maxOutputAmount);

    setAmountAndFetchQuote("output", truncatedOutputAmount);
  };

  const handleMinimumOutputClick = () => {
    if (!canEditOutputField) return;
    setAmountAndFetchQuote("output", MIN_BTC.toString());
  };

  const handleMinimumInputClick = () => {
    setAmountAndFetchQuote("input", MIN_BTC.toString());
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
  }, [setDisplayedInputAmount, setOutputAmount, setInputUsdValue, setOutputUsdValue]);

  useEffect(() => {
    if (canEditOutputField) return;
    if (lastEditedField !== "output") return;

    setLastEditedField("input");
    getQuoteForInputRef.current = true;
    setOutputAmount("");
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setOutputBelowMinimum(false);
    setExceedsAvailableLiquidity(false);
    setMaxAvailableLiquidity(null);
  }, [
    canEditOutputField,
    lastEditedField,
    setOutputAmount,
    setOutputUsdValue,
    setExceedsAvailableLiquidity,
    setMaxAvailableLiquidity,
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
  }, [setInputToken, evmConnectWalletChainId, inputToken, switchingToInputTokenChain]);

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

  // Auto-refresh quote every 10 seconds when user has entered an amount
  useEffect(() => {
    // Clear any existing interval
    if (quoteRefreshIntervalRef.current) {
      clearInterval(quoteRefreshIntervalRef.current);
      quoteRefreshIntervalRef.current = null;
    }

    // Only set up auto-refresh if conditions are met, we have a quote, and no swap is in progress
    if (
      displayedInputAmount &&
      parseFloat(displayedInputAmount) > 0 &&
      primaryEvmAddress &&
      quote &&
      !isSwapInProgress
    ) {
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
  }, [
    displayedInputAmount,
    fullPrecisionInputAmount,
    outputAmount,
    primaryEvmAddress,
    quote,
    fetchQuote,
    isSwapInProgress,
  ]);

  // Update current input balance when wallet connection or token selection changes
  useEffect(() => {
    // Handle BTC input (BTC -> EVM swap direction)
    if (inputAssetIdentifier === "BTC") {
      if (btcAddress && btcBalanceBtc > 0) {
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

    if (!inputToken) {
      setCurrentInputBalance(null);
      setCurrentInputTicker(null);
      return;
    }

    // Look up balance from SELECTED WALLET ONLY (not aggregated across all wallets)
    // This ensures Max button shows only what's available in the selected input wallet
    const matchingToken = selectedWalletTokens.find(
      (t) =>
        t.address.toLowerCase() === inputToken.address.toLowerCase() &&
        t.chain === inputToken.chain
    );
    
    // Only use the selected wallet's balance - if token not found, user doesn't own it in this wallet
    const balance = matchingToken?.balance || "0";

    // Show balance (including "0") when wallet is connected
    setCurrentInputBalance(balance);
    setCurrentInputTicker(inputToken.ticker || null);
  }, [
    isEvmConnected,
    primaryEvmAddress,
    inputToken,
    selectedWalletTokens,
    inputAssetIdentifier,
    btcAddress,
    btcBalanceBtc,
  ]);

  // Pre-calculate gas-adjusted balance for display next to Max button
  // This ensures the displayed balance matches what will appear in input when Max is clicked
  useEffect(() => {
    const calculateAdjustedBalance = async () => {
      if (!currentInputBalance || parseFloat(currentInputBalance) <= 0) {
        setAdjustedInputBalance(null);
        return;
      }

      const balanceFloat = parseFloat(currentInputBalance);

      if (inputToken.ticker === "ETH") {
        const gasCostEth = await fetchEthGasCost(
          inputToken.chain === "bitcoin" ? 1 : (inputToken.chain ?? 1)
        );
        if (gasCostEth !== null && balanceFloat - gasCostEth > 0) {
          setAdjustedInputBalance((balanceFloat - gasCostEth).toString());
        } else {
          setAdjustedInputBalance(currentInputBalance);
        }
      } else if (inputToken.ticker === "BTC") {
        const feeRate = await getRecommendedFeeRate("medium");
        const estimatedSize = estimateTransactionSize(1, 2);
        const btcFeeReserveBtc = Math.ceil(feeRate * estimatedSize) / 100_000_000;
        if (balanceFloat - btcFeeReserveBtc > 0) {
          setAdjustedInputBalance((balanceFloat - btcFeeReserveBtc).toFixed(8));
        } else {
          setAdjustedInputBalance(currentInputBalance);
        }
      } else {
        // Non-native tokens don't need gas adjustment
        setAdjustedInputBalance(currentInputBalance);
      }
    };

    calculateAdjustedBalance();
  }, [currentInputBalance, inputToken.ticker, inputToken.chain]);

  // Update current output balance when wallet connection or token selection changes
  useEffect(() => {
    // Handle BTC output (EVM -> BTC swap direction)
    if (isSwappingForBTC) {
      const isConnectedDestination =
        !!resolvedOutputAddress &&
        !!btcAddress &&
        resolvedOutputAddress.toLowerCase() === btcAddress.toLowerCase();
      if (isConnectedDestination && btcBalanceBtc > 0) {
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

    if (!outputToken) {
      setCurrentOutputBalance(null);
      setCurrentOutputTicker(null);
      return;
    }

    // Look up balance from SELECTED WALLET ONLY (consistent with input balance)
    const matchingToken = selectedWalletTokens.find(
      (t) =>
        t.address.toLowerCase() === outputToken.address.toLowerCase() &&
        t.chain === outputToken.chain
    );
    
    // Only use the selected wallet's balance
    const balance = matchingToken?.balance || "0";

    // Show balance (including "0") when wallet is connected
    setCurrentOutputBalance(balance);
    setCurrentOutputTicker(outputToken.ticker || null);
  }, [
    isEvmConnected,
    primaryEvmAddress,
    outputToken,
    selectedWalletTokens,
    isSwappingForBTC,
    resolvedOutputAddress,
    btcAddress,
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

    if (exceedsAvailableLiquidity) {
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
          // If user's balance USD value >= MM liquidity USD, don't show this
          // error (defer to MM liquidity check)
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
    exceedsAvailableLiquidity,
  ]);

  // Check if output amount is below minimum swap amount
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

    // Skip check if liquidity is exceeded (takes priority)
    if (exceedsAvailableLiquidity) {
      setOutputBelowMinimum(false);
      return;
    }

    // Only show this error when user is editing the output field
    if (lastEditedField !== "output") {
      setOutputBelowMinimum(false);
      return;
    }

    // Check if output exists and is below minimum
    if (isBtcLikeTicker(outputToken.ticker) && isBelowMinBtcAmount(outputAmount)) {
      setOutputBelowMinimum(true);
    } else {
      setOutputBelowMinimum(false);
    }
  }, [
    outputAmount,
    outputToken.ticker,
    exceedsUserBalance,
    lastEditedField,
    exceedsAvailableLiquidity,
  ]);

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

    // Skip check if liquidity is exceeded (takes priority)
    if (exceedsAvailableLiquidity) {
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

    // For BTC input, enforce minimum directly on the entered BTC amount.
    if (inputToken.ticker === "BTC") {
      setInputBelowMinimum(isBelowMinBtcAmount(displayedInputAmount));
      return;
    }

    // Check 1: If output exists and is below minimum (user typed in input, got small output)
    // Also verify input is still > 0 (to handle React batched state updates)
    if (inputFloat > 0 && outputAmount && parseFloat(outputAmount) > 0) {
      if (isBtcLikeTicker(outputToken.ticker) && isBelowMinBtcAmount(outputAmount)) {
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
    outputToken.ticker,
    ethPrice,
    btcPrice,
    inputTokenPrice,
    lastEditedField,
    isAtAdjustedMax,
    exceedsAvailableLiquidity,
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
        const isInput = lastEditedField === "input" || !canEditOutputField;
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
  }, [
    refetchQuote,
    lastEditedField,
    fullPrecisionInputAmount,
    displayedInputAmount,
    outputAmount,
    canEditOutputField,
  ]);

  // Auto-refetch quotes when prices become available (simplified)
  // The new SDK will handle this internally, so this is a placeholder

  // Save swap state to cookies whenever tokens change
  useEffect(() => {
    // Invalidate any in-flight quote request when path changes.
    quoteContextVersionRef.current += 1;
    quoteRequestIdRef.current += 1;

    if (quoteDebounceTimerRef.current) clearTimeout(quoteDebounceTimerRef.current);
    if (outputQuoteDebounceTimerRef.current) clearTimeout(outputQuoteDebounceTimerRef.current);

    setIsLoadingQuote(false);
    setQuote(null);
    setExecuteSwap(null);
    setFeeOverview(null);
    setExceedsAvailableLiquidity(false);
    setMaxAvailableLiquidity(null);
  }, [
    inputToken,
    outputToken,
    setExecuteSwap,
    setFeeOverview,
    setQuote,
    setExceedsAvailableLiquidity,
    setMaxAvailableLiquidity,
  ]);

  useEffect(() => {
    const inputFloat = parseFloat(displayedInputAmount);
    const outputFloat = parseFloat(outputAmount);
    const inputIsEmptyOrZero =
      !displayedInputAmount || !Number.isFinite(inputFloat) || inputFloat <= 0;
    const outputIsEmptyOrZero = !outputAmount || !Number.isFinite(outputFloat) || outputFloat <= 0;

    if (inputIsEmptyOrZero && outputIsEmptyOrZero) {
      setExceedsAvailableLiquidity(false);
      setMaxAvailableLiquidity(null);
    }
  }, [displayedInputAmount, outputAmount, setExceedsAvailableLiquidity, setMaxAvailableLiquidity]);

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

  const formattedMaxLiquidity = useMemo(() => {
    if (!maxAvailableLiquidity) return null;
    try {
      return formatUnits(BigInt(maxAvailableLiquidity), 8);
    } catch {
      return null;
    }
  }, [maxAvailableLiquidity]);

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
                  exceedsAvailableLiquidity ||
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
              {exceedsAvailableLiquidity && lastEditedField === "input" ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {isMobile ? "" : `Exceeds max liquidity${formattedMaxLiquidity ? " - " : ""}`}
                  </Text>
                  {formattedMaxLiquidity && (
                    <Text
                      fontSize="13px"
                      mt="7px"
                      ml={isMobile ? "0px" : "8px"}
                      color={inputStyle?.border_color_light || colors.textGray}
                      cursor="pointer"
                      onClick={handleLiquidityMaxClick}
                      _hover={{ textDecoration: "underline" }}
                      letterSpacing="-1.5px"
                      fontWeight="normal"
                      fontFamily="Aux"
                    >
                      {`${formattedMaxLiquidity} BTC Max`}
                    </Text>
                  )}
                </>
              ) : exceedsUserBalance &&
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
                      Below min swap -
                    </Text>
                  )}
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
                    color={inputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={
                      inputToken.ticker === "BTC"
                        ? handleMinimumInputClick
                        : handleMinimumOutputClick
                    }
                    _hover={{ textDecoration: "underline" }}
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {(() => {
                      const ticker =
                        inputToken.ticker === "BTC" ? "BTC" : isSwappingForBTC ? "BTC" : "cbBTC";
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
              chainType={inputToken.chain === "bitcoin" ? "BTC" : "EVM"}
              selectedAddress={resolvedInputAddress}
              onSelect={(address) => {
                void handleInputAddressSelect(address);
              }}
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
              {currentInputBalance !== null && currentInputTicker && (
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
                    {(adjustedInputBalance || currentInputBalance).slice(0, 8)} {currentInputTicker}
                  </Text>
                  {parseFloat(currentInputBalance) > 0 && (
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
                  )}
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
                onChange={(e) => handleInputOrOutputChange(e, false)}
                onKeyDown={(e) => handleKeyDown(e, false)}
                fontFamily="Aux"
                border="none"
                bg="transparent"
                outline="none"
                mr="-150px"
                ml="-5px"
                p="0px"
                letterSpacing="-6px"
                color={
                  outputBelowMinimum || (exceedsAvailableLiquidity && lastEditedField === "output")
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
                  color: outputStyle?.light_text_color || "#805530",
                }}
                disabled={isOtcServerDead || !canEditOutputField}
                cursor={isOtcServerDead || !canEditOutputField ? "not-allowed" : "text"}
                opacity={isOtcServerDead || !canEditOutputField ? 0.5 : 1}
              />
            )}

            {/* USD value / errors at bottom */}
            <Flex>
              {exceedsAvailableLiquidity && lastEditedField === "output" ? (
                <>
                  <Text
                    color={colors.redHover}
                    fontSize="13px"
                    mt="6px"
                    letterSpacing="-1.5px"
                    fontWeight="normal"
                    fontFamily="Aux"
                  >
                    {isMobile ? "" : `Exceeds max liquidity${formattedMaxLiquidity ? " - " : ""}`}
                  </Text>
                  {formattedMaxLiquidity && (
                    <Text
                      fontSize="13px"
                      mt="7px"
                      ml={isMobile ? "0px" : "8px"}
                      color={outputStyle?.border_color_light || colors.textGray}
                      cursor="pointer"
                      onClick={handleLiquidityMaxClick}
                      _hover={{ textDecoration: "underline" }}
                      letterSpacing="-1.5px"
                      fontWeight="normal"
                      fontFamily="Aux"
                    >
                      {`${formattedMaxLiquidity} BTC Max`}
                    </Text>
                  )}
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
                    {isMobile ? "" : "Below min swap -"}
                  </Text>
                  <Text
                    fontSize="13px"
                    mt="7px"
                    ml={isMobile ? "0px" : "8px"}
                    color={outputStyle?.border_color_light || colors.textGray}
                    cursor="pointer"
                    onClick={handleMinimumOutputClick}
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
                    if (outputUsdValue === ZERO_USD_DISPLAY) return null;
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
            <AddressSelector
              chainType={outputToken.chain === "bitcoin" ? "BTC" : "EVM"}
              selectedAddress={resolvedOutputAddress}
              onSelect={(address) => {
                void handleOutputAddressSelect(address);
              }}
              onPasteAddress={() => {
                setPasteModalType(outputToken.chain === "bitcoin" ? "BTC" : "EVM");
                setIsPasteModalOpen(true);
              }}
              showPasteOption={true}
            />
            {/* Asset tag centered */}
            <WebAssetTag
              cursor="pointer"
              asset={outputAssetIdentifier}
              onDropDown={() => openAssetSelector("output")}
              isOutput={true}
            />
            {/* Output balance display */}
            <Flex direction="row" align="center" gap="8px" h="21px" whiteSpace="nowrap">
              {currentOutputBalance !== null && currentOutputTicker && (
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
            if (pasteModalType === "BTC") {
              const validation = validatePayoutAddress(address, true);
              if (!validation.isValid) return;
              setPastedBTCAddress(address);
              return;
            }

            const validation = validatePayoutAddress(address, false);
            if (!validation.isValid) return;
            setOutputEvmAddress(address);
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
              displayedInputAmount,
              outputAmount,
              inputTokenPrice,
              outputTokenPrice,
              inputToken.ticker,
              outputToken?.ticker || "CBBTC"
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
            {feeOverview && feeOverview.totalFees !== "$0.00" ? (
              <Tooltip
                show={showFeeTooltip}
                onMouseEnter={() => setShowFeeTooltip(true)}
                onMouseLeave={() => setShowFeeTooltip(false)}
                width="145px"
                hoverText={
                  <>
                    {[
                      { key: "rift", ...feeOverview.riftFee },
                      { key: "gas", ...feeOverview.gasFee },
                    ]
                      .filter((fee) => fee.fee !== "$0.00")
                      .map((fee) => (
                        <Flex key={fee.key} justify="space-between" w="100%">
                          <Text fontFamily="Monospace">{fee.description}:</Text>
                          <Text fontFamily="Monospace">{fee.fee}</Text>
                        </Flex>
                      ))}
                  </>
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
                      Fees: {feeOverview.totalFees}
                    </Text>
                    <Flex mt="0px" mr="2px">
                      <InfoSVG width="14px" />
                    </Flex>
                  </Flex>
                }
              />
            ) : feeOverview ? (
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
                  Fees: {feeOverview.totalFees}
                </Text>
              </Flex>
            ) : null}
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
