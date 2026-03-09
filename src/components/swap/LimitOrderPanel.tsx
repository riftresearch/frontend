import { Flex, Text, Input, Spacer, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useCallback, useMemo, ChangeEvent } from "react";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import {
  ZERO_USD_DISPLAY,
  bitcoinStyle,
  evmStyle,
} from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { AddressSelector } from "@/components/other/AddressSelector";
import { PasteAddressModal } from "@/components/other/PasteAddressModal";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore, LimitExpiry } from "@/utils/store";
import { TokenData } from "@/utils/types";
import {
  calculateUsdValue,
  validatePayoutAddress,
  truncateAmount,
} from "@/utils/swapHelpers";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { fetchTokenPrice } from "@/utils/userTokensClient";
import { useSwitchNetwork, useSwitchWallet, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { useBitcoinBalance } from "@/hooks/useBitcoinBalance";

const EXPIRY_OPTIONS: { key: LimitExpiry; label: string; seconds: number }[] = [
  { key: "1h", label: "1 Hour", seconds: 3600 },
  { key: "1d", label: "1 Day", seconds: 86400 },
  { key: "1w", label: "1 Week", seconds: 604800 },
  { key: "1mo", label: "1 Month", seconds: 2592000 },
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

  const isSwappingForBTC = outputToken.chain === "bitcoin";

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
        (c) =>
          c.chain?.toUpperCase() === "EVM" &&
          c.address.toLowerCase() === address.toLowerCase()
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
    [inputToken.chain, outputToken.chain, selectEvmWallet, setBtcAddress, setOutputEvmAddress, setPastedBTCAddress]
  );

  // Fetch token prices
  const fetchTokenPriceForDirection = useCallback(
    async (tokenData: TokenData, direction: "input" | "output") => {
      const setPrice = direction === "input" ? setInputTokenPrice : setOutputTokenPrice;
      if (tokenData.ticker === "BTC" || tokenData.ticker === "cbBTC") {
        setPrice(btcPrice);
        return;
      }
      if (tokenData.ticker === "ETH" || tokenData.address === "0x0000000000000000000000000000000000000000") {
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

    if (
      inputTokenPrice &&
      outputTokenPrice &&
      inputTokenPrice > 0 &&
      outputTokenPrice > 0
    ) {
      const rate = inputTokenPrice / outputTokenPrice;
      setMarketRate(rate);
      setIsLoadingMarketRate(false);

      // Set limit price to market rate on token change or if not yet set
      if (tokensChanged || !limitPrice) {
        setLimitPrice(formatRate(rate));
      }
    } else {
      setMarketRate(null);
      setIsLoadingMarketRate(inputTokenPrice === null || outputTokenPrice === null);
      if (tokensChanged) {
        setLimitPrice("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputTokenPrice, outputTokenPrice, tokenPairKey, setMarketRate, setIsLoadingMarketRate, setLimitPrice]);

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
    [inputToken.ticker, ethPrice, btcPrice, inputTokenPrice, setDisplayedInputAmount, setFullPrecisionInputAmount, setInputUsdValue]
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

    if (value && parseFloat(value) > 0 && displayedInputAmount && parseFloat(displayedInputAmount) > 0) {
      recalcBuyAmount(displayedInputAmount, value);
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

  // USD values update when prices change
  useEffect(() => {
    setInputUsdValue(
      calculateUsdValue(displayedInputAmount, inputToken.ticker, ethPrice, btcPrice, inputTokenPrice)
    );
    setOutputUsdValue(
      calculateUsdValue(outputAmount, outputToken.ticker, ethPrice, btcPrice, outputTokenPrice)
    );
  }, [
    inputTokenPrice, outputTokenPrice, btcPrice, ethPrice,
    displayedInputAmount, outputAmount,
    inputToken.ticker, outputToken.ticker,
    setInputUsdValue, setOutputUsdValue,
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
          <Flex mr="8px" py="12px" direction="column" align="flex-end" justify="space-between" h="100%" flexShrink={0}>
            <AddressSelector
              chainType={inputToken.chain === "bitcoin" ? "BTC" : "EVM"}
              selectedAddress={resolvedInputAddress}
              onSelect={(a) => void handleInputAddressSelect(a)}
              showPasteOption={false}
            />
            <WebAssetTag
              cursor="pointer"
              asset={inputToken.ticker}
              onDropDown={() => { setAssetSelectorDirection("input"); setIsAssetSelectorOpen(true); }}
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
          <Flex mr="8px" py="12px" direction="column" align="flex-end" justify="space-between" h="100%" flexShrink={0}>
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
              onDropDown={() => { setAssetSelectorDirection("output"); setIsAssetSelectorOpen(true); }}
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
          px="16px"
          py="14px"
          bg="#111"
          border={`2px solid ${actualBorderColor}`}
          borderRadius="16px"
          direction="column"
          gap="10px"
        >
          <Flex justify="space-between" align="center">
            <Text
              fontSize="13px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.textGray}
              letterSpacing="-0.5px"
              userSelect="none"
            >
              Limit Price
            </Text>
            {isLoadingMarketRate ? (
              <Spinner size="xs" color={colors.textGray} />
            ) : marketRate !== null ? (
              <Flex align="center" gap="6px">
                <Text
                  fontSize="12px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={colors.darkerGray}
                  letterSpacing="-0.5px"
                  userSelect="none"
                >
                  Market: {formatRate(marketRate)}
                </Text>
                <Text
                  fontSize="11px"
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

          <Flex align="center" gap="8px">
            <Text
              fontSize="13px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.darkerGray}
              letterSpacing="-0.5px"
              whiteSpace="nowrap"
              userSelect="none"
            >
              1 {inputToken.ticker} =
            </Text>
            <Input
              value={limitPrice}
              onChange={handleLimitPriceChange}
              fontFamily={FONT_FAMILIES.AUX_MONO}
              border="none"
              bg="transparent"
              outline="none"
              p="0px"
              fontSize="18px"
              letterSpacing="-1px"
              color={colors.offWhite}
              _active={{ border: "none", boxShadow: "none", outline: "none" }}
              _focus={{ border: "none", boxShadow: "none", outline: "none" }}
              _selected={{ border: "none", boxShadow: "none", outline: "none" }}
              placeholder="0.0"
              _placeholder={{ color: "#333" }}
              flex="1"
            />
            <Text
              fontSize="13px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.darkerGray}
              letterSpacing="-0.5px"
              whiteSpace="nowrap"
              userSelect="none"
            >
              {outputToken.ticker}
            </Text>
          </Flex>

          {/* % diff from market */}
          {pctDiffFromMarket !== null && (
            <Flex align="center" gap="4px">
              <Text
                fontSize="12px"
                fontFamily={FONT_FAMILIES.AUX_MONO}
                letterSpacing="-0.5px"
                color={
                  pctDiffFromMarket > 0
                    ? colors.greenOutline
                    : pctDiffFromMarket < -1
                      ? colors.redHover
                      : colors.textGray
                }
              >
                {pctDiffFromMarket > 0 ? "+" : ""}
                {pctDiffFromMarket.toFixed(2)}% vs market
              </Text>
            </Flex>
          )}
        </Flex>

        {/* Expiration Selector */}
        <Flex mt="10px" gap="6px">
          <Text
            fontSize="12px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.darkerGray}
            letterSpacing="-0.5px"
            alignSelf="center"
            mr="4px"
            userSelect="none"
          >
            Expires
          </Text>
          {EXPIRY_OPTIONS.map(({ key, label }) => {
            const isActive = limitExpiry === key;
            return (
              <Flex
                key={key}
                px="10px"
                py="5px"
                borderRadius="8px"
                cursor="pointer"
                bg={isActive ? "#2a2a2a" : "transparent"}
                border={isActive ? "1px solid #444" : "1px solid transparent"}
                onClick={() => setLimitExpiry(key)}
                transition="all 0.15s ease"
                _hover={!isActive ? { bg: "#1e1e1e" } : undefined}
              >
                <Text
                  fontSize="11px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  fontWeight={isActive ? "bold" : "normal"}
                  color={isActive ? colors.offWhite : colors.darkerGray}
                  letterSpacing="-0.5px"
                  userSelect="none"
                >
                  {label}
                </Text>
              </Flex>
            );
          })}
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
