import { Flex, Text, Input, Spacer, Spinner, Image } from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { colors } from "@/utils/colors";
import useWindowSize from "@/hooks/useWindowSize";
import { useCowSwapClient } from "@/components/providers/CowSwapProvider";
import {
  GLOBAL_CONFIG,
  ZERO_USD_DISPLAY,
  ETHEREUM_POPULAR_TOKENS,
  BASE_POPULAR_TOKENS,
  BITCOIN_DECIMALS,
  MIN_SWAP_SATS,
  opaqueBackgroundColor,
} from "@/utils/constants";
import WebAssetTag from "@/components/other/WebAssetTag";
import { AssetSelectorModal } from "@/components/other/AssetSelectorModal";
import { useStore } from "@/utils/store";
import { TokenData } from "@/utils/types";
import { formatLotAmount } from "@/utils/rfqClient";
import {
  getERC20ToBTCQuote,
  callRFQ,
  isAboveMinSwap,
  calculateUsdValue,
  satsToBtc,
  getSlippageBpsForNotional,
} from "@/utils/swapHelpers";
import { PriceQuality } from "@cowprotocol/cow-sdk";
import { formatUnits, parseUnits } from "viem";
import { useMaxLiquidity } from "@/hooks/useLiquidity";
import { saveSwapStateToCookie, loadSwapStateFromCookie } from "@/utils/swapStateCookies";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { fetchTokenPrice } from "@/utils/userTokensClient";
import { RiftLogo } from "@/components/other/RiftLogo";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { SwapSDK, Chains, Assets } from "@chainflip/sdk/swap";

// Calculate minimum BTC amount once
const MIN_BTC = parseFloat(satsToBtc(MIN_SWAP_SATS));

// cbBTC address (same on Ethereum and Base)
const CBBTC_ADDRESS = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

// Initialize Chainflip SDK (singleton)
let chainflipSDK: SwapSDK | null = null;
function getChainflipSDK(): SwapSDK {
  if (!chainflipSDK) {
    chainflipSDK = new SwapSDK({
      network: "mainnet",
    });
  }
  return chainflipSDK;
}

// Chainflip asset mapping from ticker to SDK Asset
const CHAINFLIP_ASSET_MAP: Record<string, (typeof Assets)[keyof typeof Assets]> = {
  ETH: Assets.ETH,
  USDC: Assets.USDC,
  USDT: Assets.USDT,
  FLIP: Assets.FLIP,
};

// Thorchain API - proxied through our API route to avoid CORS
const THORCHAIN_API_URL = "/api/thorchain-quote";

// ThorSwap API - proxied through our API route to avoid CORS
const THORSWAP_API_URL = "/api/thorswap-quote";

// Thorchain asset mapping - maps ticker + chainId to Thorchain asset format
function getThorchainAsset(ticker: string, address: string, chainId: number): string | null {
  // ETH native
  if (ticker === "ETH" && chainId === 1) return "ETH.ETH";

  // Base native ETH
  if (ticker === "ETH" && chainId === 8453) return null; // Base ETH not supported

  // ERC20 tokens on Ethereum
  if (chainId === 1 && address && address !== "0x0000000000000000000000000000000000000000") {
    return `ETH.${ticker}-${address.toLowerCase()}`;
  }

  // Tokens on Base
  if (chainId === 8453 && address && address !== "0x0000000000000000000000000000000000000000") {
    return `BASE.${ticker}-${address.toLowerCase()}`;
  }

  return null;
}

// Thorchain API quote function (proxied through Next.js API route)
async function fetchThorchainQuote(
  sellAsset: string,
  sellAmount: string,
  slippage: number = 1
): Promise<{ amount: string; usdValue: string; expectedBuyAmountMaxSlippage: string } | null> {
  try {
    const response = await fetch(THORCHAIN_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        buyAsset: "BTC.BTC",
        sellAsset: sellAsset,
        sellAmount: sellAmount,
        slippage: slippage,
      }),
    });

    if (!response.ok) {
      console.error("Thorchain API error:", response.status);
      return null;
    }

    const data = await response.json();

    // Response has routes array - get the first route
    const route = data.routes?.[0];
    if (route?.expectedBuyAmountMaxSlippage) {
      return {
        amount: route.expectedBuyAmountMaxSlippage,
        usdValue: "$0.00", // Will be calculated using btcPrice in the caller
        expectedBuyAmountMaxSlippage: route.expectedBuyAmountMaxSlippage,
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch Thorchain quote:", error);
    return null;
  }
}

// ThorSwap asset mapping - same format as Thorchain
function getThorswapAsset(ticker: string, address: string, chainId: number): string | null {
  // ETH native
  if (ticker === "ETH" && chainId === 1) return "ETH.ETH";

  // Base native ETH
  if (ticker === "ETH" && chainId === 8453) return null; // Base ETH not directly supported

  // ERC20 tokens on Ethereum
  if (chainId === 1 && address && address !== "0x0000000000000000000000000000000000000000") {
    return `ETH.${ticker}-${address}`;
  }

  // Tokens on Base
  if (chainId === 8453 && address && address !== "0x0000000000000000000000000000000000000000") {
    return `BASE.${ticker}-${address}`;
  }

  return null;
}

// ThorSwap API quote function (proxied through Next.js API route)
async function fetchThorswapQuote(
  sellAsset: string,
  sellAmount: string,
  slippage: number = 3
): Promise<{ amount: string; usdValue: string } | null> {
  try {
    const response = await fetch(THORSWAP_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sellAsset: sellAsset,
        buyAsset: "BTC.BTC",
        sellAmount: sellAmount,
        sourceAddress: "",
        destinationAddress: "",
        affiliateFee: 50,
        providers: [
          "MAYACHAIN",
          "MAYACHAIN_STREAMING",
          "CHAINFLIP",
          "CHAINFLIP_STREAMING",
          "THORCHAIN",
          "THORCHAIN_STREAMING",
        ],
        slippage: slippage,
        cfBoost: false,
      }),
    });

    if (!response.ok) {
      console.error("ThorSwap API error:", response.status);
      return null;
    }

    const data = await response.json();

    // Response has routes array - get the first route
    const route = data.routes?.[0];
    if (route?.expectedBuyAmountMaxSlippage) {
      return {
        amount: route.expectedBuyAmountMaxSlippage,
        usdValue: "$0.00", // Will be calculated using btcPrice in the caller
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch ThorSwap quote:", error);
    return null;
  }
}

// Relay API quote function
async function fetchRelayQuote(
  originChainId: number,
  originCurrency: string,
  amount: string,
  userAddress: string
): Promise<{ amount: string; usdValue: string } | null> {
  try {
    const response = await fetch("https://api.relay.link/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: userAddress,
        originChainId: originChainId,
        destinationChainId: originChainId, // Same chain swap to cbBTC
        originCurrency: originCurrency,
        destinationCurrency: CBBTC_ADDRESS,
        amount: amount,
        tradeType: "EXACT_INPUT",
      }),
    });

    if (!response.ok) {
      console.error("Relay API error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.details?.currencyOut) {
      return {
        amount: data.details.currencyOut.amountFormatted || "0",
        usdValue: data.details.currencyOut.amountUsd
          ? `$${parseFloat(data.details.currencyOut.amountUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "$0.00",
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch Relay quote:", error);
    return null;
  }
}

export const RatesSwapWidget = () => {
  const { address: userEvmAccountAddress } = useAccount();
  const cowswapClient = useCowSwapClient();
  const liquidity = useMaxLiquidity();
  useBtcEthPrices();
  const { isMobile } = useWindowSize();

  // Local state
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [isLoadingRiftQuote, setIsLoadingRiftQuote] = useState(false);
  const [isLoadingRelayQuote, setIsLoadingRelayQuote] = useState(false);
  const [isLoadingChainflipQuote, setIsLoadingChainflipQuote] = useState(false);
  const [isLoadingThorchainQuote, setIsLoadingThorchainQuote] = useState(false);
  const [isLoadingThorswapQuote, setIsLoadingThorswapQuote] = useState(false);
  const [riftQuote, setRiftQuote] = useState<{ amount: string; usdValue: string } | null>(null);
  const [relayQuote, setRelayQuote] = useState<{ amount: string; usdValue: string } | null>(null);
  const [chainflipQuote, setChainflipQuote] = useState<{ amount: string; usdValue: string } | null>(
    null
  );
  const [thorchainQuote, setThorchainQuote] = useState<{ amount: string; usdValue: string } | null>(
    null
  );
  const [thorswapQuote, setThorswapQuote] = useState<{ amount: string; usdValue: string } | null>(
    null
  );
  const [relayError, setRelayError] = useState<string | null>(null);
  const [chainflipError, setChainflipError] = useState<string | null>(null);
  const [thorchainError, setThorchainError] = useState<string | null>(null);
  const [thorswapError, setThorswapError] = useState<string | null>(null);
  const getQuoteForInputRef = useRef(true);

  // Refs
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quoteRequestIdRef = useRef(0);
  const isInitialMountRef = useRef(true);
  const hasLoadedFromCookieRef = useRef(false);

  // Global store
  const {
    selectedInputToken,
    selectedOutputToken,
    evmConnectWalletChainId,
    displayedInputAmount,
    setDisplayedInputAmount,
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
    setSelectedInputToken,
    setSelectedOutputToken,
    setFeeOverview,
    isOtcServerDead,
    setHasNoRoutesError,
    setExceedsAvailableBTCLiquidity,
    setIsAwaitingOptimalQuote,
  } = useStore();

  // Define styles based on swap direction
  const inputStyle = isSwappingForBTC
    ? GLOBAL_CONFIG.underlyingSwappingAssets[1].style
    : GLOBAL_CONFIG.underlyingSwappingAssets[0].style;
  const outputStyle = isSwappingForBTC
    ? GLOBAL_CONFIG.underlyingSwappingAssets[0].style
    : GLOBAL_CONFIG.underlyingSwappingAssets[1].style;

  const inputAssetIdentifier = isSwappingForBTC ? "ETH" : "BTC";
  const outputAssetIdentifier = isSwappingForBTC ? "BTC" : "CBBTC";

  // Styling constants
  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  // Fetch ERC20 token price from API
  const fetchErc20TokenPrice = useCallback(
    async (tokenData: TokenData | null) => {
      if (
        !tokenData?.address ||
        tokenData.address === "0x0000000000000000000000000000000000000000"
      ) {
        setErc20Price(null);
        return;
      }

      const tokenChainId = tokenData.chainId ?? evmConnectWalletChainId ?? 1;
      const chainName = tokenChainId === 8453 ? "base" : "ethereum";

      try {
        const tokenPrice = await fetchTokenPrice(chainName, tokenData.address);
        if (tokenPrice && typeof tokenPrice.price === "number") {
          setErc20Price(tokenPrice.price);
        }
      } catch (error) {
        console.error("Failed to fetch ERC20 price:", error);
      }
    },
    [evmConnectWalletChainId, setErc20Price]
  );

  // Fetch Relay quote for comparison
  const fetchRelayQuoteForComparison = useCallback(
    async (inputAmount: string, requestId?: number) => {
      if (!isSwappingForBTC) {
        setRelayQuote(null);
        setRelayError(null);
        return;
      }

      setIsLoadingRelayQuote(true);
      setRelayError(null);

      const decimals = selectedInputToken.decimals;
      const sellAmount = parseUnits(inputAmount, decimals).toString();
      const sellToken =
        selectedInputToken.ticker === "ETH"
          ? "0x0000000000000000000000000000000000000000"
          : selectedInputToken.address;
      const userAddr = userEvmAccountAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      const tokenChainId = selectedInputToken.chainId ?? 1;

      try {
        const quote = await fetchRelayQuote(tokenChainId, sellToken, sellAmount, userAddr);

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          return;
        }

        if (quote) {
          setRelayQuote(quote);
        } else {
          setRelayQuote(null);
          setRelayError("No route available");
        }
      } catch (error) {
        console.error("Failed to fetch Relay quote:", error);
        setRelayQuote(null);
        setRelayError("Quote failed");
      } finally {
        setIsLoadingRelayQuote(false);
      }
    },
    [isSwappingForBTC, selectedInputToken, userEvmAccountAddress]
  );

  // Fetch Chainflip quote for comparison using the SDK
  const fetchChainflipQuoteForComparison = useCallback(
    async (inputAmount: string, requestId?: number) => {
      if (!isSwappingForBTC) {
        setChainflipQuote(null);
        setChainflipError(null);
        return;
      }

      // Chainflip only supports Ethereum mainnet
      const tokenChainId = selectedInputToken.chainId ?? 1;
      if (tokenChainId !== 1) {
        setChainflipQuote(null);
        setChainflipError("Ethereum only");
        setIsLoadingChainflipQuote(false);
        return;
      }

      // Map the asset to Chainflip SDK asset
      const chainflipAsset = CHAINFLIP_ASSET_MAP[selectedInputToken.ticker];
      if (!chainflipAsset) {
        setChainflipQuote(null);
        setChainflipError("Asset not supported");
        setIsLoadingChainflipQuote(false);
        return;
      }

      setIsLoadingChainflipQuote(true);
      setChainflipError(null);

      try {
        const sdk = getChainflipSDK();
        const decimals = selectedInputToken.decimals;
        const amountInBaseUnits = parseUnits(inputAmount, decimals).toString();

        let response;
        try {
          response = await sdk.getQuoteV2({
            srcChain: Chains.Ethereum,
            srcAsset: chainflipAsset,
            destChain: Chains.Bitcoin,
            destAsset: Assets.BTC,
            amount: amountInBaseUnits,
          });
        } catch (sdkError: any) {
          // Handle SDK/API errors gracefully
          console.error("Chainflip SDK error:", sdkError?.message || sdkError);
          setChainflipQuote(null);
          setChainflipError("No route");
          setIsLoadingChainflipQuote(false);
          return;
        }

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          return;
        }

        if (response?.quotes && response.quotes.length > 0) {
          // Find the REGULAR quote (not DCA)
          const regularQuote =
            response.quotes.find((q) => q.type === "REGULAR") || response.quotes[0];

          // egressAmount is in satoshis (base unit of BTC)
          const btcAmount = (parseFloat(regularQuote.egressAmount) / 1e8).toFixed(8);

          const usdValue = btcPrice
            ? `$${(parseFloat(btcAmount) * btcPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "$0.00";

          setChainflipQuote({
            amount: btcAmount,
            usdValue,
          });
        } else {
          setChainflipQuote(null);
          setChainflipError("No quote available");
        }
      } catch (error) {
        console.error("Failed to fetch Chainflip quote:", error);
        setChainflipQuote(null);
        setChainflipError("Quote failed");
      } finally {
        setIsLoadingChainflipQuote(false);
      }
    },
    [isSwappingForBTC, selectedInputToken, btcPrice]
  );

  // Fetch Thorchain quote for comparison
  const fetchThorchainQuoteForComparison = useCallback(
    async (inputAmount: string, requestId?: number) => {
      if (!isSwappingForBTC) {
        setThorchainQuote(null);
        setThorchainError(null);
        return;
      }

      const tokenChainId = selectedInputToken.chainId ?? 1;
      const tokenAddress = selectedInputToken.address;
      const ticker = selectedInputToken.ticker;

      // Get Thorchain asset format
      const thorchainAsset = getThorchainAsset(ticker, tokenAddress, tokenChainId);
      if (!thorchainAsset) {
        setThorchainQuote(null);
        setThorchainError("Asset not supported");
        setIsLoadingThorchainQuote(false);
        return;
      }

      setIsLoadingThorchainQuote(true);
      setThorchainError(null);

      try {
        const quote = await fetchThorchainQuote(thorchainAsset, inputAmount, 1);

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          return;
        }

        if (quote) {
          // Calculate USD value using BTC price if not provided
          const btcAmount = parseFloat(quote.amount);
          const usdValue = btcPrice
            ? `$${(btcAmount * btcPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : quote.usdValue;

          setThorchainQuote({
            amount: quote.amount,
            usdValue,
          });
        } else {
          setThorchainQuote(null);
          setThorchainError("No quote available");
        }
      } catch (error) {
        console.error("Failed to fetch Thorchain quote:", error);
        setThorchainQuote(null);
        setThorchainError("Quote failed");
      } finally {
        setIsLoadingThorchainQuote(false);
      }
    },
    [isSwappingForBTC, selectedInputToken, btcPrice]
  );

  // Fetch ThorSwap quote for comparison
  const fetchThorswapQuoteForComparison = useCallback(
    async (inputAmount: string, requestId?: number) => {
      if (!isSwappingForBTC) {
        setThorswapQuote(null);
        setThorswapError(null);
        return;
      }

      const tokenChainId = selectedInputToken.chainId ?? 1;
      const tokenAddress = selectedInputToken.address;
      const ticker = selectedInputToken.ticker;

      // Get ThorSwap asset format
      const thorswapAsset = getThorswapAsset(ticker, tokenAddress, tokenChainId);
      if (!thorswapAsset) {
        setThorswapQuote(null);
        setThorswapError("Asset not supported");
        setIsLoadingThorswapQuote(false);
        return;
      }

      setIsLoadingThorswapQuote(true);
      setThorswapError(null);

      try {
        const quote = await fetchThorswapQuote(thorswapAsset, inputAmount, 3);

        // Check if this is still the latest request
        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          return;
        }

        if (quote) {
          // Calculate USD value using BTC price
          const btcAmount = parseFloat(quote.amount);
          const usdValue = btcPrice
            ? `$${(btcAmount * btcPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : quote.usdValue;

          setThorswapQuote({
            amount: quote.amount,
            usdValue,
          });
        } else {
          setThorswapQuote(null);
          setThorswapError("No quote available");
        }
      } catch (error) {
        console.error("Failed to fetch ThorSwap quote:", error);
        setThorswapQuote(null);
        setThorswapError("Quote failed");
      } finally {
        setIsLoadingThorswapQuote(false);
      }
    },
    [isSwappingForBTC, selectedInputToken, btcPrice]
  );

  // Fetch quote for ERC20/ETH -> BTC
  const fetchERC20ToBTCQuote = useCallback(
    async (inputAmount?: string, requestId?: number) => {
      const amountToQuote = inputAmount ?? displayedInputAmount;

      if (!isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        setRiftQuote(null);
        return;
      }

      const inputValue = parseFloat(amountToQuote);
      let price: number | null = null;

      if (selectedInputToken.ticker === "ETH") {
        price = ethPrice;
      } else if (selectedInputToken.ticker === "cbBTC") {
        price = btcPrice;
      } else {
        price = erc20Price;
      }

      if (price && btcPrice) {
        const usdValue = inputValue * price;
        if (!isAboveMinSwap(usdValue, btcPrice)) {
          clearQuotes();
          setOutputAmount("");
          setRiftQuote(null);
          setIsLoadingRiftQuote(false);
          return;
        }

        const dynamicSlippageBps = getSlippageBpsForNotional(usdValue);
        setHasNoRoutesError(false);
        setIsAwaitingOptimalQuote(true);

        const decimals = selectedInputToken.decimals;
        const sellAmount = parseUnits(amountToQuote, decimals).toString();
        const sellToken = selectedInputToken.address;
        const userAddr = userEvmAccountAddress || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
        const tokenChainId = selectedInputToken.chainId ?? 1;

        // Also fetch Relay, Chainflip, Thorchain, and ThorSwap quotes in parallel
        fetchRelayQuoteForComparison(amountToQuote, requestId);
        fetchChainflipQuoteForComparison(amountToQuote, requestId);
        fetchThorchainQuoteForComparison(amountToQuote, requestId);
        fetchThorswapQuoteForComparison(amountToQuote, requestId);

        try {
          const quoteResponse = await getERC20ToBTCQuote(
            sellToken,
            sellAmount,
            decimals,
            userAddr,
            dynamicSlippageBps,
            undefined,
            cowswapClient,
            PriceQuality.OPTIMAL,
            tokenChainId
          );

          // Check if this is still the latest request
          if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
            return;
          }

          if (quoteResponse) {
            setQuotes({
              cowswapQuote: quoteResponse.cowswapQuote || null,
              rfqQuote: quoteResponse.rfqQuote,
              quoteType: "indicative",
            });
            setOutputAmount(quoteResponse.btcOutputAmount || "");
            setIsAwaitingOptimalQuote(false);

            // Calculate USD value for the output
            const btcAmount = quoteResponse.btcOutputAmount || "0";
            const btcUsdValue = btcPrice
              ? `$${(parseFloat(btcAmount) * btcPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "$0.00";

            setRiftQuote({
              amount: btcAmount,
              usdValue: btcUsdValue,
            });
            setIsLoadingRiftQuote(false);
          }
        } catch (error) {
          console.error("Failed to fetch quote:", error);
          if ((error as Error).message === "Insufficient balance to fulfill quote") {
            setExceedsAvailableBTCLiquidity(true);
          }
          setIsAwaitingOptimalQuote(false);
          clearQuotes();
          setOutputAmount("");
          setFeeOverview(null);
          setRiftQuote(null);
          setIsLoadingRiftQuote(false);
        }
      } else {
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
      cowswapClient,
      setIsAwaitingOptimalQuote,
      fetchRelayQuoteForComparison,
      fetchChainflipQuoteForComparison,
      fetchThorchainQuoteForComparison,
      fetchThorswapQuoteForComparison,
    ]
  );

  // Fetch quote for BTC -> ERC20/ETH
  const fetchBTCtoERC20Quote = useCallback(
    async (amount?: string, requestId?: number) => {
      const amountToQuote = amount ?? displayedInputAmount;

      if (isSwappingForBTC || !amountToQuote || parseFloat(amountToQuote) <= 0) {
        setRiftQuote(null);
        return;
      }

      const amountValue = parseFloat(amountToQuote);

      let price;
      if (selectedOutputToken?.ticker === "cbBTC") {
        price = btcPrice;
      } else if (erc20Price) {
        price = erc20Price;
      }
      if (!btcPrice || !price) {
        return;
      }

      const usdValue = amountValue * btcPrice;

      if (!isAboveMinSwap(usdValue, btcPrice)) {
        clearQuotes();
        setRiftQuote(null);
        setIsLoadingRiftQuote(false);
        return;
      }

      if (
        parseFloat(liquidity.maxCbBTCLiquidityInUsd) > 0 &&
        usdValue > parseFloat(liquidity.maxCbBTCLiquidityInUsd)
      ) {
        clearQuotes();
        setRiftQuote(null);
        setIsLoadingRiftQuote(false);
        return;
      }

      try {
        const quoteAmount = parseUnits(amountToQuote, BITCOIN_DECIMALS).toString();
        const tokenChainId = selectedOutputToken?.chainId ?? 1;
        const rfqQuoteResponse = await callRFQ(quoteAmount, "ExactInput", false, tokenChainId);

        if (requestId !== undefined && requestId !== quoteRequestIdRef.current) {
          return;
        }

        if (rfqQuoteResponse) {
          setQuotes({
            cowswapQuote: null,
            rfqQuote: rfqQuoteResponse,
            quoteType: "indicative",
          });

          const outputAmount = formatLotAmount(rfqQuoteResponse.to);
          const truncatedOutput = (() => {
            const parts = outputAmount.split(".");
            if (parts.length === 2 && parts[1].length > 8) {
              return `${parts[0]}.${parts[1].substring(0, 8)}`;
            }
            return outputAmount;
          })();

          // Calculate USD value for the output (cbBTC)
          const cbBtcUsdValue = btcPrice
            ? `$${(parseFloat(truncatedOutput) * btcPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "$0.00";

          setRiftQuote({
            amount: truncatedOutput,
            usdValue: cbBtcUsdValue,
          });
          setIsLoadingRiftQuote(false);
        } else {
          clearQuotes();
          setFeeOverview(null);
          setRiftQuote(null);
          setIsLoadingRiftQuote(false);
        }
      } catch (error) {
        console.error("Failed to fetch BTC->ERC20 quote:", error);
        clearQuotes();
        setFeeOverview(null);
        setRiftQuote(null);
        setIsLoadingRiftQuote(false);
      }
    },
    [
      isSwappingForBTC,
      displayedInputAmount,
      selectedInputToken,
      clearQuotes,
      btcPrice,
      erc20Price,
      setFeeOverview,
      liquidity,
      selectedOutputToken?.decimals,
      selectedOutputToken?.chainId,
    ]
  );

  // Event handlers
  const openAssetSelector = () => {
    setIsAssetSelectorOpen(true);
  };

  const closeAssetSelector = () => {
    setIsAssetSelectorOpen(false);
  };

  const handleSwapReverse = () => {
    performSwapReverse(!isSwappingForBTC);
  };

  const performSwapReverse = (newIsSwappingForBTC: boolean) => {
    setIsSwappingForBTC(newIsSwappingForBTC);

    if (newIsSwappingForBTC) {
      setSelectedOutputToken(null);
    } else {
      const cbBTC = ETHEREUM_POPULAR_TOKENS.find((token) => token.ticker === "cbBTC");
      setSelectedOutputToken(cbBTC || null);
    }

    setDisplayedInputAmount("");
    setOutputAmount("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setFeeOverview(null);
    setRiftQuote(null);
    setRelayQuote(null);
    setRelayError(null);
    setChainflipQuote(null);
    setChainflipError(null);
    setThorchainQuote(null);
    setThorchainError(null);
    setThorswapQuote(null);
    setThorswapError(null);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    if (displayedInputAmount === "" && (value === "0" || value === ".")) {
      value = "0.";
    }

    if (value === "" || /^\d*\.?\d{0,8}$/.test(value)) {
      setDisplayedInputAmount(value);
      getQuoteForInputRef.current = true;

      const inputTicker = isSwappingForBTC ? selectedInputToken.ticker : "BTC";
      const usdValue = calculateUsdValue(value, inputTicker, ethPrice, btcPrice, erc20Price);
      setInputUsdValue(usdValue);

      clearQuotes();
      setRiftQuote(null);
      setRelayQuote(null);
      setRelayError(null);
      setChainflipQuote(null);
      setChainflipError(null);
      setThorchainQuote(null);
      setThorchainError(null);
      setThorswapQuote(null);
      setThorswapError(null);

      if (!value || parseFloat(value) <= 0) {
        setOutputAmount("");
        setOutputUsdValue(ZERO_USD_DISPLAY);
        setIsLoadingRiftQuote(false);
        setIsLoadingRelayQuote(false);
        setIsLoadingChainflipQuote(false);
        setIsLoadingThorchainQuote(false);
        setIsLoadingThorswapQuote(false);
        setRiftQuote(null);
        setRelayQuote(null);
        setChainflipQuote(null);
        setThorchainQuote(null);
        setThorswapQuote(null);
      }

      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }

      if (value && parseFloat(value) > 0) {
        setIsLoadingRiftQuote(true);
        setIsLoadingRelayQuote(true);
        setIsLoadingChainflipQuote(true);
        setIsLoadingThorchainQuote(true);
        setIsLoadingThorswapQuote(true);
        quoteRequestIdRef.current += 1;
        const currentRequestId = quoteRequestIdRef.current;

        if (isSwappingForBTC) {
          quoteDebounceTimerRef.current = setTimeout(() => {
            fetchERC20ToBTCQuote(value, currentRequestId);
          }, 300);
        } else {
          quoteDebounceTimerRef.current = setTimeout(() => {
            fetchBTCtoERC20Quote(value, currentRequestId);
          }, 300);
        }
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (displayedInputAmount === "0." && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      setDisplayedInputAmount("");
      setInputUsdValue(ZERO_USD_DISPLAY);
      setRiftQuote(null);
    }
  };

  // Effects
  useEffect(() => {
    setDisplayedInputAmount("");
    setOutputAmount("");
    setInputUsdValue(ZERO_USD_DISPLAY);
    setOutputUsdValue(ZERO_USD_DISPLAY);
    setRiftQuote(null);
    setRelayQuote(null);
    setRelayError(null);
    setChainflipQuote(null);
    setChainflipError(null);
    setThorchainQuote(null);
    setThorchainError(null);
    setThorswapQuote(null);
    setThorswapError(null);

    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
    };
  }, [setDisplayedInputAmount, setOutputAmount, setInputUsdValue, setOutputUsdValue]);

  useEffect(() => {
    if (!isInitialMountRef.current || hasLoadedFromCookieRef.current) return;

    const savedState = loadSwapStateFromCookie();
    if (savedState) {
      setIsSwappingForBTC(savedState.isSwappingForBTC);
      if (savedState.selectedInputToken) {
        setSelectedInputToken(savedState.selectedInputToken);
      }
      if (savedState.selectedOutputToken) {
        setSelectedOutputToken(savedState.selectedOutputToken);
      }
      hasLoadedFromCookieRef.current = true;
    }
    isInitialMountRef.current = false;
  }, [setIsSwappingForBTC, setSelectedInputToken, setSelectedOutputToken]);

  useEffect(() => {
    if (!isInitialMountRef.current && !hasLoadedFromCookieRef.current) {
      const ETH_TOKEN = ETHEREUM_POPULAR_TOKENS[0];
      setSelectedInputToken(ETH_TOKEN);
    }
  }, [selectedInputToken, setSelectedInputToken]);

  useEffect(() => {
    if (isInitialMountRef.current) return;

    if (isSwappingForBTC) {
      setSelectedOutputToken(null);
    } else {
      const popularTokens =
        evmConnectWalletChainId === 8453 ? BASE_POPULAR_TOKENS : ETHEREUM_POPULAR_TOKENS;
      const cbBTC = popularTokens.find((token) => token.ticker === "cbBTC");
      setSelectedOutputToken(cbBTC || null);
    }
  }, [isSwappingForBTC, setSelectedOutputToken, evmConnectWalletChainId]);

  useEffect(() => {
    fetchErc20TokenPrice(selectedInputToken);
  }, [selectedInputToken, fetchErc20TokenPrice]);

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
  }, [
    erc20Price,
    btcPrice,
    ethPrice,
    displayedInputAmount,
    isSwappingForBTC,
    selectedInputToken,
    setInputUsdValue,
  ]);

  useEffect(() => {
    if (isInitialMountRef.current) return;

    saveSwapStateToCookie({
      isSwappingForBTC,
      selectedInputToken,
      selectedOutputToken,
    });
  }, [isSwappingForBTC, selectedInputToken, selectedOutputToken]);

  // Render
  return (
    <Flex
      direction="column"
      align="center"
      py={isMobile ? "20px" : "27px"}
      w="100%"
      maxW={isMobile ? "100%" : "900px"}
      borderRadius="30px"
      {...opaqueBackgroundColor}
      border={borderColor}
    >
      <Flex w="95%" direction="column">
        {/* Horizontal layout for input and output asset selector */}
        <Flex
          w="100%"
          direction={isMobile ? "column" : "row"}
          gap={isMobile ? "0px" : "15px"}
          position="relative"
          align="stretch"
        >
          {/* Input Asset Section - 70% width */}
          <Flex
            w={isMobile ? "100%" : "70%"}
            px="10px"
            bg={inputStyle?.dark_bg_color || "rgba(37, 82, 131, 0.66)"}
            minH="121px"
            border="2px solid"
            borderColor={inputStyle?.bg_color || "#255283"}
            borderRadius="16px"
          >
            <Flex direction="column" py="12px" px="8px" flex="1">
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

              <Input
                value={displayedInputAmount}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                fontFamily="Aux"
                border="none"
                bg="transparent"
                outline="none"
                mt="6px"
                ml="-5px"
                p="0px"
                letterSpacing="-4px"
                color={colors.offWhite}
                _active={{ border: "none", boxShadow: "none", outline: "none" }}
                _focus={{ border: "none", boxShadow: "none", outline: "none" }}
                _selected={{ border: "none", boxShadow: "none", outline: "none" }}
                fontSize={isMobile ? "28px" : "36px"}
                placeholder="0.0"
                _placeholder={{ color: inputStyle?.light_text_color || "#4A90E2" }}
                disabled={isOtcServerDead}
                cursor={isOtcServerDead ? "not-allowed" : "text"}
                opacity={isOtcServerDead ? 0.5 : 1}
              />

              <Text
                color={!displayedInputAmount ? colors.offWhite : colors.textGray}
                fontSize="14px"
                mt="6px"
                letterSpacing="-1px"
                fontWeight="normal"
                fontFamily="Aux"
              >
                {inputUsdValue}
              </Text>
            </Flex>

            <Flex py="12px" direction="column" align="flex-end" justify="center">
              <WebAssetTag
                cursor={inputAssetIdentifier !== "BTC" ? "pointer" : "default"}
                asset={inputAssetIdentifier}
                onDropDown={inputAssetIdentifier !== "BTC" ? openAssetSelector : undefined}
              />
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
            position={isMobile ? "relative" : "absolute"}
            left={isMobile ? "auto" : "70%"}
            top={isMobile ? "auto" : "50%"}
            transform={isMobile ? "none" : "translate(-50%, -50%)"}
            mt={isMobile ? "-16px" : "0"}
            mb={isMobile ? "-16px" : "0"}
            transition="background 0.2s ease-in-out"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22px"
              height="22px"
              viewBox="0 0 20 20"
              style={{ transform: isMobile ? "rotate(0deg)" : "rotate(90deg)" }}
            >
              <path
                fill="#909090"
                fillRule="evenodd"
                d="M2.24 6.8a.75.75 0 0 0 1.06-.04l1.95-2.1v8.59a.75.75 0 0 0 1.5 0V4.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0L2.2 5.74a.75.75 0 0 0 .04 1.06m8 6.4a.75.75 0 0 0-.04 1.06l3.25 3.5a.75.75 0 0 0 1.1 0l3.25-3.5a.75.75 0 1 0-1.1-1.02l-1.95 2.1V6.75a.75.75 0 0 0-1.5 0v8.59l-1.95-2.1a.75.75 0 0 0-1.06-.04"
                clipRule="evenodd"
              />
            </svg>
          </Flex>

          {/* Output Asset Section - 30% width, vertical layout */}
          <Flex
            w={isMobile ? "100%" : "30%"}
            px="15px"
            bg={outputStyle?.dark_bg_color || "rgba(46, 29, 14, 0.66)"}
            minH="121px"
            border="2px solid"
            borderColor={outputStyle?.bg_color || "#78491F"}
            borderRadius="16px"
            align="center"
            justify="center"
            direction="column"
            py="12px"
          >
            <Text
              color={colors.textGray}
              fontSize="14px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              userSelect="none"
            >
              You Receive
            </Text>
            <Flex mt="6px">
              <WebAssetTag
                cursor={outputAssetIdentifier !== "BTC" ? "pointer" : "default"}
                asset={outputAssetIdentifier}
                onDropDown={outputAssetIdentifier !== "BTC" ? openAssetSelector : undefined}
                isOutput={true}
              />
            </Flex>
            {/* Invisible spacer to balance with input USD value */}
            <Text
              fontSize="14px"
              mt="6px"
              letterSpacing="-1px"
              fontWeight="normal"
              fontFamily="Aux"
              visibility="hidden"
            >
              $0.00
            </Text>
          </Flex>
        </Flex>

        {/* Exchange Quotes List - Always visible */}
        <Flex direction="column" mt="20px" gap="10px">
          <Text
            color={colors.textGray}
            fontSize="13px"
            letterSpacing="-0.5px"
            fontWeight="normal"
            fontFamily="Aux"
            ml="5px"
            mb="5px"
          >
            QUOTES
          </Text>

          {(() => {
            // Parse USD values for comparison
            const parseUsdValue = (usdStr: string) => {
              if (!usdStr) return 0;
              return parseFloat(usdStr.replace(/[$,]/g, "")) || 0;
            };

            const riftUsdValue = riftQuote ? parseUsdValue(riftQuote.usdValue) : 0;
            const relayUsdValue = relayQuote ? parseUsdValue(relayQuote.usdValue) : 0;
            const chainflipUsdValue = chainflipQuote ? parseUsdValue(chainflipQuote.usdValue) : 0;
            const thorchainUsdValue = thorchainQuote ? parseUsdValue(thorchainQuote.usdValue) : 0;
            const thorswapUsdValue = thorswapQuote ? parseUsdValue(thorswapQuote.usdValue) : 0;

            // Determine best rate
            const bestUsdValue = Math.max(
              riftUsdValue,
              relayUsdValue,
              chainflipUsdValue,
              thorchainUsdValue,
              thorswapUsdValue
            );

            // Calculate percentage difference
            const calcPercentDiff = (value: number) => {
              if (bestUsdValue === 0 || value === 0) return 0;
              return ((value - bestUsdValue) / bestUsdValue) * 100;
            };

            // Sort quotes - best first
            const quotes = [
              {
                id: "rift",
                usdValue: riftUsdValue,
                isBest: riftUsdValue > 0 && riftUsdValue >= bestUsdValue,
                percentDiff: calcPercentDiff(riftUsdValue),
              },
              {
                id: "relay",
                usdValue: relayUsdValue,
                isBest: relayUsdValue > 0 && relayUsdValue >= bestUsdValue,
                percentDiff: calcPercentDiff(relayUsdValue),
              },
              {
                id: "chainflip",
                usdValue: chainflipUsdValue,
                isBest: chainflipUsdValue > 0 && chainflipUsdValue >= bestUsdValue,
                percentDiff: calcPercentDiff(chainflipUsdValue),
              },
              {
                id: "thorchain",
                usdValue: thorchainUsdValue,
                isBest: thorchainUsdValue > 0 && thorchainUsdValue >= bestUsdValue,
                percentDiff: calcPercentDiff(thorchainUsdValue),
              },
              {
                id: "thorswap",
                usdValue: thorswapUsdValue,
                isBest: thorswapUsdValue > 0 && thorswapUsdValue >= bestUsdValue,
                percentDiff: calcPercentDiff(thorswapUsdValue),
              },
            ].sort((a, b) => b.usdValue - a.usdValue);

            return quotes.map((quote) => {
              if (quote.id === "rift") {
                return (
                  <Flex
                    key="rift"
                    w="100%"
                    bg="rgba(20, 20, 20, 0.8)"
                    border="2px solid #323232"
                    borderRadius="16px"
                    px="20px"
                    py="16px"
                    align="center"
                  >
                    {/* Left: RIFT Logo + Tag */}
                    <Flex flex="1" justify="flex-start" align="center" gap="10px">
                      <RiftLogo width="80" height="20" />
                      {riftQuote &&
                        !isLoadingRiftQuote &&
                        (quote.isBest ? (
                          <Flex
                            bg={colorsAnalytics.greenBackground}
                            border={`1px solid ${colorsAnalytics.greenOutline}`}
                            borderRadius="6px"
                            px="8px"
                            py="2px"
                          >
                            <Text
                              color="#22c55e"
                              fontSize="11px"
                              fontFamily="Aux"
                              fontWeight="bold"
                              letterSpacing="-0.5px"
                            >
                              BEST RATE
                            </Text>
                          </Flex>
                        ) : (
                          bestUsdValue > 0 && (
                            <Flex
                              bg={colorsAnalytics.redBackground}
                              border={`1px solid ${colorsAnalytics.red}`}
                              borderRadius="6px"
                              px="8px"
                              py="2px"
                            >
                              <Text
                                color={colorsAnalytics.redHover}
                                fontSize="11px"
                                fontFamily="Aux"
                                fontWeight="bold"
                                letterSpacing="-0.5px"
                              >
                                {quote.percentDiff.toFixed(1)}%
                              </Text>
                            </Flex>
                          )
                        ))}
                    </Flex>

                    {/* Center: Amount and USD */}
                    <Flex direction="column" align="center" flex="1" justify="center">
                      {isLoadingRiftQuote ? (
                        <Spinner
                          size="md"
                          color={outputStyle?.border_color_light || colors.textGray}
                        />
                      ) : riftQuote ? (
                        <>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.offWhite}
                            fontSize={isMobile ? "24px" : "32px"}
                            fontFamily="Aux"
                            letterSpacing="-5px"
                            fontWeight="normal"
                          >
                            {riftQuote.usdValue}
                          </Text>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.textGray}
                            fontSize="14px"
                            fontFamily="Aux"
                            letterSpacing="-1px"
                            mt="-2px"
                          >
                            {parseFloat(riftQuote.amount).toFixed(8)}
                          </Text>
                        </>
                      ) : (
                        <Text
                          color={colors.textGray}
                          fontSize={isMobile ? "24px" : "32px"}
                          fontFamily="Aux"
                          letterSpacing="-3px"
                          fontWeight="normal"
                        >
                          ...
                        </Text>
                      )}
                    </Flex>

                    {/* Right: Asset Tag */}
                    <Flex flex="1" justify="flex-end">
                      <WebAssetTag cursor="default" asset={outputAssetIdentifier} isOutput={true} />
                    </Flex>
                  </Flex>
                );
              } else if (quote.id === "relay" && isSwappingForBTC) {
                return (
                  <Flex
                    key="relay"
                    w="100%"
                    bg="rgba(20, 20, 20, 0.8)"
                    border="2px solid #323232"
                    borderRadius="16px"
                    px="20px"
                    py="16px"
                    align="center"
                  >
                    {/* Left: Relay Logo + Tag */}
                    <Flex flex="1" justify="flex-start" align="center" gap="10px">
                      <Image
                        src="/images/lockup_white.png"
                        alt="Relay"
                        h="26px"
                        objectFit="contain"
                      />
                      {relayQuote &&
                        !isLoadingRelayQuote &&
                        (quote.isBest ? (
                          <Flex
                            bg={colorsAnalytics.greenBackground}
                            border={`1px solid ${colorsAnalytics.greenOutline}`}
                            borderRadius="6px"
                            px="8px"
                            py="2px"
                          >
                            <Text
                              color="#22c55e"
                              fontSize="11px"
                              fontFamily="Aux"
                              fontWeight="bold"
                              letterSpacing="-0.5px"
                            >
                              BEST RATE
                            </Text>
                          </Flex>
                        ) : (
                          bestUsdValue > 0 && (
                            <Flex
                              bg={colorsAnalytics.redBackground}
                              border={`1px solid ${colorsAnalytics.red}`}
                              borderRadius="6px"
                              px="8px"
                              py="2px"
                            >
                              <Text
                                color={colorsAnalytics.redHover}
                                fontSize="11px"
                                fontFamily="Aux"
                                fontWeight="bold"
                                letterSpacing="-0.5px"
                              >
                                {quote.percentDiff.toFixed(1)}%
                              </Text>
                            </Flex>
                          )
                        ))}
                    </Flex>

                    {/* Center: Amount and USD */}
                    <Flex direction="column" align="center" flex="1" justify="center">
                      {isLoadingRelayQuote ? (
                        <Spinner size="md" color={colors.textGray} />
                      ) : relayQuote ? (
                        <>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.offWhite}
                            fontSize={isMobile ? "24px" : "32px"}
                            fontFamily="Aux"
                            letterSpacing="-5px"
                            fontWeight="normal"
                          >
                            {relayQuote.usdValue}
                          </Text>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.textGray}
                            fontSize="14px"
                            fontFamily="Aux"
                            letterSpacing="-1px"
                            mt="-2px"
                          >
                            {parseFloat(relayQuote.amount).toFixed(8)}
                          </Text>
                        </>
                      ) : relayError ? (
                        <Text
                          color={colors.textGray}
                          fontSize="14px"
                          fontFamily="Aux"
                          letterSpacing="-1px"
                        >
                          {relayError}
                        </Text>
                      ) : (
                        <Text
                          color={colors.textGray}
                          fontSize={isMobile ? "24px" : "32px"}
                          fontFamily="Aux"
                          letterSpacing="-3px"
                          fontWeight="normal"
                        >
                          ...
                        </Text>
                      )}
                    </Flex>

                    {/* Right: Asset Tag */}
                    <Flex flex="1" justify="flex-end">
                      <WebAssetTag cursor="default" asset={outputAssetIdentifier} isOutput={true} />
                    </Flex>
                  </Flex>
                );
              } else if (quote.id === "chainflip" && isSwappingForBTC) {
                return (
                  <Flex
                    key="chainflip"
                    w="100%"
                    bg="rgba(20, 20, 20, 0.8)"
                    border="2px solid #323232"
                    borderRadius="16px"
                    px="20px"
                    py="16px"
                    align="center"
                  >
                    {/* Left: Chainflip Logo + Tag */}
                    <Flex flex="1" justify="flex-start" align="center" gap="10px">
                      <Image
                        src="/images/chainflip.webp"
                        alt="Chainflip"
                        h="22px"
                        objectFit="contain"
                      />
                      {chainflipQuote &&
                        !isLoadingChainflipQuote &&
                        (quote.isBest ? (
                          <Flex
                            bg={colorsAnalytics.greenBackground}
                            border={`1px solid ${colorsAnalytics.greenOutline}`}
                            borderRadius="6px"
                            px="8px"
                            py="2px"
                          >
                            <Text
                              color="#22c55e"
                              fontSize="11px"
                              fontFamily="Aux"
                              fontWeight="bold"
                              letterSpacing="-0.5px"
                            >
                              BEST RATE
                            </Text>
                          </Flex>
                        ) : (
                          bestUsdValue > 0 && (
                            <Flex
                              bg={colorsAnalytics.redBackground}
                              border={`1px solid ${colorsAnalytics.red}`}
                              borderRadius="6px"
                              px="8px"
                              py="2px"
                            >
                              <Text
                                color={colorsAnalytics.redHover}
                                fontSize="11px"
                                fontFamily="Aux"
                                fontWeight="bold"
                                letterSpacing="-0.5px"
                              >
                                {quote.percentDiff.toFixed(1)}%
                              </Text>
                            </Flex>
                          )
                        ))}
                    </Flex>

                    {/* Center: Amount and USD */}
                    <Flex direction="column" align="center" flex="1" justify="center">
                      {isLoadingChainflipQuote ? (
                        <Spinner size="md" color={colors.textGray} />
                      ) : chainflipQuote ? (
                        <>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.offWhite}
                            fontSize={isMobile ? "24px" : "32px"}
                            fontFamily="Aux"
                            letterSpacing="-5px"
                            fontWeight="normal"
                          >
                            {chainflipQuote.usdValue}
                          </Text>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.textGray}
                            fontSize="14px"
                            fontFamily="Aux"
                            letterSpacing="-1px"
                            mt="-2px"
                          >
                            {parseFloat(chainflipQuote.amount).toFixed(8)}
                          </Text>
                        </>
                      ) : chainflipError ? (
                        <Text
                          color={colors.textGray}
                          fontSize="14px"
                          fontFamily="Aux"
                          letterSpacing="-1px"
                        >
                          {chainflipError}
                        </Text>
                      ) : (
                        <Text
                          color={colors.textGray}
                          fontSize={isMobile ? "24px" : "32px"}
                          fontFamily="Aux"
                          letterSpacing="-3px"
                          fontWeight="normal"
                        >
                          ...
                        </Text>
                      )}
                    </Flex>

                    {/* Right: Asset Tag */}
                    <Flex flex="1" justify="flex-end">
                      <WebAssetTag cursor="default" asset={outputAssetIdentifier} isOutput={true} />
                    </Flex>
                  </Flex>
                );
              } else if (quote.id === "thorchain" && isSwappingForBTC) {
                return (
                  <Flex
                    key="thorchain"
                    w="100%"
                    bg="rgba(20, 20, 20, 0.8)"
                    border="2px solid #323232"
                    borderRadius="16px"
                    px="20px"
                    py="16px"
                    align="center"
                  >
                    {/* Left: Thorchain Logo + Tag */}
                    <Flex flex="1" justify="flex-start" align="center" gap="10px">
                      <Image
                        src="/images/thorchain.png"
                        alt="THORChain"
                        h="30px"
                        objectFit="contain"
                      />
                      {thorchainQuote &&
                        !isLoadingThorchainQuote &&
                        (quote.isBest ? (
                          <Flex
                            bg={colorsAnalytics.greenBackground}
                            border={`1px solid ${colorsAnalytics.greenOutline}`}
                            borderRadius="6px"
                            px="8px"
                            py="2px"
                          >
                            <Text
                              color="#22c55e"
                              fontSize="11px"
                              fontFamily="Aux"
                              fontWeight="bold"
                              letterSpacing="-0.5px"
                            >
                              BEST RATE
                            </Text>
                          </Flex>
                        ) : (
                          bestUsdValue > 0 && (
                            <Flex
                              bg={colorsAnalytics.redBackground}
                              border={`1px solid ${colorsAnalytics.red}`}
                              borderRadius="6px"
                              px="8px"
                              py="2px"
                            >
                              <Text
                                color={colorsAnalytics.redHover}
                                fontSize="11px"
                                fontFamily="Aux"
                                fontWeight="bold"
                                letterSpacing="-0.5px"
                              >
                                {quote.percentDiff.toFixed(1)}%
                              </Text>
                            </Flex>
                          )
                        ))}
                    </Flex>

                    {/* Center: Amount and USD */}
                    <Flex direction="column" align="center" flex="1" justify="center">
                      {isLoadingThorchainQuote ? (
                        <Spinner size="md" color={colors.textGray} />
                      ) : thorchainQuote ? (
                        <>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.offWhite}
                            fontSize={isMobile ? "24px" : "32px"}
                            fontFamily="Aux"
                            letterSpacing="-5px"
                            fontWeight="normal"
                          >
                            {thorchainQuote.usdValue}
                          </Text>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.textGray}
                            fontSize="14px"
                            fontFamily="Aux"
                            letterSpacing="-1px"
                            mt="-2px"
                          >
                            {parseFloat(thorchainQuote.amount).toFixed(8)}
                          </Text>
                        </>
                      ) : thorchainError ? (
                        <Text
                          color={colors.textGray}
                          fontSize="14px"
                          fontFamily="Aux"
                          letterSpacing="-1px"
                        >
                          {thorchainError}
                        </Text>
                      ) : (
                        <Text
                          color={colors.textGray}
                          fontSize={isMobile ? "24px" : "32px"}
                          fontFamily="Aux"
                          letterSpacing="-3px"
                          fontWeight="normal"
                        >
                          ...
                        </Text>
                      )}
                    </Flex>

                    {/* Right: Asset Tag */}
                    <Flex flex="1" justify="flex-end">
                      <WebAssetTag cursor="default" asset={outputAssetIdentifier} isOutput={true} />
                    </Flex>
                  </Flex>
                );
              } else if (quote.id === "thorswap" && isSwappingForBTC) {
                return (
                  <Flex
                    key="thorswap"
                    w="100%"
                    bg="rgba(20, 20, 20, 0.8)"
                    border="2px solid #323232"
                    borderRadius="16px"
                    px="20px"
                    py="16px"
                    align="center"
                  >
                    {/* Left: ThorSwap Logo + Tag */}
                    <Flex flex="1" justify="flex-start" align="center" gap="10px">
                      <Image
                        src="/images/thorswap.png"
                        alt="THORSwap"
                        h="26px"
                        objectFit="contain"
                      />
                      {thorswapQuote &&
                        !isLoadingThorswapQuote &&
                        (quote.isBest ? (
                          <Flex
                            bg={colorsAnalytics.greenBackground}
                            border={`1px solid ${colorsAnalytics.greenOutline}`}
                            borderRadius="6px"
                            px="8px"
                            py="2px"
                          >
                            <Text
                              color="#22c55e"
                              fontSize="11px"
                              fontFamily="Aux"
                              fontWeight="bold"
                              letterSpacing="-0.5px"
                            >
                              BEST RATE
                            </Text>
                          </Flex>
                        ) : (
                          bestUsdValue > 0 && (
                            <Flex
                              bg={colorsAnalytics.redBackground}
                              border={`1px solid ${colorsAnalytics.red}`}
                              borderRadius="6px"
                              px="8px"
                              py="2px"
                            >
                              <Text
                                color={colorsAnalytics.redHover}
                                fontSize="11px"
                                fontFamily="Aux"
                                fontWeight="bold"
                                letterSpacing="-0.5px"
                              >
                                {quote.percentDiff.toFixed(1)}%
                              </Text>
                            </Flex>
                          )
                        ))}
                    </Flex>

                    {/* Center: Amount and USD */}
                    <Flex direction="column" align="center" flex="1" justify="center">
                      {isLoadingThorswapQuote ? (
                        <Spinner size="md" color={colors.textGray} />
                      ) : thorswapQuote ? (
                        <>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.offWhite}
                            fontSize={isMobile ? "24px" : "32px"}
                            fontFamily="Aux"
                            letterSpacing="-5px"
                            fontWeight="normal"
                          >
                            {thorswapQuote.usdValue}
                          </Text>
                          <Text
                            color={quote.isBest ? "#22c55e" : colors.textGray}
                            fontSize="14px"
                            fontFamily="Aux"
                            letterSpacing="-1px"
                            mt="-2px"
                          >
                            {parseFloat(thorswapQuote.amount).toFixed(8)}
                          </Text>
                        </>
                      ) : thorswapError ? (
                        <Text
                          color={colors.textGray}
                          fontSize="14px"
                          fontFamily="Aux"
                          letterSpacing="-1px"
                        >
                          {thorswapError}
                        </Text>
                      ) : (
                        <Text
                          color={colors.textGray}
                          fontSize={isMobile ? "24px" : "32px"}
                          fontFamily="Aux"
                          letterSpacing="-3px"
                          fontWeight="normal"
                        >
                          ...
                        </Text>
                      )}
                    </Flex>

                    {/* Right: Asset Tag */}
                    <Flex flex="1" justify="flex-end">
                      <WebAssetTag cursor="default" asset={outputAssetIdentifier} isOutput={true} />
                    </Flex>
                  </Flex>
                );
              }
              return null;
            });
          })()}
        </Flex>
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
