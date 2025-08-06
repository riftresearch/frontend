import {
  Flex,
  Text,
  Input,
  Spacer,
  Box,
  Tooltip as ChakraTooltip,
  Portal,
  Spinner,
} from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/router";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { colors } from "@/utils/colors";
import {
  BITCOIN_DECIMALS,
  GLOBAL_CONFIG,
  opaqueBackgroundColor,
  otcClient,
  rfqClient,
} from "@/utils/constants";
import TokenButton from "@/components/other/TokenButton";
import WebAssetTag from "@/components/other/WebAssetTag";
import { InfoSVG } from "../other/SVGs";
import {
  convertToBitcoinLockingScript,
  validateBitcoinPayoutAddress,
  validateBitcoinPayoutAddressWithNetwork,
} from "@/utils/bitcoinUtils";
import { FONT_FAMILIES } from "@/utils/font";
import BitcoinAddressValidation from "../other/BitcoinAddressValidation";
import { useStore } from "@/utils/store";
import { toastInfo } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { Asset } from "@/utils/types";
import { TokenStyle } from "@/utils/types";
import { Hex } from "bitcoinjs-lib/src/types";
import { reownModal, wagmiAdapter } from "@/utils/wallet";
import { Address, erc20Abi, parseUnits } from "viem";
import { Quote } from "@/utils/backendTypes";
import { CreateSwapResponse } from "@/utils/otcClient";
import { useSwapStatus } from "@/hooks/useSwapStatus";
const BTC_USD_EXCHANGE_RATE = 115611.06;

export const SwapWidget = () => {
  const { isMobile } = useWindowSize();
  const { isConnected: isWalletConnected } = useAccount();
  const router = useRouter();
  const [rawInputAmount, setRawInputAmount] = useState("");
  const [inputTokenAmount, setInputTokenAmount] = useState<bigint>(0n);
  const [outputAmount, setOutputAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [payoutAddress, setPayoutAddress] = useState("");
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }>({ isValid: false });
  const [refundAddress, setRefundAddress] = useState("");
  const [refundAddressValidation, setRefundAddressValidation] = useState<{
    isValid: boolean;
    networkMismatch?: boolean;
    detectedNetwork?: string;
  }>({ isValid: false });
  const [lastEditedField, setLastEditedField] = useState<"input" | "output">(
    "input"
  );
  const [isReversed, setIsReversed] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const { swapResponse, setSwapResponse, setTransactionConfirmed } = useStore();
  const { data: hash, writeContract, isPending } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Update store when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      setTransactionConfirmed(true);
    }
  }, [isConfirmed, setTransactionConfirmed]);

  // const {
  //   data: availableBitcoinLiquidity,
  //   isLoading: isLoadingAvailableBitcoinLiquidity,
  // } = useAvailableBitcoinLiquidity();
  const [canClickButton, setCanClickButton] = useState(false);

  // Button loading state combines pending transaction and confirmation waiting
  const isButtonLoading = isPending || isConfirming;

  // Define the assets based on swap direction
  const cbBTCAsset = GLOBAL_CONFIG.underlyingSwappingAssets[1];
  const btcAsset = GLOBAL_CONFIG.underlyingSwappingAssets[0];

  const currentInputAsset = isReversed ? btcAsset : cbBTCAsset;
  const currentOutputAsset = isReversed ? cbBTCAsset : btcAsset;

  // For WebAssetTag, we need to pass the right string identifiers
  const inputAssetIdentifier = isReversed ? "BTC" : "CoinbaseBTC";
  const outputAssetIdentifier = isReversed ? "CoinbaseBTC" : "BTC";

  const handleSwapReverse = () => {
    // Disable swap direction change for now
    toastInfo({
      title: "Coming Soon",
      description: "BTC → ERC20 swaps are coming soon!",
    });
    return;

    // Original logic (commented out)
    // setIsReversed(!isReversed);
    // setRawInputAmount("");
    // setOutputAmount("");
    // setPayoutAddress("");
    // setAddressValidation({ isValid: false });
    // setRefundAddress("");
    // setRefundAddressValidation({ isValid: false });
  };

  const convertInputAmountToFullDecimals = (
    amount?: string
  ): bigint | undefined => {
    try {
      const inputAmount = amount || rawInputAmount;
      return parseUnits(inputAmount, currentInputAsset.currency.decimals);
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
    setPayoutAddress("");
    setRefundAddress("");
  }, []);

  // Validate payout address whenever it changes (Bitcoin or Ethereum based on swap direction)
  useEffect(() => {
    if (payoutAddress) {
      if (isReversed) {
        // For BTC -> cbBTC swaps, validate Ethereum address for payout
        const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        setAddressValidation({
          isValid: ethAddressRegex.test(payoutAddress),
        });
      } else {
        // For cbBTC -> BTC swaps, validate Bitcoin address for payout
        const validation = validateBitcoinPayoutAddressWithNetwork(
          payoutAddress,
          "mainnet"
        );
        setAddressValidation(validation);
      }
    } else {
      setAddressValidation({ isValid: false });
    }
  }, [payoutAddress, btcAsset.currency.chain, isReversed]);

  // Validate refund address whenever it changes (opposite of payout address validation)
  useEffect(() => {
    if (refundAddress) {
      if (!isReversed) {
        // For cbBTC -> BTC swaps, validate Ethereum address for refund (cbBTC)
        const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        setRefundAddressValidation({
          isValid: ethAddressRegex.test(refundAddress),
        });
      } else {
        // For BTC -> cbBTC swaps, validate Bitcoin address for refund (BTC)
        const validation = validateBitcoinPayoutAddressWithNetwork(
          refundAddress,
          "mainnet"
        );
        setRefundAddressValidation(validation);
      }
    } else {
      setRefundAddressValidation({ isValid: false });
    }
  }, [refundAddress, btcAsset.currency.chain, isReversed]);

  // Exchange rate: 1 cbBTC = 0.999 BTC (0.1% fee)
  const EXCHANGE_RATE = 1; // TODO: make this based on real RFQ quote rate

  const sendRFQRequest = async (from_amount: bigint) => {
    const currentTime = new Date().getTime();
    const quote = await rfqClient.requestQuotes({
      from: {
        chain: currentInputAsset.currency.chain,
        token: currentInputAsset.currency.token,
        amount: from_amount.toString(),
        decimals: currentInputAsset.currency.decimals,
      },
      to: {
        chain: currentOutputAsset.currency.chain,
        token: currentOutputAsset.currency.token,
        amount: "0",
        decimals: currentOutputAsset.currency.decimals,
      },
    });
    const timeTaken = new Date().getTime() - currentTime;

    console.log("got quote from RFQ", quote, "in", timeTaken, "ms");
    setQuote(quote.quote);
  };

  const sendOTCRequest = async (
    quote: Quote,
    user_destination_address: string,
    user_refund_address: string
  ) => {
    const currentTime = new Date().getTime();
    const swap = await otcClient.createSwap({
      quote,
      user_destination_address,
      user_refund_address,
    });
    const timeTaken = new Date().getTime() - currentTime;

    console.log("got swap from OTC", swap, "in", timeTaken, "ms");
    if (swap) {
      setSwapResponse(swap);
    }
    console.log("Returned swap request", swap);
    // hex to string bigint
    let amount = BigInt(swap.expected_amount);
    console.log("amount", amount);
    // okay, now we need to request money to be sent from the user to the created swap
    writeContract({
      address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
      abi: erc20Abi,
      functionName: "transfer",
      args: [swap.deposit_address as `0x${string}`, amount],
    });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setRawInputAmount(value);
      setLastEditedField("input");
      setHasStartedTyping(true);

      let from_amount = convertInputAmountToFullDecimals(value);
      console.log("value", value);
      console.log("from_amount", from_amount);
      if (from_amount && from_amount > 0n) {
        // call RFQ
        sendRFQRequest(from_amount);
      }

      // Calculate output amount based on input, also set the input token amount
      if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
        setOutputAmount(value);
      } else {
        setOutputAmount("");
      }
    }
  };

  const handleOutputChange = (e: ChangeEvent<HTMLInputElement>) => {
    return; // TODO: remove this
    const value = e.target.value;

    // Allow empty string, numbers, and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setOutputAmount(value);
      setLastEditedField("output");
      setHasStartedTyping(true);

      // Calculate input amount based on output (reverse calculation)
      if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
        setRawInputAmount((parseFloat(value) / EXCHANGE_RATE).toFixed(8));
      } else {
        setRawInputAmount("");
      }
    }
  };

  const handleSwap = async () => {
    if (!isWalletConnected) {
      // Open wallet connection modal instead of showing toast
      await reownModal.open();
      return;
    }

    if (isMobile) {
      toastInfo({
        title: "Hop on your laptop",
        description:
          "This app is too cool for small screens, mobile coming soon!",
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
        title: isReversed ? "Enter Ethereum Address" : "Enter Bitcoin Address",
        description: isReversed
          ? "Please enter your Ethereum address to receive cbBTC"
          : "Please enter your Bitcoin address to receive BTC",
      });
      return;
    }

    if (!addressValidation.isValid) {
      let description = isReversed
        ? "Please enter a valid Ethereum address"
        : "Please enter a valid Bitcoin payout address";
      if (!isReversed && addressValidation.networkMismatch) {
        description = `Wrong network: expected ${btcAsset.currency.chain} but detected ${addressValidation.detectedNetwork}`;
      }
      toastInfo({
        title: isReversed
          ? "Invalid Ethereum Address"
          : "Invalid Bitcoin Address",
        description,
      });
      return;
    }

    // Check refund address for BTC->cbBTC swaps only
    if (isReversed) {
      if (!refundAddress) {
        toastInfo({
          title: "Enter Refund Address",
          description:
            "Please enter your Bitcoin refund address in case the swap fails",
        });
        return;
      }

      if (!refundAddressValidation.isValid) {
        let description = "Please enter a valid Bitcoin refund address";
        if (refundAddressValidation.networkMismatch) {
          description = `Wrong network: expected ${btcAsset.currency.chain} but detected ${refundAddressValidation.detectedNetwork}`;
        }
        toastInfo({
          title: "Invalid Refund Address",
          description,
        });
        return;
      }
    }

    if (
      !isReversed &&
      currentInputAsset.style.symbol.toLowerCase() !== "cbbtc"
    ) {
      toastInfo({
        title: "Not supported",
        description: "[TODO: Add support for other tokens]",
      });
      return;
    }

    const estimatedOutputAmountInSatoshis = BigInt(
      Math.round(parseFloat(outputAmount) * 10 ** BITCOIN_DECIMALS)
    );

    const inputAmountInSatoshis = convertInputAmountToFullDecimals();

    console.log("inputAmountInSatoshis", inputAmountInSatoshis);
    if (quote && inputAmountInSatoshis) {
      console.log("sending swap request");
      sendOTCRequest(quote, payoutAddress, refundAddress);
    }
  };

  // Always enable the button visually, handle validation in handleSwap
  const canSwap = true;

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
            bg={
              currentInputAsset?.style?.dark_bg_color ||
              "rgba(37, 82, 131, 0.66)"
            }
            w="100%"
            h="121px"
            border="2px solid"
            borderColor={currentInputAsset?.style?.bg_color || "#255283"}
            borderRadius="16px"
          >
            <Flex direction="column" py="12px" px="8px">
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

              <Input
                value={rawInputAmount}
                onChange={handleInputChange}
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
                  color:
                    currentInputAsset?.style?.light_text_color || "#4A90E2",
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
                {(!isNaN(parseFloat(rawInputAmount)) && rawInputAmount
                  ? parseFloat(rawInputAmount) * BTC_USD_EXCHANGE_RATE
                  : 0
                ).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </Text>
            </Flex>

            <Spacer />
            <Flex mr="8px">
              <WebAssetTag
                cursor="pointer"
                asset={inputAssetIdentifier}
                // onDropDown={() => {
                //   toastInfo({
                //     title: "Token selection coming soon!",
                //     description: "Currently defaulted to Coinbase BTC",
                //   });
                // }}
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
            bg={
              currentOutputAsset?.style?.dark_bg_color ||
              "rgba(46, 29, 14, 0.66)"
            }
            w="100%"
            h="121px"
            border="2px solid"
            borderColor={currentOutputAsset?.style?.bg_color || "#78491F"}
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
                  color:
                    currentOutputAsset?.style?.light_text_color || "#805530",
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
                {(!isNaN(parseFloat(outputAmount)) && outputAmount
                  ? parseFloat(outputAmount) * BTC_USD_EXCHANGE_RATE
                  : 0
                ).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </Text>
            </Flex>

            <Spacer />
            <Flex mr="8px">
              <WebAssetTag cursor="default" asset={outputAssetIdentifier} />
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
              {lastEditedField === "input"
                ? `1 ${currentInputAsset?.style?.symbol} = ${EXCHANGE_RATE.toFixed(3)} ${currentOutputAsset?.style?.symbol}`
                : `1 ${currentOutputAsset?.style?.symbol} = ${(1 / EXCHANGE_RATE).toFixed(6)} ${currentInputAsset?.style?.symbol}`}
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

          {/* Refund Address - Animated (appears first) - Only show for BTC->cbBTC swaps */}
          {isReversed && (
            <Flex
              direction="column"
              w="100%"
              opacity={hasStartedTyping ? 1 : 0}
              transform={
                hasStartedTyping ? "translateY(0px)" : "translateY(30px)"
              }
              transition="all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
              transitionDelay={hasStartedTyping ? "0.1s" : "0s"}
              pointerEvents={hasStartedTyping ? "auto" : "none"}
              mb="-10px"
              overflow="hidden"
              maxHeight={hasStartedTyping ? "200px" : "0px"}
            >
              {/* Refund Address */}
              <Flex ml="8px" alignItems="center" mt="18px" w="100%" mb="10px">
                <Text
                  fontSize="15px"
                  fontFamily={FONT_FAMILIES.NOSTROMO}
                  color={colors.offWhite}
                >
                  {isReversed
                    ? "Bitcoin Refund Address"
                    : "cbBTC Refund Address"}
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
                        Paste an refund address in the case that a market maker
                        is unable to fill your order
                      </ChakraTooltip.Content>
                    </ChakraTooltip.Positioner>
                  </Portal>
                </ChakraTooltip.Root>
              </Flex>
              <Flex
                mt="-4px"
                mb="10px"
                px="10px"
                bg={
                  currentInputAsset?.style?.dark_bg_color ||
                  "rgba(37, 82, 131, 0.66)"
                }
                border={`2px solid ${currentInputAsset?.style?.bg_color || "#255283"}`}
                w="100%"
                h="60px"
                borderRadius="16px"
              >
                <Flex direction="row" py="6px" px="8px">
                  <Input
                    value={refundAddress}
                    onChange={(e) => setRefundAddress(e.target.value)}
                    fontFamily="Aux"
                    border="none"
                    bg="transparent"
                    outline="none"
                    mt="3.5px"
                    mr="15px"
                    ml="-4px"
                    p="0px"
                    w="485px"
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
                    placeholder={
                      isReversed
                        ? "bc1q5d7rjq7g6rd2d..."
                        : "0x742d35cc6bf4532..."
                    }
                    _placeholder={{
                      color:
                        currentInputAsset?.style?.light_text_color || "#4A90E2",
                    }}
                    spellCheck={false}
                  />

                  {refundAddress.length > 0 && (
                    <Flex ml="0px">
                      {isReversed ? (
                        <BitcoinAddressValidation
                          address={refundAddress}
                          validation={refundAddressValidation}
                        />
                      ) : (
                        // Ethereum address validation indicator - styled like BitcoinAddressValidation
                        <Flex
                          w="24px"
                          h="24px"
                          borderRadius="50%"
                          align="center"
                          justify="center"
                          bg={
                            refundAddressValidation.isValid
                              ? "#4CAF50"
                              : "#f44336"
                          }
                          alignSelf="center"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            {refundAddressValidation.isValid ? (
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            ) : (
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            )}
                          </svg>
                        </Flex>
                      )}
                    </Flex>
                  )}
                </Flex>
              </Flex>
            </Flex>
          )}

          {/* Recipient Address - Animated (appears second) */}
          <Flex
            direction="column"
            w="100%"
            mb="5px"
            opacity={hasStartedTyping ? 1 : 0}
            transform={
              hasStartedTyping ? "translateY(0px)" : "translateY(30px)"
            }
            transition="all 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
            transitionDelay={hasStartedTyping ? "0.3s" : "0s"}
            pointerEvents={hasStartedTyping ? "auto" : "none"}
            overflow="hidden"
            maxHeight={hasStartedTyping ? "200px" : "0px"}
          >
            {/* Payout Recipient Address */}
            <Flex ml="8px" alignItems="center" mt="18px" w="100%" mb="10px">
              <Text
                fontSize="15px"
                fontFamily={FONT_FAMILIES.NOSTROMO}
                color={colors.offWhite}
              >
                {isReversed
                  ? "cbBTC Recipient Address"
                  : "Bitcoin Recipient Address"}
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
                      {isReversed
                        ? "Enter your Ethereum address to receive cbBTC tokens."
                        : "Only P2WPKH, P2PKH, or P2SH Bitcoin addresses are supported."}
                    </ChakraTooltip.Content>
                  </ChakraTooltip.Positioner>
                </Portal>
              </ChakraTooltip.Root>
            </Flex>
            <Flex
              mt="-4px"
              mb="10px"
              px="10px"
              bg={
                currentOutputAsset?.style?.dark_bg_color ||
                "rgba(46, 29, 14, 0.66)"
              }
              border={`2px solid ${currentOutputAsset?.style?.bg_color || "#78491F"}`}
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
                  placeholder={
                    isReversed ? "0x742d35cc6bf4532..." : "bc1q5d7rjq7g6rd2d..."
                  }
                  _placeholder={{
                    color:
                      currentOutputAsset?.style?.light_text_color || "#856549",
                  }}
                  spellCheck={false}
                />

                {payoutAddress.length > 0 && (
                  <Flex ml="0px">
                    {!isReversed ? (
                      <BitcoinAddressValidation
                        address={payoutAddress}
                        validation={addressValidation}
                      />
                    ) : (
                      // Ethereum address validation indicator - styled like BitcoinAddressValidation
                      <Flex
                        w="24px"
                        h="24px"
                        borderRadius="50%"
                        align="center"
                        justify="center"
                        bg={addressValidation.isValid ? "#4CAF50" : "#f44336"}
                        alignSelf="center"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="white"
                        >
                          {addressValidation.isValid ? (
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          ) : (
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          )}
                        </svg>
                      </Flex>
                    )}
                  </Flex>
                )}
              </Flex>
            </Flex>
          </Flex>
        </Flex>

        {/* Swap Button */}
        <Flex
          bg={colors.purpleBackground}
          _hover={{
            bg: !isButtonLoading ? colors.purpleHover : undefined,
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
          border="3px solid #445BCB"
        >
          {isButtonLoading && (
            <Spinner size="sm" color={colors.offWhite} mr="10px" />
          )}
          <Text color={colors.offWhite} fontFamily="Nostromo">
            {isPending
              ? "Confirm in Wallet..."
              : isConfirming
                ? "Confirming..."
                : "Swap"}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};
