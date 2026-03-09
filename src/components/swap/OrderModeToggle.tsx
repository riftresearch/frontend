import { Flex, Text } from "@chakra-ui/react";
import { useCallback } from "react";
import { FONT_FAMILIES } from "@/utils/font";
import { useStore, OrderMode } from "@/utils/store";
import { ZERO_USD_DISPLAY } from "@/utils/constants";
import { colors } from "@/utils/colors";

export const OrderModeToggle = () => {
  const orderMode = useStore((s) => s.orderMode);
  const setOrderMode = useStore((s) => s.setOrderMode);
  const setDisplayedInputAmount = useStore((s) => s.setDisplayedInputAmount);
  const setOutputAmount = useStore((s) => s.setOutputAmount);
  const setInputUsdValue = useStore((s) => s.setInputUsdValue);
  const setOutputUsdValue = useStore((s) => s.setOutputUsdValue);
  const setQuote = useStore((s) => s.setQuote);
  const setExecuteSwap = useStore((s) => s.setExecuteSwap);
  const setFeeOverview = useStore((s) => s.setFeeOverview);
  const setFullPrecisionInputAmount = useStore((s) => s.setFullPrecisionInputAmount);
  const setLimitPrice = useStore((s) => s.setLimitPrice);

  const handleModeChange = useCallback(
    (mode: OrderMode) => {
      if (mode === orderMode) return;

      // Clear shared amount state when switching modes
      setDisplayedInputAmount("");
      setOutputAmount("");
      setInputUsdValue(ZERO_USD_DISPLAY);
      setOutputUsdValue(ZERO_USD_DISPLAY);
      setFullPrecisionInputAmount(null);
      setQuote(null);
      setExecuteSwap(null);
      setFeeOverview(null);
      setLimitPrice("");

      setOrderMode(mode);
    },
    [
      orderMode, setOrderMode, setDisplayedInputAmount, setOutputAmount,
      setInputUsdValue, setOutputUsdValue, setFullPrecisionInputAmount,
      setQuote, setExecuteSwap, setFeeOverview, setLimitPrice,
    ]
  );

  const modes: { key: OrderMode; label: string }[] = [
    { key: "market", label: "Market" },
    { key: "limit", label: "Limit" },
  ];

  return (
    <Flex
      bg="#1a1a1a"
      borderRadius="10px"
      p="3px"
      gap="2px"
      mb="16px"
      w="fit-content"
    >
      {modes.map(({ key, label }) => {
        const isActive = orderMode === key;
        return (
          <Flex
            key={key}
            px="16px"
            py="6px"
            borderRadius="8px"
            cursor="pointer"
            bg={isActive ? "#2a2a2a" : "transparent"}
            onClick={() => handleModeChange(key)}
            transition="background 0.15s ease"
            _hover={!isActive ? { bg: "#222" } : undefined}
          >
            <Text
              fontSize="13px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              fontWeight={isActive ? "bold" : "normal"}
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
  );
};
