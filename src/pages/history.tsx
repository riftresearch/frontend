import { Navbar } from "@/components/nav/Navbar";
import { OpenGraph } from "@/components/other/OpenGraph";
import { TEEStatusFooter } from "@/components/other/TEEStatusFooter";
import { useSyncChainIdToStore } from "@/hooks/useSyncChainIdToStore";
import { useBtcEthPrices } from "@/hooks/useBtcEthPrices";
import { Flex, Text, Spinner } from "@chakra-ui/react";
import { UserSwapHistory } from "@/components/activity/UserSwapHistory";
import { StatsOverview } from "@/components/other/StatsOverview";
import useWindowSize from "@/hooks/useWindowSize";
import { useState } from "react";
import { useStore } from "@/utils/store";
import { useUserLimitOrders } from "@/hooks/useUserLimitOrders";
import { LimitOrderRow } from "@/components/swap/LimitOrderRow";
import { colors } from "@/utils/colors";
import { FONT_FAMILIES } from "@/utils/font";

export default function History() {
  const { isMobile } = useWindowSize();
  const [showStats, setShowStats] = useState(false);
  const [activeTab, setActiveTab] = useState<"market" | "limit">("market");
  const [limitSubTab, setLimitSubTab] = useState<"open" | "history">("open");

  // Get user addresses and rift SDK
  const primaryEvmAddress = useStore((s) => s.primaryEvmAddress);
  const btcAddress = useStore((s) => s.btcAddress);
  const rift = useStore((s) => s.rift);
  const userAddress = primaryEvmAddress || btcAddress;

  // Fetch limit orders
  const {
    openOrders,
    historyOrders,
    hasMoreOpen,
    hasMoreHistory,
    isLoading: isLimitOrdersLoading,
    refetch: refetchLimitOrders,
  } = useUserLimitOrders(userAddress, rift);

  useSyncChainIdToStore();
  useBtcEthPrices(); // Fetch BTC/ETH prices for liquidity display

  // Show stats once initial loading completes
  const handleInitialLoadComplete = () => {
    setShowStats(true);
  };

  const formatCount = (count: number, hasMore: boolean) =>
    hasMore ? `${count}+` : `${count}`;

  const limitOrders = limitSubTab === "open" ? openOrders : historyOrders;

  return (
    <>
      <OpenGraph />
      <Flex
        minH="100vh"
        width="100%"
        direction="column"
        backgroundImage="url('/images/rift_background_low.webp')"
        backgroundSize="cover"
        backgroundPosition="center"
        zIndex={0}
      >
        <Navbar />
        <Flex
          direction="column"
          align="center"
          justify="flex-start"
          alignSelf="center"
          w="100%"
          maxW="1400px"
          px="20px"
          py="20px"
          flex="1"
        >
          {/* Main tabs: Market Orders / Limit Orders */}
          <Flex
            w="100%"
            maxW="1400px"
            gap="24px"
            mb="20px"
            borderBottom="1px solid"
            borderColor={colors.borderGray}
          >
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              fontWeight={600}
              color={activeTab === "market" ? colors.offWhite : colors.textGray}
              cursor="pointer"
              onClick={() => setActiveTab("market")}
              pb="12px"
              borderBottom={activeTab === "market" ? `2px solid ${colors.offWhite}` : "2px solid transparent"}
              mb="-1px"
              transition="all 0.15s ease"
              _hover={{ color: colors.offWhite }}
            >
              Market Orders
            </Text>
            <Text
              fontSize="16px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              fontWeight={600}
              color={activeTab === "limit" ? colors.offWhite : colors.textGray}
              cursor="pointer"
              onClick={() => setActiveTab("limit")}
              pb="12px"
              borderBottom={activeTab === "limit" ? `2px solid ${colors.offWhite}` : "2px solid transparent"}
              mb="-1px"
              transition="all 0.15s ease"
              _hover={{ color: colors.offWhite }}
            >
              Limit Orders ({openOrders.length + historyOrders.length})
            </Text>
          </Flex>

          {/* Market Orders content */}
          {activeTab === "market" && (
            <UserSwapHistory onInitialLoadComplete={handleInitialLoadComplete} orderTypeFilter="market" />
          )}

          {/* Limit Orders content */}
          {activeTab === "limit" && (
            <Flex direction="column" w="100%" maxW="1400px">
              {/* Open/History sub-tabs */}
              <Flex
                bg="#1a1a1a"
                borderRadius="10px"
                p="3px"
                gap="2px"
                mb="20px"
                w="fit-content"
              >
                {[
                  { key: "open" as const, label: "Open", count: openOrders.length, hasMore: hasMoreOpen },
                  { key: "history" as const, label: "History", count: historyOrders.length, hasMore: hasMoreHistory },
                ].map(({ key, label, count, hasMore }) => {
                  const isActive = limitSubTab === key;
                  return (
                    <Flex
                      key={key}
                      px="20px"
                      py="8px"
                      borderRadius="8px"
                      cursor="pointer"
                      bg={isActive ? "#2a2a2a" : "transparent"}
                      onClick={() => setLimitSubTab(key)}
                      transition="background 0.15s ease"
                      _hover={!isActive ? { bg: "#222" } : undefined}
                      gap="8px"
                      align="center"
                    >
                      <Text
                        fontSize="14px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        fontWeight={isActive ? "bold" : "normal"}
                        color={isActive ? colors.offWhite : colors.textGray}
                        letterSpacing="-0.5px"
                        userSelect="none"
                      >
                        {label}
                      </Text>
                      <Text
                        fontSize="12px"
                        fontFamily={FONT_FAMILIES.AUX_MONO}
                        color={isActive ? colors.textGray : colors.darkerGray}
                        userSelect="none"
                      >
                        ({formatCount(count, hasMore)})
                      </Text>
                    </Flex>
                  );
                })}
              </Flex>

              {/* Limit orders list */}
              <Flex direction="column" gap="12px" w="100%">
                {!userAddress ? (
                  <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    py="80px"
                    gap="8px"
                  >
                    <Text
                      fontSize="15px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      letterSpacing="-0.5px"
                      textAlign="center"
                    >
                      Connect wallet to view orders
                    </Text>
                  </Flex>
                ) : isLimitOrdersLoading && limitOrders.length === 0 ? (
                  <Flex justify="center" align="center" py="80px">
                    <Spinner size="lg" color={colors.textGray} />
                  </Flex>
                ) : limitOrders.length === 0 ? (
                  <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    py="80px"
                    gap="8px"
                  >
                    <Text
                      fontSize="15px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.textGray}
                      letterSpacing="-0.5px"
                      textAlign="center"
                    >
                      {limitSubTab === "open" ? "No open orders" : "No order history"}
                    </Text>
                    <Text
                      fontSize="13px"
                      fontFamily={FONT_FAMILIES.AUX_MONO}
                      color={colors.darkerGray}
                      letterSpacing="-0.5px"
                      textAlign="center"
                    >
                      {limitSubTab === "open"
                        ? "Your open limit orders will appear here"
                        : "Completed and cancelled orders will appear here"}
                    </Text>
                  </Flex>
                ) : (
                  limitOrders.map((order) => (
                    <LimitOrderRow
                      key={order.orderId}
                      order={order}
                      onCancelled={refetchLimitOrders}
                    />
                  ))
                )}
              </Flex>
            </Flex>
          )}

          {/* Stats Overview at bottom - only show after initial spinner completes */}
          {showStats && activeTab === "market" && (
            <Flex w="100%" maxW="1400px" mt={isMobile ? "10px" : "15px"} mb="40px">
              <StatsOverview />
            </Flex>
          )}
        </Flex>
        {process.env.NEXT_PUBLIC_FAKE_OTC === "true" ||
        process.env.NEXT_PUBLIC_FAKE_RFQ === "true" ? null : (
          <TEEStatusFooter />
        )}
      </Flex>
    </>
  );
}
