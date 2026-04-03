import { Flex, Text, Input, Spacer, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useCallback, useMemo, ChangeEvent } from "react";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import { ZERO_USD_DISPLAY, bitcoinStyle, evmStyle } from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { AddressSelector } from "@/components/other/AddressSelector";
import { PasteAddressModal } from "@/components/other/PasteAddressModal";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore, LimitExpiry } from "@/utils/store";
import { TokenData } from "@/utils/types";
import { calculateUsdValue, validatePayoutAddress, truncateAmount } from "@/utils/swapHelpers";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { fetchTokenPrice } from "@/utils/userTokensClient";
import { useSwitchNetwork, useSwitchWallet, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { useBitcoinBalance } from "@/hooks/useBitcoinBalance";

const EXPIRY_OPTIONS: { key: LimitExpiry; label: string; seconds: number }[] = [
  { key: "1h", label: "1 Hour", seconds: 3600 },
  { key: "1d", label: "1 Day", seconds: 86400 },
  { key: "1w", label: "1 Week", seconds: 604800 },
  { key: "1mo", label: "1 Month", seconds: 2592000 },
  { key: "1y", label: "1 Year", seconds: 31536000 },
];

export function getExpirySeconds(expiry: LimitExpiry): number {
  return EXPIRY_OPTIONS.find((o) => o.key === expiry)?.seconds ?? 86400;
}

/**
 * Format a rate with 6 significant figures.
 */
function formatRate(rate: number): string {
  if (rate === 0) return "0";
  return rate.toPrecision(6);
}

export const LimitOrderPanel = () => {
  const { isMobile } = useWindowSize();
  const userWallets = useUserWallets();
  const switchWallet = useSwitchWallet();
  const switchNetwork = useSwitchNetwork();

  // Store state
  const {
    inputToken,
    outputToken,
    setInputToken,
    setOutputToken,
    displayedInputAmount,
    setDisplayedInputAmount,
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
    isOtcServerDead,
    limitPrice,
    setLimitPrice,
    limitExpiry,
    setLimitExpiry,
    marketRate,
    setMarketRate,
    isLoadingMarketRate,
    setIsLoadingMarketRate,
    limitLastEditedField,
    setLimitLastEditedField,
    primaryEvmAddress,
    setPrimaryEvmAddress,
    btcAddress,
    setBtcAddress,
    pastedBTCAddress,
    setPastedBTCAddress,
    outputEvmAddress,
    setOutputEvmAddress,
    setFullPrecisionInputAmount,
  } = useStore();

  useBtcEthPrices();

  // Local state
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [assetSelectorDirection, setAssetSelectorDirection] = useState<"input" | "output">("input");
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalType, setPasteModalType] = useState<"EVM" | "BTC">("BTC");
  const [isExpiryDropdownOpen, setIsExpiryDropdownOpen] = useState(false);

  const isSwappingForBTC = outputToken.chain === "bitcoin";

  // Stablecoin pricing flip: show "1 BTC = X USDC" instead of "1 USDC = 0.00001 BTC"
  const STABLECOINS = ["USDC", "USDT"];
  const isInputStablecoin = STABLECOINS.includes(inputToken.ticker);
  const isOutputStablecoin = STABLECOINS.includes(outputToken.ticker);
  const shouldFlipPricing = isInputStablecoin && !isOutputStablecoin;

  const evmWalletAddresses = useMemo(
    () =>
      userWallets
        .filter((w) => w.chain?.toUpperCase() === "EVM")
        .map((w) => w.address.toLowerCase()),
    [userWallets]
  );

  const resolvedInputAddress = inputToken.chain === "bitcoin" ? btcAddress : primaryEvmAddress;
  const resolvedOutputAddress =
    outputToken.chain === "bitcoin"
      ? pastedBTCAddress || btcAddress
      : inputToken.chain === "bitcoin"
        ? outputEvmAddress || primaryEvmAddress
        : primaryEvmAddress;

  const inputStyle = inputToken.chain === "bitcoin" ? bitcoinStyle : evmStyle;
  const outputStyle = outputToken.chain === "bitcoin" ? bitcoinStyle : evmStyle;
  const actualBorderColor = "#323232";

  // Bitcoin balance
  const { balanceBtc: btcBalanceBtc } = useBitcoinBalance(btcAddress);

  // Wallet selection
  const selectEvmWallet = useCallback(
    async (address: string, targetChainId?: number) => {
      const wallet = userWallets.find(
        (c) => c.chain?.toUpperCase() === "EVM" && c.address.toLowerCase() === address.toLowerCase()
      );
      if (!wallet) return;
      try {
        await switchWallet(wallet.id);
        setPrimaryEvmAddress(wallet.address);
        if (targetChainId !== undefined) {
          const currentNetwork = Number(await wallet.getNetwork());
          if (currentNetwork !== targetChainId) {
            await switchNetwork({ wallet, network: targetChainId });
          }
        }
      } catch (error) {
        console.error("[LimitOrderPanel] Failed to select EVM wallet:", error);
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
      await selectEvmWallet(address, inputToken.chain as number);
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
      await selectEvmWallet(address, inputToken.chain as number);
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

  // Fetch token prices
  const fetchTokenPriceForDirection = useCallback(
    async (tokenData: TokenData, direction: "input" | "output") => {
      const setPrice = direction === "input" ? setInputTokenPrice : setOutputTokenPrice;
      if (tokenData.ticker === "BTC" || tokenData.ticker === "cbBTC") {
        setPrice(btcPrice);
        return;
      }
      if (
        tokenData.ticker === "ETH" ||
        tokenData.address === "0x0000000000000000000000000000000000000000"
      ) {
        setPrice(ethPrice);
        return;
      }
      const chainName = tokenData.chain === 8453 ? "base" : "ethereum";
      try {
        const result = await fetchTokenPrice(chainName, tokenData.address);
        if (result && typeof result.price === "number") setPrice(result.price);
      } catch (error) {
        console.error(`Failed to fetch ${direction} token price:`, error);
      }
    },
    [setInputTokenPrice, setOutputTokenPrice, btcPrice, ethPrice]
  );

  useEffect(() => {
    fetchTokenPriceForDirection(inputToken, "input");
  }, [inputToken, fetchTokenPriceForDirection]);

  useEffect(() => {
    fetchTokenPriceForDirection(outputToken, "output");
  }, [outputToken, fetchTokenPriceForDirection]);

  // ============================================================================
  // MARKET RATE (derived from DefiLlama USD prices already in the store)
  // ============================================================================

  // Track token identity so we know when to reset the limit price
  const tokenPairKey = `${inputToken.chain}-${inputToken.address}-${outputToken.chain}-${outputToken.address}`;
  const [lastTokenPairKey, setLastTokenPairKey] = useState("");

  useEffect(() => {
    const tokensChanged = tokenPairKey !== lastTokenPairKey;

    if (tokensChanged) {
      setLastTokenPairKey(tokenPairKey);
    }

    if (inputTokenPrice && outputTokenPrice && inputTokenPrice > 0 && outputTokenPrice > 0) {
      const rate = inputTokenPrice / outputTokenPrice;
      setMarketRate(rate);
      setIsLoadingMarketRate(false);

      // Set limit price to +1% above market rate on token change or if not yet set
      // This gives users a better deal by default (green direction)
      if (tokensChanged || !limitPrice) {
        setLimitPrice(formatRate(rate * 1.01));
      }
    } else {
      setMarketRate(null);
      setIsLoadingMarketRate(inputTokenPrice === null || outputTokenPrice === null);
      if (tokensChanged) {
        setLimitPrice("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputTokenPrice,
    outputTokenPrice,
    tokenPairKey,
    setMarketRate,
    setIsLoadingMarketRate,
    setLimitPrice,
  ]);

  // ============================================================================
  // LINKED FIELD CALCULATIONS (all local, no API calls)
  // ============================================================================

  const recalcBuyAmount = useCallback(
    (sellAmt: string, price: string) => {
      const sell = parseFloat(sellAmt);
      const p = parseFloat(price);
      if (!Number.isFinite(sell) || !Number.isFinite(p) || sell <= 0 || p <= 0) {
        setOutputAmount("");
        setOutputUsdValue(ZERO_USD_DISPLAY);
        return;
      }
      const buyAmt = (sell * p).toPrecision(8);
      const truncated = truncateAmount(buyAmt);
      setOutputAmount(truncated);
      setOutputUsdValue(
        calculateUsdValue(truncated, outputToken.ticker, ethPrice, btcPrice, outputTokenPrice)
      );
    },
    [outputToken.ticker, ethPrice, btcPrice, outputTokenPrice, setOutputAmount, setOutputUsdValue]
  );

  const recalcSellAmount = useCallback(
    (buyAmt: string, price: string) => {
      const buy = parseFloat(buyAmt);
      const p = parseFloat(price);
      if (!Number.isFinite(buy) || !Number.isFinite(p) || buy <= 0 || p <= 0) {
        setDisplayedInputAmount("");
        setFullPrecisionInputAmount(null);
        setInputUsdValue(ZERO_USD_DISPLAY);
        return;
      }
      const sellAmt = (buy / p).toPrecision(8);
      const truncated = truncateAmount(sellAmt);
      setDisplayedInputAmount(truncated);
      setFullPrecisionInputAmount(truncated);
      setInputUsdValue(
        calculateUsdValue(truncated, inputToken.ticker, ethPrice, btcPrice, inputTokenPrice)
      );
    },
    [
      inputToken.ticker,
      ethPrice,
      btcPrice,
      inputTokenPrice,
      setDisplayedInputAmount,
      setFullPrecisionInputAmount,
      setInputUsdValue,
    ]
  );

  // ============================================================================
  // INPUT HANDLERS
  // ============================================================================

  const handleSellAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (displayedInputAmount === "" && (value === "0" || value === ".")) value = "0.";
    if (value !== "" && !/^\d*\.?\d{0,8}$/.test(value)) return;

    setDisplayedInputAmount(value);
    setFullPrecisionInputAmount(value);
    setLimitLastEditedField("sell");

    const usd = calculateUsdValue(value, inputToken.ticker, ethPrice, btcPrice, inputTokenPrice);
    setInputUsdValue(usd);

    if (value && parseFloat(value) > 0 && limitPrice && parseFloat(limitPrice) > 0) {
      recalcBuyAmount(value, limitPrice);
    } else {
      setOutputAmount("");
      setOutputUsdValue(ZERO_USD_DISPLAY);
    }
  };

  const handleBuyAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (outputAmount === "" && (value === "0" || value === ".")) value = "0.";
    if (value !== "" && !/^\d*\.?\d{0,8}$/.test(value)) return;

    setOutputAmount(value);
    setLimitLastEditedField("buy");

    const usd = calculateUsdValue(value, outputToken.ticker, ethPrice, btcPrice, outputTokenPrice);
    setOutputUsdValue(usd);

    // Limit price is authoritative — derive sell amount from buy amount / limit price
    if (value && parseFloat(value) > 0 && limitPrice && parseFloat(limitPrice) > 0) {
      recalcSellAmount(value, limitPrice);
    } else {
      setDisplayedInputAmount("");
      setFullPrecisionInputAmount(null);
      setInputUsdValue(ZERO_USD_DISPLAY);
    }
  };

  const handleLimitPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (limitPrice === "" && (value === "0" || value === ".")) value = "0.";
    if (value !== "" && !/^\d*\.?\d{0,18}$/.test(value)) return;

    setLimitPrice(value);
    setLimitLastEditedField("price");

    if (
      value &&
      parseFloat(value) > 0 &&
      displayedInputAmount &&
      parseFloat(displayedInputAmount) > 0
    ) {
      recalcBuyAmount(displayedInputAmount, value);
    }
  };

  // Local state for the displayed price input (used when flipped)
  const [displayedPriceInput, setDisplayedPriceInput] = useState("");

  // Sync displayed price input when limit price changes
  useEffect(() => {
    const lp = parseFloat(limitPrice);
    if (Number.isFinite(lp) && lp > 0) {
      if (shouldFlipPricing) {
        setDisplayedPriceInput(formatRate(1 / lp));
      } else {
        setDisplayedPriceInput(limitPrice);
      }
    } else {
      setDisplayedPriceInput(limitPrice);
    }
  }, [limitPrice, shouldFlipPricing]);

  // Handler for displayed price input (converts back to actual limitPrice when flipped)
  const handleDisplayedPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (displayedPriceInput === "" && (value === "0" || value === ".")) value = "0.";
    if (value !== "" && !/^\d*\.?\d{0,18}$/.test(value)) return;

    setDisplayedPriceInput(value);
    setLimitLastEditedField("price");

    if (shouldFlipPricing) {
      const displayedVal = parseFloat(value);
      if (Number.isFinite(displayedVal) && displayedVal > 0) {
        const actualPrice = formatRate(1 / displayedVal);
        setLimitPrice(actualPrice);
        if (displayedInputAmount && parseFloat(displayedInputAmount) > 0) {
          recalcBuyAmount(displayedInputAmount, actualPrice);
        }
      } else if (value === "") {
        setLimitPrice("");
      }
    } else {
      setLimitPrice(value);
      if (
        value &&
        parseFloat(value) > 0 &&
        displayedInputAmount &&
        parseFloat(displayedInputAmount) > 0
      ) {
        recalcBuyAmount(displayedInputAmount, value);
      }
    }
  };

  // ============================================================================
  // % DIFFERENCE FROM MARKET
  // ============================================================================

  const pctDiffFromMarket = useMemo(() => {
    if (!marketRate || !limitPrice) return null;
    const lp = parseFloat(limitPrice);
    if (!Number.isFinite(lp) || lp <= 0 || marketRate <= 0) return null;
    return ((lp - marketRate) / marketRate) * 100;
  }, [marketRate, limitPrice]);

  // Display values for flipped stablecoin pricing
  const displayedMarketRate = useMemo(() => {
    if (!marketRate) return null;
    return shouldFlipPricing ? 1 / marketRate : marketRate;
  }, [marketRate, shouldFlipPricing]);

  const displayedLimitPrice = useMemo(() => {
    const lp = parseFloat(limitPrice);
    if (!Number.isFinite(lp) || lp <= 0) return "";
    return shouldFlipPricing ? formatRate(1 / lp) : limitPrice;
  }, [limitPrice, shouldFlipPricing]);

  const displayedPctDiff = useMemo(() => {
    if (pctDiffFromMarket === null) return null;
    return shouldFlipPricing ? -pctDiffFromMarket : pctDiffFromMarket;
  }, [pctDiffFromMarket, shouldFlipPricing]);

  // Local state for percentage input display
  const [percentInput, setPercentInput] = useState("");

  // Sync percentage input with calculated pctDiffFromMarket when limit price changes externally
  useEffect(() => {
    if (displayedPctDiff !== null) {
      setPercentInput(displayedPctDiff.toFixed(2));
    } else {
      setPercentInput("");
    }
  }, [displayedPctDiff]);

  const handlePercentInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow numbers, minus sign, and decimal point
    if (raw !== "" && !/^-?\d*\.?\d{0,2}$/.test(raw)) return;

    setPercentInput(raw);

    if (!marketRate || marketRate <= 0) return;

    const pct = parseFloat(raw);
    if (!Number.isFinite(pct)) return;

    // In flipped mode, negate the percentage for actual calculation
    const actualPct = shouldFlipPricing ? -pct : pct;
    const newPrice = marketRate * (1 + actualPct / 100);
    if (newPrice > 0) {
      const rateStr = formatRate(newPrice);
      setLimitPrice(rateStr);
      setLimitLastEditedField("price");
      if (displayedInputAmount && parseFloat(displayedInputAmount) > 0) {
        recalcBuyAmount(displayedInputAmount, rateStr);
      }
    }
  };

  const applyPercentAdjustment = useCallback(
    (delta: number) => {
      if (!marketRate || marketRate <= 0) return;
      const currentPct = pctDiffFromMarket ?? 0;
      const newPct = currentPct + delta;
      const newPrice = marketRate * (1 + newPct / 100);
      if (newPrice > 0) {
        const rateStr = formatRate(newPrice);
        setLimitPrice(rateStr);
        setLimitLastEditedField("price");
        if (displayedInputAmount && parseFloat(displayedInputAmount) > 0) {
          recalcBuyAmount(displayedInputAmount, rateStr);
        }
      }
    },
    [
      marketRate,
      pctDiffFromMarket,
      displayedInputAmount,
      setLimitPrice,
      setLimitLastEditedField,
      recalcBuyAmount,
    ]
  );

  // USD values update when prices change
  useEffect(() => {
    setInputUsdValue(
      calculateUsdValue(
        displayedInputAmount,
        inputToken.ticker,
        ethPrice,
        btcPrice,
        inputTokenPrice
      )
    );
    setOutputUsdValue(
      calculateUsdValue(outputAmount, outputToken.ticker, ethPrice, btcPrice, outputTokenPrice)
    );
  }, [
    inputTokenPrice,
    outputTokenPrice,
    btcPrice,
    ethPrice,
    displayedInputAmount,
    outputAmount,
    inputToken.ticker,
    outputToken.ticker,
    setInputUsdValue,
    setOutputUsdValue,
  ]);

  // ============================================================================
  // TOKEN SWAP
  // ============================================================================

  const handleSwapReverse = () => {
    const prev = inputToken;
    const prevInputPrice = inputTokenPrice;
    const prevOutputPrice = outputTokenPrice;
    setInputToken(outputToken);
    setOutputToken(prev);
    // Swap prices so market rate recalculates immediately
    setInputTokenPrice(prevOutputPrice);
    setOutputTokenPrice(prevInputPrice);
    setDisplayedInputAmount("");
    setOutputAmount("");
    setLimitPrice("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setPastedBTCAddress(null);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Flex w="100%" direction="column">
      {/* Sell Section */}
      <Flex w="100%" flexDir="column" position="relative">
        <Flex
          px="10px"
          bg={inputStyle.dark_bg_color}
          w="100%"
          h="150px"
          border="2px solid"
          borderColor={inputStyle.bg_color}
          borderRadius="16px"
        >
          <Flex direction="column" py="12px" px="8px" justify="space-between" h="100%">
            <Text
              color={!displayedInputAmount ? colors.offWhite : colors.textGray}
              fontSize="14px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              userSelect="none"
            >
              You Sell
            </Text>
            <Input
              value={displayedInputAmount}
              onChange={handleSellAmountChange}
              fontFamily="Aux"
              border="none"
              bg="transparent"
              outline="none"
              mr="-150px"
              ml="-5px"
              p="0px"
              letterSpacing="-6px"
              color={colors.offWhite}
              _active={{ border: "none", boxShadow: "none", outline: "none" }}
              _focus={{ border: "none", boxShadow: "none", outline: "none" }}
              _selected={{ border: "none", boxShadow: "none", outline: "none" }}
              fontSize={isMobile ? "35px" : "46px"}
              placeholder="0.0"
              _placeholder={{ color: inputStyle.light_text_color }}
              disabled={isOtcServerDead}
            />
            <Text
              color={!displayedInputAmount ? colors.offWhite : colors.textGray}
              fontSize="14px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              mt="6px"
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
            justify="space-between"
            h="100%"
            flexShrink={0}
          >
            <AddressSelector
              chainType={inputToken.chain === "bitcoin" ? "BTC" : "EVM"}
              selectedAddress={resolvedInputAddress}
              onSelect={(a) => void handleInputAddressSelect(a)}
              showPasteOption={false}
            />
            <WebAssetTag
              cursor="pointer"
              asset={inputToken.ticker}
              onDropDown={() => {
                setAssetSelectorDirection("input");
                setIsAssetSelectorOpen(true);
              }}
            />
            <Flex h="21px" />
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

        {/* Buy Section */}
        <Flex
          mt="5px"
          px="10px"
          bg={outputStyle.dark_bg_color}
          w="100%"
          h="150px"
          border="2px solid"
          borderColor={outputStyle.bg_color}
          borderRadius="16px"
        >
          <Flex direction="column" py="12px" px="8px" justify="space-between" h="100%">
            <Text
              color={!outputAmount ? colors.offWhite : colors.textGray}
              fontSize="14px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              userSelect="none"
            >
              You Buy
            </Text>
            <Input
              value={outputAmount}
              onChange={handleBuyAmountChange}
              fontFamily="Aux"
              border="none"
              bg="transparent"
              outline="none"
              mr="-150px"
              ml="-5px"
              p="0px"
              letterSpacing="-6px"
              color={colors.offWhite}
              _active={{ border: "none", boxShadow: "none", outline: "none" }}
              _focus={{ border: "none", boxShadow: "none", outline: "none" }}
              _selected={{ border: "none", boxShadow: "none", outline: "none" }}
              fontSize={isMobile ? "35px" : "46px"}
              placeholder="0.0"
              _placeholder={{ color: outputStyle.light_text_color }}
              disabled={isOtcServerDead}
            />
            <Text
              color={!outputAmount ? colors.offWhite : colors.textGray}
              fontSize="14px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              mt="6px"
            >
              {outputUsdValue}
            </Text>
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
            <AddressSelector
              chainType={outputToken.chain === "bitcoin" ? "BTC" : "EVM"}
              selectedAddress={resolvedOutputAddress}
              onSelect={(a) => void handleOutputAddressSelect(a)}
              onPasteAddress={() => {
                setPasteModalType(outputToken.chain === "bitcoin" ? "BTC" : "EVM");
                setIsPasteModalOpen(true);
              }}
              showPasteOption={true}
            />
            <WebAssetTag
              cursor="pointer"
              asset={outputToken.ticker}
              onDropDown={() => {
                setAssetSelectorDirection("output");
                setIsAssetSelectorOpen(true);
              }}
              isOutput={true}
            />
            <Flex h="21px" />
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

        {/* Limit Price Input */}
        <Flex
          mt="12px"
          px={isMobile ? "12px" : "16px"}
          py={isMobile ? "12px" : "14px"}
          bg="#111"
          border={`2px solid ${actualBorderColor}`}
          borderRadius={isMobile ? "12px" : "16px"}
          direction="column"
          gap={isMobile ? "10px" : "12px"}
        >
          {/* Top row: Limit Price left, Expiry dropdown, Market rate on far right */}
          <Flex
            justify="space-between"
            align={isMobile ? "flex-start" : "center"}
            direction={isMobile ? "column" : "row"}
            gap={isMobile ? "8px" : "0"}
          >
            <Flex align="center" gap={isMobile ? "8px" : "10px"} flexWrap="wrap">
              <Text
                fontSize={isMobile ? "12px" : "13px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.textGray}
                letterSpacing="-0.5px"
                userSelect="none"
              >
                Limit Price
              </Text>
              {/* Expiry Dropdown */}
              <Flex position="relative">
                <Flex
                  align="center"
                  gap="4px"
                  px={isMobile ? "6px" : "8px"}
                  py="4px"
                  bg="#1a1a1a"
                  borderRadius="6px"
                  border="1px solid #2a2a2a"
                  cursor="pointer"
                  onClick={() => setIsExpiryDropdownOpen(!isExpiryDropdownOpen)}
                  _hover={{ bg: "#222", borderColor: "#3a3a3a" }}
                  transition="all 0.15s ease"
                >
                  <Text
                    fontSize={isMobile ? "10px" : "11px"}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color={colors.textGray}
                    letterSpacing="-0.5px"
                    userSelect="none"
                  >
                    Expiry: {EXPIRY_OPTIONS.find((o) => o.key === limitExpiry)?.label || "1 Day"}
                  </Text>
                  <Text fontSize="8px" color={colors.darkerGray} userSelect="none">
                    ▼
                  </Text>
                </Flex>
                {isExpiryDropdownOpen && (
                  <Flex
                    position="absolute"
                    top="100%"
                    left="0"
                    mt="4px"
                    direction="column"
                    bg="#1a1a1a"
                    border="1px solid #2a2a2a"
                    borderRadius="8px"
                    overflow="hidden"
                    zIndex="dropdown"
                    minW="90px"
                  >
                    {EXPIRY_OPTIONS.map(({ key, label }) => {
                      const isActive = limitExpiry === key;
                      return (
                        <Flex
                          key={key}
                          px="10px"
                          py="6px"
                          cursor="pointer"
                          bg={isActive ? "#2a2a2a" : "transparent"}
                          _hover={{ bg: "#252525" }}
                          onClick={() => {
                            setLimitExpiry(key);
                            setIsExpiryDropdownOpen(false);
                          }}
                        >
                          <Text
                            fontSize="11px"
                            fontFamily={FONT_FAMILIES.AUX_MONO}
                            color={isActive ? colors.offWhite : colors.textGray}
                            letterSpacing="-0.5px"
                            userSelect="none"
                          >
                            {label}
                          </Text>
                        </Flex>
                      );
                    })}
                  </Flex>
                )}
              </Flex>
            </Flex>
            {isLoadingMarketRate ? (
              <Spinner size="xs" color={colors.textGray} />
            ) : displayedMarketRate !== null ? (
              <Flex align="center" gap={isMobile ? "4px" : "6px"}>
                <Text
                  fontSize={isMobile ? "10px" : "12px"}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.darkerGray}
                  letterSpacing="-0.5px"
                  userSelect="none"
                >
                  {isMobile ? "Mkt:" : "Market Rate:"} {formatRate(displayedMarketRate)}
                </Text>
                <Text
                  fontSize={isMobile ? "10px" : "11px"}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={inputStyle.border_color_light}
                  letterSpacing="-0.5px"
                  cursor="pointer"
                  _hover={{ textDecoration: "underline" }}
                  onClick={() => {
                    if (marketRate) {
                      const rateStr = formatRate(marketRate);
                      setLimitPrice(rateStr);
                      setLimitLastEditedField("price");
                      if (displayedInputAmount && parseFloat(displayedInputAmount) > 0) {
                        recalcBuyAmount(displayedInputAmount, rateStr);
                      }
                    }
                  }}
                >
                  Use
                </Text>
              </Flex>
            ) : null}
          </Flex>

          {/* Middle row: rate input left, percentage right - stacks on mobile */}
          <Flex
            justify="space-between"
            align={isMobile ? "stretch" : "center"}
            gap={isMobile ? "10px" : "16px"}
            direction={isMobile ? "column" : "row"}
          >
            {/* Left: Rate input */}
            <Flex align="center" gap="6px" flex={isMobile ? "none" : "1"}>
              <Text
                fontSize={isMobile ? "10px" : "11px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={shouldFlipPricing ? colors.greenOutline : colors.redHover}
                letterSpacing="-0.5px"
                fontWeight="bold"
                userSelect="none"
                flexShrink={0}
              >
                {shouldFlipPricing ? "BUY" : "SELL"}
              </Text>
              <Text
                fontSize={isMobile ? "11px" : "13px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color={colors.darkerGray}
                letterSpacing="-0.5px"
                whiteSpace="nowrap"
                userSelect="none"
                flexShrink={0}
              >
                1 {shouldFlipPricing ? outputToken.ticker : inputToken.ticker} =
              </Text>
              <Flex
                align="center"
                bg="#1a1a1a"
                borderRadius="8px"
                px={isMobile ? "8px" : "10px"}
                py="6px"
                border="1px solid #2a2a2a"
                flex="1"
                minW="0"
              >
                <Input
                  value={displayedPriceInput}
                  onChange={handleDisplayedPriceChange}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  border="none"
                  bg="transparent"
                  outline="none"
                  p="0px"
                  fontSize={isMobile ? "16px" : "18px"}
                  letterSpacing="-1px"
                  color={colors.offWhite}
                  _active={{ border: "none", boxShadow: "none", outline: "none" }}
                  _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                  _selected={{ border: "none", boxShadow: "none", outline: "none" }}
                  placeholder="0.0"
                  _placeholder={{ color: "#333" }}
                  flex="1"
                  minW="0"
                  textAlign="left"
                />
                <Text
                  fontSize={isMobile ? "11px" : "13px"}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.darkerGray}
                  letterSpacing="-0.5px"
                  whiteSpace="nowrap"
                  userSelect="none"
                  ml="4px"
                  flexShrink={0}
                >
                  {shouldFlipPricing ? inputToken.ticker : outputToken.ticker}
                </Text>
              </Flex>
            </Flex>

            {/* Right: Percentage input - full width on mobile */}
            <Flex
              align="center"
              justify={isMobile ? "space-between" : "flex-end"}
              bg="#1a1a1a"
              borderRadius="8px"
              px={isMobile ? "12px" : "10px"}
              py="8px"
              border="1px solid #2a2a2a"
              flex={isMobile ? "none" : "0 0 auto"}
            >
              {isMobile && (
                <Text
                  fontSize="11px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.darkerGray}
                  letterSpacing="-0.5px"
                  userSelect="none"
                >
                  Adjustment
                </Text>
              )}
              <Flex align="center">
                <Text
                  fontSize={isMobile ? "15px" : "16px"}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={
                    displayedPctDiff !== null && displayedPctDiff > 0
                      ? shouldFlipPricing ? colors.redHover : colors.greenOutline
                      : displayedPctDiff !== null && displayedPctDiff < 0
                        ? shouldFlipPricing ? colors.greenOutline : colors.redHover
                        : colors.darkerGray
                  }
                  letterSpacing="-0.5px"
                  mr="2px"
                  userSelect="none"
                >
                  {displayedPctDiff !== null && displayedPctDiff >= 0 ? "+" : ""}
                </Text>
                <Input
                  value={percentInput}
                  onChange={handlePercentInputChange}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  border="none"
                  bg="transparent"
                  outline="none"
                  p="0px"
                  w={isMobile ? "60px" : "80px"}
                  fontSize={isMobile ? "15px" : "16px"}
                  letterSpacing="-0.5px"
                  color={
                    displayedPctDiff !== null && displayedPctDiff > 0
                      ? shouldFlipPricing ? colors.redHover : colors.greenOutline
                      : displayedPctDiff !== null && displayedPctDiff < 0
                        ? shouldFlipPricing ? colors.greenOutline : colors.redHover
                        : colors.offWhite
                  }
                  _active={{ border: "none", boxShadow: "none", outline: "none" }}
                  _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                  _selected={{ border: "none", boxShadow: "none", outline: "none" }}
                  placeholder="0.00"
                  _placeholder={{ color: "#444" }}
                  textAlign="right"
                />
                <Text
                  fontSize={isMobile ? "13px" : "14px"}
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={
                    displayedPctDiff !== null && displayedPctDiff > 0
                      ? shouldFlipPricing ? colors.redHover : colors.greenOutline
                      : displayedPctDiff !== null && displayedPctDiff < 0
                        ? shouldFlipPricing ? colors.greenOutline : colors.redHover
                        : colors.darkerGray
                  }
                  letterSpacing="-0.5px"
                  ml="4px"
                  userSelect="none"
                >
                  %
                </Text>
              </Flex>
            </Flex>
          </Flex>

          {/* Bottom row: % vs market left, quick buttons right */}
          <Flex justify="space-between" align="center" flexWrap="wrap" gap={isMobile ? "8px" : "0"}>
            {/* % vs market indicator */}
            {displayedPctDiff !== null && (
              <Text
                fontSize={isMobile ? "11px" : "12px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                letterSpacing="-0.5px"
                color={
                  displayedPctDiff > 0
                    ? shouldFlipPricing ? colors.redHover : colors.greenOutline
                    : displayedPctDiff < -1
                      ? shouldFlipPricing ? colors.greenOutline : colors.redHover
                      : colors.textGray
                }
              >
                {displayedPctDiff > 0 ? "+" : ""}
                {displayedPctDiff.toFixed(2)}% vs market
              </Text>
            )}

            {/* Quick adjustment buttons - flipped shows negative % (better deal = pay less stablecoin) */}
            <Flex gap={isMobile ? "4px" : "6px"}>
              {(shouldFlipPricing ? [-5, -10] : [5, 10]).map((displayPct) => (
                <Flex
                  key={displayPct}
                  px={isMobile ? "8px" : "10px"}
                  py={isMobile ? "4px" : "5px"}
                  borderRadius="8px"
                  cursor="pointer"
                  bg="#1a1a1a"
                  border="1px solid #2a2a2a"
                  onClick={() => applyPercentAdjustment(shouldFlipPricing ? -displayPct : displayPct)}
                  transition="all 0.15s ease"
                  _hover={{ bg: "#252525", borderColor: "#3a3a3a" }}
                >
                  <Text
                    fontSize={isMobile ? "10px" : "11px"}
                    fontFamily={FONT_FAMILIES.AUX_MONO}
                    color={colors.textGray}
                    letterSpacing="-0.5px"
                    userSelect="none"
                  >
                    {displayPct > 0 ? "+" : ""}
                    {displayPct}%
                  </Text>
                </Flex>
              ))}
            </Flex>
          </Flex>

          {/* Warning when limit price is below market (worse deal - may fill instantly) */}
          {pctDiffFromMarket !== null && pctDiffFromMarket < 0 && (
            <Flex
              mt={isMobile ? "8px" : "10px"}
              px={isMobile ? "10px" : "12px"}
              py={isMobile ? "8px" : "10px"}
              bg="rgba(180, 150, 50, 0.1)"
              border="1px solid rgba(180, 150, 50, 0.5)"
              borderRadius="8px"
            >
              <Text
                fontSize={isMobile ? "10px" : "12px"}
                fontFamily={FONT_FAMILIES.AUX_MONO}
                color="#b49632"
                letterSpacing="-0.5px"
              >
                {shouldFlipPricing
                  ? `Trigger price is +${Math.abs(pctDiffFromMarket).toFixed(2)}% above market price and may fill instantly`
                  : `Trigger price is ${pctDiffFromMarket.toFixed(2)}% below market price and may fill instantly`}
              </Text>
            </Flex>
          )}
        </Flex>
      </Flex>

      {/* Asset Selector Modal */}
      <AssetSelectorModal
        isOpen={isAssetSelectorOpen}
        onClose={() => setIsAssetSelectorOpen(false)}
        currentAsset={inputToken.ticker}
        direction={assetSelectorDirection}
      />
    </Flex>
  );
};
