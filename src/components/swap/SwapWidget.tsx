import {
  Flex,
  Text,
  Input,
  Spacer,
  Skeleton,
  Box,
  Tooltip as ChakraTooltip,
  Portal,
} from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent } from "react";
import { colors } from "@/utils/colors";
import { opaqueBackgroundColor } from "@/utils/constants";
import TokenButton from "@/components/other/TokenButton";
import WebAssetTag from "@/components/other/WebAssetTag";
import { InfoSVG } from "../other/SVGs";
import { useStore } from "@/utils/store";
import { toastInfo } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { TokenStyle, ValidAsset } from "@/utils/types";

export const SwapWidget = () => {
  const { isMobile } = useWindowSize();
  const [mounted, setMounted] = useState(false);
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);

  const [inputAsset, setInputAsset] = useState<ValidAsset>(
    selectedChainConfig.underlyingSwappingAsset
  );

  // Store hooks

  // Styling constants
  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  useEffect(() => {
    setMounted(true);
    // Reset values on mount
    setInputAmount("");
    setOutputAmount("");
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputAmount(value);

    // Simple 1:1 conversion for demo (in real app, would use swap route)
    if (value && !isNaN(parseFloat(value))) {
      setOutputAmount((parseFloat(value) * 0.999).toFixed(8)); // Simple fee calculation
    } else {
      setOutputAmount("");
    }
  };

  const handleSwap = () => {
    if (mounted && isMobile) {
      toastInfo({
        title: "Hop on your laptop",
        description:
          "This app is too cool for small screens, mobile coming soon!",
      });
      return;
    }

    if (!inputAmount || !outputAmount) {
      toastInfo({
        title: "Enter amounts",
        description: "Please enter an amount to swap",
      });
      return;
    }

    toastInfo({
      title: "Swap functionality coming soon!",
      description: "This is a demo swap widget",
    });
  };

  const canSwap = inputAmount && outputAmount && parseFloat(inputAmount) > 0;

  if (!mounted) {
    return (
      <Flex
        direction="column"
        align="center"
        py="27px"
        w="630px"
        borderRadius="20px"
        {...opaqueBackgroundColor}
        borderBottom={borderColor}
        borderLeft={borderColor}
        borderTop={borderColor}
        borderRight={borderColor}
      >
        <Skeleton height="400px" width="90%" borderRadius="10px" />
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      align="center"
      py={mounted && isMobile ? "20px" : "27px"}
      w={mounted && isMobile ? "100%" : "630px"}
      borderRadius="20px"
      {...opaqueBackgroundColor}
      borderBottom={borderColor}
      borderLeft={borderColor}
      borderTop={borderColor}
      borderRight={borderColor}
    >
      <Flex w="90%" direction="column">
        {/* Input Asset Section */}
        <Flex w="100%" flexDir="column" position="relative">
          <Flex
            px="10px"
            bg={inputAsset?.style?.dark_bg_color || "rgba(37, 82, 131, 0.66)"}
            w="100%"
            h="117px"
            border="2px solid"
            borderColor={inputAsset?.style?.bg_color || "#255283"}
            borderRadius="10px"
          >
            <Flex direction="column" py="10px" px="5px">
              <Text
                color={!inputAmount ? colors.offWhite : colors.textGray}
                fontSize="14px"
                letterSpacing="-1px"
                fontWeight="normal"
                fontFamily="Aux"
                userSelect="none"
              >
                You Send
              </Text>

              <Input
                value={inputAmount}
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
                  color: inputAsset?.style?.light_text_color || "#4A90E2",
                }}
              />

              <Text
                color={!inputAmount ? colors.offWhite : colors.textGray}
                fontSize="14px"
                mt="6px"
                ml="1px"
                letterSpacing="-1px"
                fontWeight="normal"
                fontFamily="Aux"
              >
                {(0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </Text>
            </Flex>

            <Spacer />
            <Flex mr="6px">
              <TokenButton
                cursor="pointer"
                asset={inputAsset}
                onDropDown={() => {
                  toastInfo({
                    title: "Token selection coming soon!",
                    description: "Currently defaulted to Coinbase BTC",
                  });
                }}
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
            onClick={() =>
              toastInfo({
                title: "Reverse swap coming soon!",
                description: "BTC -> Token swaps are in development",
              })
            }
            position="absolute"
            bg="#161616"
            border="2px solid #323232"
            top="34.5%"
            left="50%"
            transform="translate(-50%, -50%)"
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

          {/* Output Asset Section (Always BTC) */}
          <Flex
            mt="5px"
            px="10px"
            bg="rgba(46, 29, 14, 0.66)"
            w="100%"
            h="117px"
            border="2px solid #78491F"
            borderRadius="10px"
          >
            <Flex direction="column" py="10px" px="5px">
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
                readOnly
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
                _placeholder={{ color: "#805530" }}
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
                {(0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </Text>
            </Flex>

            <Spacer />
            <Flex mr="6px">
              <WebAssetTag cursor="default" asset="BTC" />
            </Flex>
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
            1 cbBTC ≈ 0.999 BTC
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

        {/* Swap Button */}
        <Flex
          bg={
            canSwap ? colors.purpleBackground : colors.purpleBackgroundDisabled
          }
          _hover={{
            bg: canSwap ? colors.purpleHover : undefined,
          }}
          w="100%"
          mt="15px"
          transition="0.2s"
          h="48px"
          onClick={handleSwap}
          fontSize="16px"
          align="center"
          userSelect="none"
          cursor={canSwap ? "pointer" : "not-allowed"}
          borderRadius="10px"
          justify="center"
          border={canSwap ? "3px solid #445BCB" : "3px solid #3242a8"}
        >
          <Text
            color={canSwap ? colors.offWhite : colors.darkerGray}
            fontFamily="Nostromo"
          >
            {canSwap ? "Swap" : "Enter Amount"}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};
