import { Flex, Text, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { opaqueBackgroundColor } from "@/utils/constants";
import { useStore } from "@/utils/store";
import { useUserLimitOrders } from "@/hooks/useUserLimitOrders";
import { LimitOrderRow } from "./LimitOrderRow";
import useWindowSize from "@/hooks/useWindowSize";

type Tab = "open" | "history";

export const OpenOrdersPanel = () => {
  const { isMobile } = useWindowSize();
  const [activeTab, setActiveTab] = useState<Tab>("open");

  const primaryEvmAddress = useStore((s) => s.primaryEvmAddress);
  const btcAddress = useStore((s) => s.btcAddress);
  const rift = useStore((s) => s.rift);

  const address = primaryEvmAddress || btcAddress;
  const { openOrders, historyOrders, hasMoreOpen, hasMoreHistory, isLoading, refetch } = useUserLimitOrders(address, rift);

  const orders = activeTab === "open" ? openOrders : historyOrders;

  const formatCount = (count: number, hasMore: boolean) =>
    hasMore ? `${count}+` : `${count}`;

  const tabs: { key: Tab; label: string; countDisplay: string }[] = [
    { key: "open", label: "Open", countDisplay: formatCount(openOrders.length, hasMoreOpen) },
    { key: "history", label: "History", countDisplay: formatCount(historyOrders.length, hasMoreHistory) },
  ];

  const actualBorderColor = "#323232";
  const borderColor = `2px solid ${actualBorderColor}`;

  return (
    <Flex
      direction="column"
      w={isMobile ? "100%" : "530px"}
      borderRadius="30px"
      {...opaqueBackgroundColor}
      borderBottom={borderColor}
      borderLeft={borderColor}
      borderTop={borderColor}
      borderRight={borderColor}
      py={isMobile ? "20px" : "27px"}
      maxH="600px"
      overflow="hidden"
    >
      <Flex w="91.5%" mx="auto" direction="column" minH={0} flex={1}>
        {/* Tab bar */}
        <Flex
          bg="#1a1a1a"
          borderRadius="10px"
          p="3px"
          gap="2px"
          mb="16px"
          w="fit-content"
        >
          {tabs.map(({ key, label, countDisplay }) => {
            const isActive = activeTab === key;
            return (
              <Flex
                key={key}
                px="16px"
                py="6px"
                borderRadius="8px"
                cursor="pointer"
                bg={isActive ? "#2a2a2a" : "transparent"}
                onClick={() => setActiveTab(key)}
                transition="background 0.15s ease"
                _hover={!isActive ? { bg: "#222" } : undefined}
                gap="6px"
                align="center"
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
                <Text
                  fontSize="11px"
                  fontFamily={FONT_FAMILIES.AUX_MONO}
                  color={isActive ? colors.textGray : colors.darkerGray}
                  userSelect="none"
                >
                  ({countDisplay})
                </Text>
              </Flex>
            );
          })}
        </Flex>

        {/* Content */}
        <Flex
          direction="column"
          flex={1}
          overflowY="auto"
          gap="8px"
          css={{
            "&::-webkit-scrollbar": { width: "4px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              background: colors.borderGray,
              borderRadius: "4px",
            },
          }}
        >
          {!address ? (
            <EmptyState message="Connect wallet to view orders" />
          ) : isLoading && orders.length === 0 ? (
            <Flex justify="center" align="center" py="60px">
              <Spinner size="md" color={colors.textGray} />
            </Flex>
          ) : orders.length === 0 ? (
            <EmptyState
              message={
                activeTab === "open"
                  ? "No open orders"
                  : "No order history"
              }
              subtitle={
                activeTab === "open"
                  ? "Your open limit orders will appear here"
                  : "Completed and cancelled orders will appear here"
              }
            />
          ) : (
            orders.map((order) => (
              <LimitOrderRow
                key={order.orderId}
                order={order}
                onCancelled={refetch}
              />
            ))
          )}
        </Flex>
      </Flex>
    </Flex>
  );
};

const EmptyState = ({
  message,
  subtitle,
}: {
  message: string;
  subtitle?: string;
}) => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    py="50px"
    gap="8px"
  >
    <Text
      fontSize="14px"
      fontFamily={FONT_FAMILIES.AUX_MONO}
      color={colors.textGray}
      letterSpacing="-0.5px"
      textAlign="center"
    >
      {message}
    </Text>
    {subtitle && (
      <Text
        fontSize="12px"
        fontFamily={FONT_FAMILIES.AUX_MONO}
        color={colors.darkerGray}
        letterSpacing="-0.5px"
        textAlign="center"
      >
        {subtitle}
      </Text>
    )}
  </Flex>
);
