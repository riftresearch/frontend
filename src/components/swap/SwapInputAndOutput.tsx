import { Flex, Text, Input, Spacer, Button, Spinner } from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { FiEdit3, FiChevronDown } from "react-icons/fi";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import { useCowSwapContext } from "@/components/providers/CowSwapProvider";
import {
  GLOBAL_CONFIG,
  ZERO_USD_DISPLAY,
  ETHEREUM_POPULAR_TOKENS,
  BASE_POPULAR_TOKENS,
  BITCOIN_DECIMALS,
  MIN_SWAP_SATS,
  ETH_TOKEN_BASE,
  ETH_TOKEN,
} from "@/utils/constants";
import { SupportedChainId } from "@cowprotocol/cow-sdk";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { AddressSelector } from "@/components/other/AddressSelector";
import { PasteAddressModal } from "@/components/other/PasteAddressModal";
import { InfoSVG } from "../other/SVGs";
import { Tooltip } from "@/components/other/Tooltip";
import { FONT_FAMILIES } from "@/utils/font";
import BitcoinAddressValidation from "../other/BitcoinAddressValidation";
import { useStore } from "@/utils/store";
import { TokenData, ApprovalState } from "@/utils/types";
import {
  EVMAccountWarningModal,
  hasAcknowledgedEVMWarning,
} from "@/components/other/EVMAccountWarningModal";
import { QuoteResponse } from "@/utils/riftApiClient";
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
  truncateAmount,
  getSlippageBpsForNotional,
  formatCurrencyAmount,
} from "@/utils/swapHelpers";
import { PriceQuality } from "@cowprotocol/cow-sdk";
import { formatUnits, parseUnits } from "viem";
import { useMaxLiquidity } from "@/hooks/useLiquidity";
import { saveSwapStateToCookie, loadSwapStateFromCookie } from "@/utils/swapStateCookies";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { fetchTokenPrice } from "@/utils/userTokensClient";

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

  const { isConnected: isWalletConnected, address: userEvmAccountAddress } = useAccount();

  // Dynamic wallet context
  const { primaryWallet } = useDynamicContext();

  // CowSwap context - provides client and indicative status
  const cowswapContext = useCowSwapContext();
  const cowswapClient = cowswapContext?.client ?? null;
  const isCowswapIndicative = cowswapContext?.isIndicative ?? true;

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
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const [showRefundAddressTooltip, setShowRefundAddressTooltip] = useState(false);
  const [showMaxTooltip, setShowMaxTooltip] = useState(false);
  const [showEVMWarningModal, setShowEVMWarningModal] = useState(false);
  const [isAtAdjustedMax, setIsAtAdjustedMax] = useState(false);
  const getQuoteForInputRef = useRef(true);
  const [currentInputBalance, setCurrentInputBalance] = useState<string | null>(null);
  const [currentInputTicker, setCurrentInputTicker] = useState<string | null>(null);
  const [outputBelowMinimum, setOutputBelowMinimum] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [refetchERC20toBTCQuote, setRefetchERC20toBTCQuote] = useState(false);
  const [refetchERC20toBTCQuoteExactOutput, setRefetchERC20toBTCQuoteExactOutput] = useState(false);
  const [refetchBTCtoERC20Quote, setRefetchBTCtoERC20Quote] = useState(false);

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
    displayedInputAmount,
    setDisplayedInputAmount,
    fullPrecisionInputAmount,
    setFullPrecisionInputAmount,
    outputAmount,
    setOutputAmount,
    isSwappingForBTC,
    setIsSwappingForBTC,
    btcPrice,
    ethPrice,
    erc20Price,
    setErc20Price,
    inputUsdValue,
    setInputUsdValue,
    outputUsdValue,
    setOutputUsdValue,
    setQuotes,
    clearQuotes,
    rfqQuote,
    cowswapQuote,
    payoutAddress,
    setPayoutAddress,
    addressValidation,
    setAddressValidation,
    btcRefundAddress,
    setBtcRefundAddress,
    btcRefundAddressValidation,
    setBtcRefundAddressValidation,
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
  } = useStore();

  // State for paste address modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalType, setPasteModalType] = useState<"EVM" | "BTC">("BTC");

  // Note: Auto-selection is now handled by AddressSelector component
  // This effect only runs once on mount to set initial primary wallet if available
  const hasInitializedRef = useRef(false);

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

    // For output address (only for EVM → BTC direction, BTC wallet)
    if (isSwappingForBTC && isBtcWallet) {
      setSelectedOutputAddress(primaryWallet.address);
    }
  }, [primaryWallet, isSwappingForBTC, setSelectedInputAddress, setSelectedOutputAddress]);

  // Track previous swap direction to detect actual changes
  const prevIsSwappingForBTCRef = useRef(isSwappingForBTC);

  // Clear addresses when swap direction changes (not on mount)
  useEffect(() => {
    if (prevIsSwappingForBTCRef.current !== isSwappingForBTC) {
      setSelectedInputAddress(null);
      setSelectedOutputAddress(null);
      prevIsSwappingForBTCRef.current = isSwappingForBTC;
    }
  }, [isSwappingForBTC, setSelectedInputAddress, setSelectedOutputAddress]);

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
        setHasNoRoutesError(false);
        setErc20Price(null);
        return;
      }

      // Use the token's chainId to determine the correct chain for price lookup
      // Fall back to connected wallet chain, then default to ethereum
      const tokenChainId = tokenData.chainId ?? evmConnectWalletChainId ?? 1;
      const chainName = tokenChainId === 8453 ? "base" : "ethereum";

      try {
        const tokenPrice = await fetchTokenPrice(chainName, tokenData.address);
        if (tokenPrice && typeof tokenPrice.price === "number") {
          setErc20Price(tokenPrice.price);
          setHasNoRoutesError(false);
        } else {
          setHasNoRoutesError(true);
        }
      } catch (error) {
        console.error("Failed to fetch ERC20 price:", error);
        setHasNoRoutesError(true);
      }
    },
    [evmConnectWalletChainId, setErc20Price]
  );

  // Helper to process a quote response and update UI
  const processQuoteResponse = useCallback(
    (
      quoteResponse: Awaited<ReturnType<typeof getERC20ToBTCQuote>>,
      requestId: number | undefined,
      priceQuality: PriceQuality
    ) => {
      // Check if this is still the latest request
      if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
        console.log(`Ignoring stale ${priceQuality} quote response`, requestId);
        return;
      }

      if (quoteResponse) {
        // input token was just changed, old quote
        // Only check this for quotes that went through CowSwap (non-cbBTC tokens)
        // For cbBTC direct swaps, cowswapQuote is undefined, so skip this check
        if (quoteResponse.cowswapQuote) {
          const isMismatch =
            (selectedInputToken.ticker !== "ETH" &&
              selectedInputToken.address !==
                quoteResponse.cowswapQuote.tradeParameters.sellToken) ||
            (selectedInputToken.ticker === "ETH" &&
              quoteResponse.cowswapQuote.tradeParameters.sellToken !==
                "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");

          if (isMismatch) {
            console.log("input token was just changed, old quote");
            setIsLoadingQuote(false);
            clearQuotes();
            setRefetchQuote(false);
            return;
          }
        }

        console.log(`Processing ${priceQuality} quote response`);
        setQuotes({
          cowswapQuote: quoteResponse.cowswapQuote || null,
          rfqQuote: quoteResponse.rfqQuote,
          quoteType: isCowswapIndicative ? "indicative" : "executable",
        });
        setOutputAmount(quoteResponse.btcOutputAmount || "");
        setIsLoadingQuote(false);
        setRefetchQuote(false);
        setExceedsAvailableBTCLiquidity(false);

        // Mark optimal quote as received when OPTIMAL arrives
        if (priceQuality === PriceQuality.OPTIMAL) {
          setIsAwaitingOptimalQuote(false);
        }

        // Calculate and set fee overview using the new fees.usd structure
        if (btcPrice) {
          // Get price for CowSwap fee calculation
          let sellTokenPrice: number | null = null;
          if (selectedInputToken.ticker === "ETH") {
            sellTokenPrice = ethPrice;
          } else if (selectedInputToken.ticker === "cbBTC") {
            sellTokenPrice = btcPrice;
          } else {
            sellTokenPrice = erc20Price;
          }

          const fees = calculateFees(
            quoteResponse.rfqQuote.fees.usd,
            quoteResponse.cowswapQuote,
            sellTokenPrice ?? undefined,
            selectedInputToken.decimals,
            btcPrice ?? undefined
          );
          setFeeOverview(fees);
        }
      }
    },
    [
      btcPrice,
      ethPrice,
      erc20Price,
      selectedInputToken,
      setQuotes,
      setOutputAmount,
      setFeeOverview,
      setIsAwaitingOptimalQuote,
      isCowswapIndicative,
    ]
  );

  // Fetch quote for ERC20/ETH -> BTC (combines CowSwap + RFQ)
  // Fires FAST quote first for quick UI, then OPTIMAL quote for best price
  // If isRefresh is true, only fetches OPTIMAL (for periodic refreshes)
  const fetchERC20ToBTCQuote = useCallback(
    async (inputAmount?: string, requestId?: number, isRefresh: boolean = false) => {
      // Use provided amount or fall back to state
      const amountToQuote = inputAmount ?? displayedInputAmount;

      if (!isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        console.log("no amount to quote");
        return;
      }

      // Check if the input value is above minimum swap threshold
      const inputValue = parseFloat(amountToQuote);
      let price: number | null = null;

      if (selectedInputToken.ticker === "ETH") {
        price = ethPrice;
      } else if (selectedInputToken.ticker === "cbBTC") {
        price = btcPrice;
      } else {
        price = erc20Price;
      }
      console.log("[alp] price", price);
      console.log("[alp] btcPrice", btcPrice);

      if (price && btcPrice) {
        const usdValue = inputValue * price;
        console.log("inputValue", inputValue);
        console.log("price", price);
        console.log("usdValue", usdValue);
        console.log("btcPrice", btcPrice);
        console.log("max btc liquidity in usd", liquidity.maxBTCLiquidityInUsd);
        if (!isAboveMinSwap(usdValue, btcPrice)) {
          console.log("Input value below minimum swap threshold");
          // Clear quotes but don't show error - just wait for larger amount
          clearQuotes();
          setOutputAmount("");
          setIsLoadingQuote(false);
          return;
        }

        // Calculate dynamic slippage based on notional size
        const dynamicSlippageBps = getSlippageBpsForNotional(usdValue);
        console.log("dynamicSlippageBps", dynamicSlippageBps, "for usdValue", usdValue);

        // Clear any previous "no routes" error
        setHasNoRoutesError(false);

        // Mark that we're waiting for an optimal quote
        setIsAwaitingOptimalQuote(true);

        // Convert amount to base units
        const decimals = selectedInputToken.decimals;
        const sellAmount = parseUnits(amountToQuote, decimals).toString();
        const sellToken = selectedInputToken.address;
        const userAddr = userEvmAccountAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        console.log("getting quote for", sellToken, sellAmount);

        // Get chainId from selected token (default to mainnet)
        const tokenChainId = selectedInputToken.chainId ?? 1;

        // Fire FAST quote first (non-blocking) - will update UI quickly
        // Skip FAST quote on refresh since we already have a quote displayed
        if (!isRefresh) {
          getERC20ToBTCQuote(
            sellToken,
            sellAmount,
            decimals,
            userAddr,
            dynamicSlippageBps,
            undefined,
            cowswapClient,
            PriceQuality.FAST,
            tokenChainId
          )
            .then((quoteResponse) => {
              console.log("FAST quoteResponse", quoteResponse);
              processQuoteResponse(quoteResponse, requestId, PriceQuality.FAST);
            })
            .catch((error) => {
              console.error("Failed to fetch FAST quote:", error);
              // Don't clear state on FAST failure - OPTIMAL may still succeed
            });
        }

        // Fire OPTIMAL quote (non-blocking) - will update UI with better price when ready
        getERC20ToBTCQuote(
          sellToken,
          sellAmount,
          decimals,
          userAddr,
          dynamicSlippageBps,
          undefined,
          cowswapClient,
          PriceQuality.OPTIMAL,
          tokenChainId
        )
          .then((quoteResponse) => {
            console.log("OPTIMAL quoteResponse", quoteResponse);
            processQuoteResponse(quoteResponse, requestId, PriceQuality.OPTIMAL);
          })
          .catch((error) => {
            console.error("Failed to fetch OPTIMAL quote:", error);
            if ((error as Error).message === "Insufficient balance to fulfill quote") {
              setExceedsAvailableBTCLiquidity(true);
            }
            // Mark optimal quote as no longer pending (failed)
            setIsAwaitingOptimalQuote(false);
            // Only clear state if both quotes fail (FAST already tried)
            clearQuotes();
            setOutputAmount("");
            setFeeOverview(null);
            setIsLoadingQuote(false);
            setRefetchQuote(false);
          });
      } else {
        console.log("no price");
        console.log("btcPrice", btcPrice);
        console.log("price", price);
        // Set refetch flag if we have an amount to quote
        if (amountToQuote && parseFloat(amountToQuote) > 0) {
          setRefetchERC20toBTCQuote(true);
        }
        return;
      }
    },
    [
      isSwappingForBTC,
      displayedInputAmount,
      userEvmAccountAddress,
      selectedInputToken,
      clearQuotes,
      setOutputAmount,
      ethPrice,
      erc20Price,
      btcPrice,
      setFeeOverview,
      liquidity,
      cowswapClient,
      processQuoteResponse,
      setIsAwaitingOptimalQuote,
    ]
  );

  // Helper to process an exact output quote response and update UI
  const processExactOutputQuoteResponse = useCallback(
    (
      quoteResponse: Awaited<ReturnType<typeof getERC20ToBTCQuoteExactOutput>>,
      requestId: number | undefined,
      priceQuality: PriceQuality
    ) => {
      // Check if this is still the latest request
      if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
        console.log(`Ignoring stale ${priceQuality} exact output quote response`, requestId);
        return;
      }

      if (quoteResponse) {
        console.log(`Processing ${priceQuality} exact output quote response`);
        setQuotes({
          cowswapQuote: quoteResponse.cowswapQuote || null,
          rfqQuote: quoteResponse.rfqQuote,
          quoteType: isCowswapIndicative ? "indicative" : "executable",
        });

        // Truncate input amount to 8 decimals for display
        const inputAmount = quoteResponse.erc20InputAmount || "";
        const truncatedInput = truncateAmount(inputAmount);

        setDisplayedInputAmount(truncatedInput);
        setIsLoadingQuote(false);
        setRefetchQuote(false);

        // Mark optimal quote as received when OPTIMAL arrives
        if (priceQuality === PriceQuality.OPTIMAL) {
          setIsAwaitingOptimalQuote(false);
        }

        // Calculate and set fee overview using the new fees.usd structure
        if (btcPrice) {
          // Get price for CowSwap fee calculation
          let sellTokenPrice: number | null = null;
          if (selectedInputToken.ticker === "ETH") {
            sellTokenPrice = ethPrice;
          } else if (selectedInputToken.ticker === "cbBTC") {
            sellTokenPrice = btcPrice;
          } else {
            sellTokenPrice = erc20Price;
          }

          const fees = calculateFees(
            quoteResponse.rfqQuote.fees.usd,
            quoteResponse.cowswapQuote,
            sellTokenPrice ?? undefined,
            selectedInputToken.decimals,
            btcPrice ?? undefined
          );
          setFeeOverview(fees);
        }
      }
    },
    [
      btcPrice,
      ethPrice,
      erc20Price,
      selectedInputToken,
      setQuotes,
      setDisplayedInputAmount,
      setFeeOverview,
      setIsAwaitingOptimalQuote,
      isCowswapIndicative,
    ]
  );

  // Fetch quote for ERC20/ETH -> BTC (exact output mode)
  // Fires FAST quote first for quick UI, then OPTIMAL quote for best price
  // If isRefresh is true, only fetches OPTIMAL (for periodic refreshes)
  const fetchERC20ToBTCQuoteExactOutput = useCallback(
    async (outputAmountOverride?: string, requestId?: number, isRefresh: boolean = false) => {
      // Use provided amount or fall back to state
      const btcAmountToQuote = outputAmountOverride ?? outputAmount;

      if (!isSwappingForBTC || !btcAmountToQuote || parseFloat(btcAmountToQuote) <= 0) {
        return;
      }

      // Check if the output BTC value is above minimum swap threshold
      const outputValue = parseFloat(btcAmountToQuote);

      if (btcPrice) {
        const usdValue = outputValue * btcPrice;

        if (!isAboveMinSwap(usdValue, btcPrice)) {
          console.log("Output value below minimum swap threshold");
          // Clear quotes but don't show error - just wait for larger amount
          clearQuotes();
          setDisplayedInputAmount("");
          setIsLoadingQuote(false);
          return;
        }

        // Check if output value exceeds maximum BTC liquidity
        if (
          parseFloat(liquidity.maxBTCLiquidityInUsd) > 0 &&
          usdValue > parseFloat(liquidity.maxBTCLiquidityInUsd)
        ) {
          console.log("Output value exceeds maximum BTC liquidity");
          clearQuotes();
          setDisplayedInputAmount("");
          setIsLoadingQuote(false);
          return;
        }

        // Calculate dynamic slippage based on notional size
        const dynamicSlippageBps = getSlippageBpsForNotional(usdValue);
        console.log(
          "dynamicSlippageBps (exact output)",
          dynamicSlippageBps,
          "for usdValue",
          usdValue
        );

        // Clear any previous "no routes" error
        setHasNoRoutesError(false);

        // Mark that we're waiting for an optimal quote
        setIsAwaitingOptimalQuote(true);

        const userAddr = userEvmAccountAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

        // Get chainId from selected token (default to mainnet)
        const tokenChainId = selectedInputToken.chainId ?? 1;

        // Fire FAST quote first (non-blocking) - will update UI quickly
        // Skip FAST quote on refresh since we already have a quote displayed
        if (!isRefresh) {
          getERC20ToBTCQuoteExactOutput(
            btcAmountToQuote,
            selectedInputToken,
            userAddr,
            dynamicSlippageBps,
            undefined,
            cowswapClient,
            PriceQuality.FAST,
            tokenChainId
          )
            .then((quoteResponse) => {
              console.log("FAST exact output quoteResponse", quoteResponse);
              processExactOutputQuoteResponse(quoteResponse, requestId, PriceQuality.FAST);
            })
            .catch((error) => {
              console.error("Failed to fetch FAST exact output quote:", error);
              // Don't clear state on FAST failure - OPTIMAL may still succeed
            });
        }

        // Fire OPTIMAL quote (non-blocking) - will update UI with better price when ready
        getERC20ToBTCQuoteExactOutput(
          btcAmountToQuote,
          selectedInputToken,
          userAddr,
          dynamicSlippageBps,
          undefined,
          cowswapClient,
          PriceQuality.OPTIMAL,
          tokenChainId
        )
          .then((quoteResponse) => {
            console.log("OPTIMAL exact output quoteResponse", quoteResponse);
            processExactOutputQuoteResponse(quoteResponse, requestId, PriceQuality.OPTIMAL);
          })
          .catch((error) => {
            console.error("Failed to fetch OPTIMAL exact output quote:", error);
            // Mark optimal quote as no longer pending (failed)
            setIsAwaitingOptimalQuote(false);
            // Only clear state if both quotes fail (FAST already tried)
            clearQuotes();
            setDisplayedInputAmount("");
            setFeeOverview(null);
            setIsLoadingQuote(false);
            setRefetchQuote(false);
          });
      } else {
        // Set refetch flag if we have an amount to quote
        if (btcAmountToQuote && parseFloat(btcAmountToQuote) > 0) {
          setRefetchERC20toBTCQuoteExactOutput(true);
        }
        return;
      }
    },
    [
      isSwappingForBTC,
      outputAmount,
      userEvmAccountAddress,
      selectedInputToken,
      clearQuotes,
      setDisplayedInputAmount,
      btcPrice,
      setFeeOverview,
      liquidity,
      cowswapClient,
      processExactOutputQuoteResponse,
      setIsAwaitingOptimalQuote,
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
      const amountToQuote = amount ?? (mode === "ExactInput" ? displayedInputAmount : outputAmount);

      // Validate inputs
      if (isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        return;
      }

      // Calculate USD value for min swap and max liquidity checks
      const amountValue = parseFloat(amountToQuote);
      let usdValue = 0;

      let price;
      if (selectedOutputToken?.ticker === "cbBTC") {
        price = btcPrice;
      } else if (erc20Price) {
        price = erc20Price;
      }
      if (!btcPrice || !price) {
        // setIsLoadingQuote(false);
        // Set refetch flag if we have an amount to quote
        if (amountToQuote && parseFloat(amountToQuote) > 0) {
          setRefetchBTCtoERC20Quote(true);
        }
        return;
      }

      if (mode === "ExactInput") {
        // Input is BTC
        usdValue = amountValue * btcPrice;
      } else {
        // Output is ERC20
        usdValue = amountValue * price;
      }

      console.log();

      if (!isAboveMinSwap(usdValue, btcPrice)) {
        console.log("Value below minimum swap threshold");
        clearQuotes();
        setIsLoadingQuote(false);
        if (mode === "ExactInput") {
          setOutputAmount("");
        } else {
          setDisplayedInputAmount("");
        }
        return;
      }

      // Check maximum liquidity
      if (
        parseFloat(liquidity.maxCbBTCLiquidityInUsd) > 0 &&
        usdValue > parseFloat(liquidity.maxCbBTCLiquidityInUsd)
      ) {
        console.log("Value exceeds maximum cbBTC liquidity");
        clearQuotes();
        setIsLoadingQuote(false);
        if (mode === "ExactInput") {
          setOutputAmount("");
        } else {
          setDisplayedInputAmount("");
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

        // Get chainId from selected output token (for BTC -> cbBTC, output is cbBTC)
        const tokenChainId = selectedOutputToken?.chainId ?? 1;

        // Call RFQ with the provided params
        const rfqQuoteResponse = await callRFQ(quoteAmount, mode, false, tokenChainId);

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          console.log(`Ignoring stale BTC->ERC20 quote response (${mode})`, requestId);
          return;
        }

        if (rfqQuoteResponse) {
          // BTC -> cbBTC: no cowswap quote, only RFQ
          // Quotes are executable when wallet is connected (destination known)
          setQuotes({
            cowswapQuote: null,
            rfqQuote: rfqQuoteResponse,
            quoteType: isWalletConnected ? "executable" : "indicative",
          });
          setIsLoadingQuote(false);
          setRefetchQuote(false);

          if (mode === "ExactInput") {
            // Set output amount (ERC20/ETH) - truncate to 8 decimals
            const outputAmount = formatCurrencyAmount(rfqQuoteResponse.to);
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
            const inputAmount = formatCurrencyAmount(rfqQuoteResponse.from);
            const truncatedInput = (() => {
              const parts = inputAmount.split(".");
              if (parts.length === 2 && parts[1].length > 8) {
                return `${parts[0]}.${parts[1].substring(0, 8)}`;
              }
              return inputAmount;
            })();
            setDisplayedInputAmount(truncatedInput);
          }

          // Calculate and set fee overview (no CowSwap for BTC->cbBTC)
          if (btcPrice && price) {
            const fees = calculateFees(
              rfqQuoteResponse.fees.usd,
              null, // No CowSwap quote for BTC->cbBTC
              price,
              selectedOutputToken?.decimals || BITCOIN_DECIMALS,
              btcPrice
            );
            setFeeOverview(fees);
          }
        } else {
          // Clear state on failure
          clearQuotes();
          setFeeOverview(null);
          setIsLoadingQuote(false);
          if (mode === "ExactInput") {
            setOutputAmount("");
          } else {
            setDisplayedInputAmount("");
          }
        }
      } catch (error) {
        console.error(`Failed to fetch BTC->ERC20 quote (${mode}):`, error);
        clearQuotes();
        setFeeOverview(null);
        setIsLoadingQuote(false);
        if (mode === "ExactInput") {
          setOutputAmount("");
        } else {
          setDisplayedInputAmount("");
        }
      }
    },
    [
      isSwappingForBTC,
      displayedInputAmount,
      outputAmount,
      selectedInputToken,
      setQuotes,
      clearQuotes,
      setOutputAmount,
      setDisplayedInputAmount,
      btcPrice,
      erc20Price,
      setFeeOverview,
      liquidity,
      selectedOutputToken?.decimals,
      selectedOutputToken?.chainId,
      isWalletConnected,
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
    // Check if swapping TO BTC and user hasn't acknowledged the warning
    if (isSwappingForBTC && !hasAcknowledgedEVMWarning()) {
      setShowEVMWarningModal(true);
      performSwapReverse(!isSwappingForBTC);
      return;
    }

    // Proceed with the swap reversal
    performSwapReverse(!isSwappingForBTC);
  };

  const performSwapReverse = (newIsSwappingForBTC: boolean) => {
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
    setDisplayedInputAmount("");
    setOutputAmount("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setFeeOverview(null);
    setPayoutAddress("");
    setAddressValidation({ isValid: false });
    setHasStartedTyping(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // If first character is "0" or ".", replace with "0."
    if (displayedInputAmount === "" && (value === "0" || value === ".")) {
      value = "0.";
    }

    // Allow empty string, numbers, and decimal point (max 8 decimals)
    if (value === "" || /^\d*\.?\d{0,8}$/.test(value)) {
      setDisplayedInputAmount(value);
      setLastEditedField("input");
      setHasStartedTyping(true);
      // Reset adjusted max flag and full precision when user manually edits
      setIsAtAdjustedMax(false);
      setFullPrecisionInputAmount(null);

      // Update USD value using helper
      const inputTicker = isSwappingForBTC ? selectedInputToken.ticker : "BTC";
      console.log(
        `Calculating USD for input: amount=${value}, ticker=${inputTicker}, ethPrice=${ethPrice}, btcPrice=${btcPrice}, erc20Price=${erc20Price}`
      );
      const usdValue = calculateUsdValue(value, inputTicker, ethPrice, btcPrice, erc20Price);
      console.log(`Calculated USD value: ${usdValue}`);
      setInputUsdValue(usdValue);

      // Clear existing quotes when user types
      clearQuotes();

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
      if (value && parseFloat(value) > 0 && getQuoteForInputRef.current && !hasNoRoutesError) {
        // Show loading state
        setIsLoadingQuote(true);

        // Increment request ID and capture it
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        if (isSwappingForBTC) {
          // Fetch exact input quote for ERC20/ETH -> BTC
          quoteDebounceTimerRef.current = setTimeout(() => {
            fetchERC20ToBTCQuote(value, currentRequestId);
          }, 125);
        } else {
          // Fetch exact input quote for BTC -> ERC20/ETH
          quoteDebounceTimerRef.current = setTimeout(() => {
            fetchBTCtoERC20Quote(value, "ExactInput", currentRequestId);
          }, 125);
        }
      } else {
        setIsLoadingQuote(false);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Set flag to indicate we should quote for input field
    getQuoteForInputRef.current = true;

    // If value is "0." and user presses Backspace or Delete, clear both characters
    if (displayedInputAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setDisplayedInputAmount("");
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
      clearQuotes();

      if (!value || parseFloat(value) <= 0) {
        // Clear input if output is empty or 0
        setDisplayedInputAmount("");
        setInputUsdValue(ZERO_USD_DISPLAY);
        setIsLoadingQuote(false);
      }

      // Clear any existing debounce timer
      if (outputQuoteDebounceTimerRef.current) {
        clearTimeout(outputQuoteDebounceTimerRef.current);
      }

      // Set up debounced quote fetch (75ms delay)
      if (value && parseFloat(value) > 0 && !getQuoteForInputRef.current) {
        // Check if output is below min (3000 sats = 0.00003 BTC)
        const outputFloat = parseFloat(value);

        if (outputFloat < MIN_BTC) {
          // Don't fetch quote if below minimum
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

    // Calculate currentInputBalance in USD for comparisons
    const balanceInputTicker = isSwappingForBTC ? selectedInputToken.ticker : "BTC";
    const balanceUsd = calculateUsdValue(
      currentInputBalance,
      balanceInputTicker,
      ethPrice,
      btcPrice,
      erc20Price
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
      clearQuotes();
      return;
    }

    // Only clear liquidity errors if balance < available liquidity
    const maxLiquidityUsd = parseFloat(liquidity.maxBTCLiquidityInUsd);
    if (balanceUsdFloat < maxLiquidityUsd) {
      setExceedsAvailableBTCLiquidity(false);
    }

    // If ETH is selected, fetch gas data and adjust for gas costs
    if (selectedInputToken.ticker === "ETH") {
      const gasCostEth = await fetchEthGasCost(selectedInputToken.chainId);
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
    const inputTicker = isSwappingForBTC ? selectedInputToken.ticker : "BTC";
    const usdValue = calculateUsdValue(
      adjustedInputAmount,
      inputTicker,
      ethPrice,
      btcPrice,
      erc20Price
    );
    setInputUsdValue(usdValue);

    // Clear existing quotes when max is clicked
    clearQuotes();

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
    clearQuotes();

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
    clearQuotes();

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
    // 2. We haven't loaded from cookie
    if (!isInitialMountRef.current && !hasLoadedFromCookieRef.current) {
      const defaultToken = evmConnectWalletChainId === 8453 ? ETH_TOKEN_BASE : ETH_TOKEN;
      setSelectedInputToken(defaultToken);
    }
  }, [selectedInputToken, setSelectedInputToken]);

  // Initialize selectedOutputToken based on swap direction and connected chain
  useEffect(() => {
    // Skip if we're still on initial mount and might load from cookie
    if (isInitialMountRef.current) return;

    if (isSwappingForBTC) {
      setSelectedOutputToken(null);
    } else {
      // Use chain-specific cbBTC token based on user's connected chain
      const popularTokens =
        evmConnectWalletChainId === 8453 ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS;
      const cbBTC = popularTokens.find((token) => token.ticker === "cbBTC");
      setSelectedOutputToken(cbBTC || null);
    }
  }, [isSwappingForBTC, setSelectedInputToken, setSelectedOutputToken, evmConnectWalletChainId]);

  useEffect(() => {
    // If chain switch was triggered from asset selector, just clear the flag and keep the selected token
    // Otherwise, reset to default token for the new chain
    if (!switchingToInputTokenChain && selectedInputToken.chainId !== evmConnectWalletChainId) {
      const defaultToken = evmConnectWalletChainId === 8453 ? ETH_TOKEN_BASE : ETH_TOKEN;
      setSelectedInputToken(defaultToken);
    }
  }, [
    setSelectedInputToken,
    evmConnectWalletChainId,
    selectedInputToken,
    switchingToInputTokenChain,
    setSwitchingToInputTokenChain,
  ]);

  // Fetch ERC20 token price when selected token changes
  useEffect(() => {
    fetchErc20TokenPrice(selectedInputToken);
  }, [selectedInputToken, fetchErc20TokenPrice]);

  // Update USD values when prices or amounts change
  useEffect(() => {
    const inputTicker = isSwappingForBTC ? selectedInputToken.ticker : "BTC";
    const inputUsd = calculateUsdValue(
      displayedInputAmount,
      inputTicker,
      ethPrice,
      btcPrice,
      erc20Price
    );
    setInputUsdValue(inputUsd);

    const outputTicker = isSwappingForBTC ? "BTC" : selectedOutputToken?.ticker || "ETH";
    const outputUsd = calculateUsdValue(outputAmount, outputTicker, ethPrice, btcPrice, erc20Price);
    setOutputUsdValue(outputUsd);
  }, [
    erc20Price,
    btcPrice,
    ethPrice,
    displayedInputAmount,
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

  // Validate BTC refund address for BTC -> cbBTC swaps
  useEffect(() => {
    if (btcRefundAddress) {
      // Always validate as Bitcoin address (isSwappingForBTC = true triggers Bitcoin validation)
      const validation = validatePayoutAddress(btcRefundAddress, true);
      setBtcRefundAddressValidation(validation);
    } else {
      setBtcRefundAddressValidation({ isValid: false });
    }
  }, [btcRefundAddress, setBtcRefundAddressValidation]);

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
      displayedInputAmount &&
      parseFloat(displayedInputAmount) > 0 &&
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
          // Pass isRefresh=true to only fetch OPTIMAL (skip FAST since we already have a quote)
          fetchERC20ToBTCQuote(undefined, currentRequestId, true);
        } else {
          // User is editing output field - fetch exact output quote
          // Pass isRefresh=true to only fetch OPTIMAL (skip FAST since we already have a quote)
          fetchERC20ToBTCQuoteExactOutput(undefined, currentRequestId, true);
        }
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
    isSwappingForBTC,
    displayedInputAmount,
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

  // Check CowSwap allowance when input amount changes (debounced)
  useEffect(() => {
    const checkAllowance = async () => {
      // Only check if:
      // 1. Token is ERC20 (not ETH or cbBTC)
      // 2. We have a valid input amount
      // 3. CowSwap client is available
      if (
        !selectedInputToken.address ||
        selectedInputToken.ticker === "ETH" ||
        selectedInputToken.ticker === "cbBTC" ||
        !userEvmAccountAddress ||
        !displayedInputAmount ||
        parseFloat(displayedInputAmount) <= 0 ||
        !cowswapClient
      ) {
        return;
      }

      try {
        const chainId =
          evmConnectWalletChainId === 8453 ? SupportedChainId.BASE : SupportedChainId.MAINNET;

        const currentAllowance = await cowswapClient.getCowProtocolAllowance({
          tokenAddress: selectedInputToken.address as `0x${string}`,
          owner: userEvmAccountAddress as `0x${string}`,
          chainId,
        });

        const requiredAmount = parseUnits(displayedInputAmount, selectedInputToken.decimals);
        console.log("CowSwap allowance:", currentAllowance, "required:", requiredAmount);

        // Set approval state based on whether allowance is sufficient
        if (currentAllowance >= requiredAmount) {
          setApprovalState(ApprovalState.APPROVED);
        } else {
          setApprovalState(ApprovalState.NEEDS_APPROVAL);
        }
      } catch (error) {
        console.error("Error checking CowSwap allowance:", error);
        // Default to needs approval on error
        setApprovalState(ApprovalState.NEEDS_APPROVAL);
      }
    };

    // Clear any existing debounce timer
    if (approvalDebounceTimerRef.current) {
      clearTimeout(approvalDebounceTimerRef.current);
    }

    // Set up debounced allowance check (250ms delay)
    if (
      displayedInputAmount &&
      parseFloat(displayedInputAmount) > 0 &&
      selectedInputToken.address &&
      selectedInputToken.ticker !== "ETH" &&
      selectedInputToken.ticker !== "cbBTC" &&
      userEvmAccountAddress &&
      cowswapClient
    ) {
      approvalDebounceTimerRef.current = setTimeout(() => {
        checkAllowance();
      }, 250);
    }

    return () => {
      if (approvalDebounceTimerRef.current) {
        clearTimeout(approvalDebounceTimerRef.current);
      }
    };
  }, [
    selectedInputToken,
    userEvmAccountAddress,
    setApprovalState,
    displayedInputAmount,
    cowswapClient,
    evmConnectWalletChainId,
  ]);

  // Reset approval state when token changes
  useEffect(() => {
    setApprovalState(ApprovalState.UNKNOWN);
  }, [selectedInputToken, setApprovalState]);

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
    const isInitialConnection = !prev.wasConnected && isWalletConnected;

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
      wasConnected: isWalletConnected,
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
      clearQuotes();
      setFeeOverview(null);
      setDisplayedInputAmount("");
      setOutputAmount("");
      setFullPrecisionInputAmount(null);
    }
  }, [evmConnectWalletChainId, isWalletConnected]);

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
        selectedInputToken.ticker === "ETH" &&
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
          // ERC20 -> BTC
          if (selectedInputToken.ticker === "ETH") {
            price = ethPrice;
          } else if (selectedInputToken.address) {
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
    selectedInputToken,
    ethPrice,
    erc20Price,
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
          let price: number | null = null;
          if (selectedInputToken.ticker === "ETH") {
            price = ethPrice;
          } else if (selectedInputToken.address) {
            price = erc20Price;
          }
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
      let price: number | null = null;
      const inputTicker = isSwappingForBTC ? selectedInputToken.ticker : "BTC";

      if (inputTicker === "ETH") {
        price = ethPrice;
      } else if (inputTicker === "BTC") {
        price = btcPrice;
      } else if (selectedInputToken.address) {
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
    displayedInputAmount,
    exceedsUserBalance,
    isSwappingForBTC,
    selectedInputToken,
    ethPrice,
    btcPrice,
    erc20Price,
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
        // Pass isRefresh=true since we already have a quote displayed
        if (lastEditedField === "input") {
          if (isSwappingForBTC) {
            console.log("refetching ERC20 to BTC quote");
            await fetchERC20ToBTCQuote(undefined, currentRequestId, true);
          } else {
            await fetchBTCtoERC20Quote(undefined, "ExactInput", currentRequestId);
          }
        } else {
          if (isSwappingForBTC) {
            console.log("refetching ERC20 to BTC exact output quote");
            await fetchERC20ToBTCQuoteExactOutput(undefined, currentRequestId, true);
          } else {
            await fetchBTCtoERC20Quote(undefined, "ExactOutput", currentRequestId);
          }
        }
      } catch (error) {
        console.error("Failed to refetch quote:", error);
        // Reset refetchQuote even on error
        setRefetchQuote(false);
      }
    };

    fetchAndExecute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchQuote, lastEditedField]);

  // Auto-refetch quotes when prices become available
  useEffect(() => {
    let price: number | null = null;
    if (selectedInputToken.ticker === "ETH") {
      price = ethPrice;
    } else if (selectedInputToken.address) {
      price = erc20Price;
    }

    // For ERC20 -> BTC exact input
    if (refetchERC20toBTCQuote && isSwappingForBTC && btcPrice && displayedInputAmount && price) {
      // Determine which price we need based on selected token
      console.log("Auto-refetching ERC20->BTC quote after prices loaded");
      setRefetchERC20toBTCQuote(false);

      fetchERC20ToBTCQuote();
    }

    // For ERC20 -> BTC exact output
    if (
      refetchERC20toBTCQuoteExactOutput &&
      isSwappingForBTC &&
      btcPrice &&
      outputAmount &&
      price
    ) {
      console.log("Auto-refetching ERC20->BTC exact output quote after prices loaded");
      setRefetchERC20toBTCQuoteExactOutput(false);

      fetchERC20ToBTCQuoteExactOutput();
    }

    // For BTC -> ERC20
    if (refetchBTCtoERC20Quote && !isSwappingForBTC && btcPrice) {
      if (selectedOutputToken?.ticker === "cbBTC") {
        price = btcPrice;
      } else if (erc20Price) {
        price = erc20Price;
      }

      // If we have all required prices, refetch the quote
      if (price) {
        console.log("Auto-refetching BTC->ERC20 quote after prices loaded");
        setRefetchBTCtoERC20Quote(false);

        // Determine mode and amount based on which field was last edited
        const mode = lastEditedField === "input" ? "ExactInput" : "ExactOutput";
        const amount = mode === "ExactInput" ? displayedInputAmount : outputAmount;

        if (amount && parseFloat(amount) > 0) {
          fetchBTCtoERC20Quote(amount, mode);
        }
      }
    }
  }, [
    btcPrice,
    ethPrice,
    erc20Price,
    refetchERC20toBTCQuote,
    refetchERC20toBTCQuoteExactOutput,
    refetchBTCtoERC20Quote,
    isSwappingForBTC,
    displayedInputAmount,
    outputAmount,
    lastEditedField,
    selectedInputToken,
    selectedOutputToken,
    fetchERC20ToBTCQuote,
    fetchERC20ToBTCQuoteExactOutput,
    fetchBTCtoERC20Quote,
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

  // sameer logs
  // console.log("[sameer] exceedsAvailableBTCLiquidity", exceedsAvailableBTCLiquidity);
  // console.log("[sameer] exceedsAvailableCBBTCLiquidity", exceedsAvailableCBBTCLiquidity);
  // console.log("[sameer] exceedsUserBalance", exceedsUserBalance);
  // console.log("[sameer] inputBelowMinimum", inputBelowMinimum);
  // console.log("[sameer] outputBelowMinimum", outputBelowMinimum);
  // console.log("[sameer] isLoadingQuote", isLoadingQuote);
  // console.log("[sameer] getQuoteForInputRef.current", getQuoteForInputRef.current);
  // console.log("[sameer] displayedInputAmount", displayedInputAmount);

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
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
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
              selectedInputToken.ticker === "ETH" &&
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
                    Need ETH for gas -
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
              cursor={inputAssetIdentifier !== "BTC" ? "pointer" : "default"}
              asset={inputAssetIdentifier}
              onDropDown={inputAssetIdentifier !== "BTC" ? openAssetSelector : undefined}
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
                    show={showMaxTooltip && selectedInputToken.ticker === "ETH" && isAtAdjustedMax}
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
                onChange={handleOutputChange}
                onKeyDown={handleOutputKeyDown}
                fontFamily="Aux"
                border="none"
                bg="transparent"
                outline="none"
                mr="-150px"
                ml="-5px"
                p="0px"
                letterSpacing="-6px"
                color={
                  (exceedsAvailableBTCLiquidity && lastEditedField === "output") ||
                  outputBelowMinimum
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
                disabled={isOtcServerDead}
                cursor={isOtcServerDead ? "not-allowed" : "text"}
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
                <Text
                  color={!outputAmount ? colors.offWhite : colors.textGray}
                  fontSize="14px"
                  mt="6px"
                  letterSpacing={isLoadingQuote && getQuoteForInputRef.current ? "-4px" : "-1px"}
                  fontWeight="normal"
                  fontFamily="Aux"
                >
                  {isLoadingQuote && getQuoteForInputRef.current ? "..." : outputUsdValue}
                </Text>
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
              // BTC → EVM: Show paste-only text with icon and caret
              <Flex
                align="center"
                gap="5px"
                cursor="pointer"
                transition="opacity 0.15s ease"
                _hover={{ opacity: 0.8 }}
                onClick={() => {
                  setPasteModalType("EVM");
                  setIsPasteModalOpen(true);
                }}
              >
                {selectedOutputAddress ? (
                  <>
                    <FiEdit3 size={12} color="#788CFF" />
                    <Text
                      color="#788CFF"
                      fontSize="14px"
                      fontWeight="500"
                      fontFamily="Aux"
                      letterSpacing="-1px"
                      whiteSpace="nowrap"
                    >
                      {`${selectedOutputAddress.slice(0, 6)}...${selectedOutputAddress.slice(-4)}`}
                    </Text>
                  </>
                ) : (
                  <Text
                    color={colors.textGray}
                    fontSize="14px"
                    fontWeight="500"
                    fontFamily="Aux"
                    letterSpacing="-1px"
                    whiteSpace="nowrap"
                  >
                    Paste address
                  </Text>
                )}
                <FiChevronDown size={12} color="#788CFF" />
              </Flex>
            )}
            {/* Asset tag centered */}
            <WebAssetTag
              cursor={outputAssetIdentifier !== "BTC" ? "pointer" : "default"}
              asset={outputAssetIdentifier}
              onDropDown={outputAssetIdentifier !== "BTC" ? openAssetSelector : undefined}
              isOutput={true}
            />
            {/* Empty spacer to balance the layout */}
            <Flex h="21px" />
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
              erc20Price,
              isSwappingForBTC ? selectedInputToken.ticker : selectedOutputToken?.ticker || "CBBTC"
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
                      { key: "erc20", ...feeOverview.erc20Fee },
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

        {/* Bitcoin Refund Address - For BTC -> cbBTC swaps */}
        {!isSwappingForBTC && !hidePayoutAddress && (
          <Flex
            direction="column"
            w="100%"
            opacity={hasStartedTyping ? 1 : 0}
            transform={hasStartedTyping ? "translateY(0px)" : "translateY(-20px)"}
            transition="all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            transitionDelay={hasStartedTyping ? "0.2s" : "0s"}
            pointerEvents={hasStartedTyping ? "auto" : "none"}
            overflow="visible"
            maxHeight={hasStartedTyping ? "200px" : "0px"}
          >
            {/* Bitcoin Refund Address Label */}
            <Flex ml="8px" alignItems="center" mt="18px" w="100%" mb="10px">
              <Text fontSize="15px" fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                Bitcoin Refund Address
              </Text>
              <Flex pl="5px" mt="-2px">
                <Tooltip
                  show={showRefundAddressTooltip}
                  onMouseEnter={() => setShowRefundAddressTooltip(true)}
                  onMouseLeave={() => setShowRefundAddressTooltip(false)}
                  hoverText={
                    <Text>
                      If the swap fails, your BTC will be refunded to this address. Only P2WPKH,
                      P2PKH, or P2SH Bitcoin addresses are supported.
                    </Text>
                  }
                  iconWidth="12px"
                />
              </Flex>
            </Flex>
            <Flex
              mt="-4px"
              mb="10px"
              px="10px"
              bg={inputStyle?.dark_bg_color || "rgba(46, 29, 14, 0.66)"}
              border={`2px solid ${inputStyle?.bg_color || "#78491F"}`}
              w="100%"
              h="60px"
              borderRadius="16px"
            >
              <Flex direction="row" py="6px" px="8px" w="100%">
                <Input
                  value={btcRefundAddress}
                  onChange={(e) => setBtcRefundAddress(e.target.value)}
                  fontFamily="Aux"
                  border="none"
                  bg="transparent"
                  outline="none"
                  mt="3.5px"
                  mr="15px"
                  ml="-4px"
                  p="0px"
                  w={isMobile ? "100%" : "500px"}
                  letterSpacing={isMobile ? "-2px" : "-5px"}
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
                  fontSize={isMobile ? "18px" : "28px"}
                  placeholder="bc1q5d7rjq7g6rd2d..."
                  _placeholder={{
                    color: inputStyle?.light_text_color || "#856549",
                  }}
                  spellCheck={false}
                />

                {btcRefundAddress.length > 0 && (
                  <Flex ml="0px">
                    <BitcoinAddressValidation
                      address={btcRefundAddress}
                      validation={btcRefundAddressValidation}
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

      {/* EVM Account Warning Modal */}
      <EVMAccountWarningModal
        isOpen={showEVMWarningModal}
        onConfirm={() => {
          setShowEVMWarningModal(false);
        }}
      />
    </Flex>
  );
};
