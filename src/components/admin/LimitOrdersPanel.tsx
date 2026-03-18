import React from "react";
import { Box, Flex, Text, Spinner, Button, Tooltip } from "@chakra-ui/react";
import { GridFlex } from "@/components/other/GridFlex";
import { FONT_FAMILIES } from "@/utils/font";
import { colorsAnalytics } from "@/utils/colorsAnalytics";
import { FiRefreshCw, FiExternalLink, FiCopy, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { toastSuccess, toastError } from "@/utils/toast";
import useWindowSize from "@/hooks/useWindowSize";
import { AssetIcon } from "@/components/other/AssetIcon";
import {
  getLimitOrders,
  OrderItem,
  OrderStatus,
  Currency,
} from "@/utils/ordersClient";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: string | null, decimals: number): string {
  if (!amount) return "—";
  const value = parseFloat(amount) / Math.pow(10, decimals);
  if (value === 0) return "0";
  if (value < 0.0001) return "<0.0001";
  return value.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, "");
}

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address || "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function truncateOrderId(orderId: string): string {
  if (!orderId || orderId.length < 12) return orderId || "—";
  return `...${orderId.slice(-8)}`;
}

function getChainName(chain: { kind: string; chainId?: number }): string {
  if (chain.kind === "BITCOIN") return "BTC";
  if (chain.kind === "SOLANA") return "SOL";
  if (chain.kind === "EVM") {
    switch (chain.chainId) {
      case 1:
        return "ETH";
      case 8453:
        return "BASE";
      case 42161:
        return "ARB";
      default:
        return `EVM:${chain.chainId}`;
    }
  }
  return chain.kind;
}

function getChainId(chain: { kind: string; chainId?: number }): number {
  if (chain.kind === "EVM" && chain.chainId) return chain.chainId;
  return 1;
}

function getAssetTicker(currency: Currency): string {
  const chainKind = currency.chain.kind;
  const tokenKind = currency.token.kind;
  const tokenAddress = (currency.token as { address?: string }).address;
  
  if (chainKind === "BITCOIN" && tokenKind === "NATIVE") return "BTC";
  if (chainKind === "SOLANA" && tokenKind === "NATIVE") return "SOL";
  if (chainKind === "EVM" && tokenKind === "NATIVE") return "ETH";
  
  if (tokenAddress) {
    const addr = tokenAddress.toLowerCase();
    if (addr === "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf") return "cbBTC";
    if (addr === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" || 
        addr === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") return "USDC";
    if (addr === "0xdac17f958d2ee523a2206206994597c13d831ec7") return "USDT";
    if (addr === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" ||
        addr === "0x4200000000000000000000000000000000000006") return "WETH";
    if (addr === "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599") return "WBTC";
  }
  
  return tokenKind;
}

function getTokenAddress(currency: Currency): string | undefined {
  const token = currency.token as { address?: string };
  return token.address;
}

function getTokenName(token: { kind: string; address?: string }): string {
  if (token.kind === "NATIVE") return "Native";
  if (token.address) return truncateAddress(token.address);
  return token.kind;
}

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case "filled":
      case "settled":
        return {
          bg: colorsAnalytics.greenBackground,
          border: colorsAnalytics.greenOutline,
          text: colorsAnalytics.offWhite,
        };
      case "unfilled":
        return {
          bg: "rgba(251, 191, 36, 0.15)",
          border: "rgba(251, 191, 36, 0.4)",
          text: "#fbbf24",
        };
      case "cancelled":
      case "refunded":
      case "failed":
        return {
          bg: colorsAnalytics.redBackground,
          border: colorsAnalytics.red,
          text: colorsAnalytics.offWhite,
        };
      default:
        return {
          bg: colorsAnalytics.offBlackLighter,
          border: colorsAnalytics.borderGrayLight,
          text: colorsAnalytics.textGray,
        };
    }
  };

  const style = getStatusStyle();

  return (
    <Flex
      align="center"
      justify="center"
      bg={style.bg}
      borderRadius="12px"
      border={`2px solid ${style.border}`}
      color={style.text}
      px="10px"
      py="4px"
      fontSize="11px"
      fontFamily={FONT_FAMILIES.SF_PRO}
      textTransform="capitalize"
    >
      {status}
    </Flex>
  );
};

const OrderRow: React.FC<{
  order: OrderItem;
  isMobile?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}> = React.memo(({ order, isMobile, isExpanded, onToggle }) => {
  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(order.orderId);
    toastSuccess({
      title: "Copied to clipboard",
      description: `Order ID: ${truncateOrderId(order.orderId)}`,
    });
  };

  const handleOpenExplorer = (e: React.MouseEvent, txHash: string | null, chain: string) => {
    e.stopPropagation();
    if (!txHash) {
      toastError(null, {
        title: "No transaction",
        description: "Transaction hash not available",
      });
      return;
    }

    let url: string;
    if (chain === "BTC") {
      url = `https://mempool.space/tx/${txHash}`;
    } else if (chain === "BASE") {
      url = `https://basescan.org/tx/${txHash}`;
    } else {
      url = `https://etherscan.io/tx/${txHash}`;
    }
    window.open(url, "_blank");
  };

  const sellChain = getChainName(order.sellCurrency.chain);
  const buyChain = getChainName(order.buyCurrency.chain);

  return (
    <Flex
      direction="column"
      w="100%"
      bg="rgba(255, 255, 255, 0.01)"
      borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
      cursor="pointer"
      _hover={{ bg: "rgba(255, 255, 255, 0.03)" }}
      transition="background 150ms ease"
      onClick={onToggle}
    >
      {/* Main Row */}
      <Flex
        w="100%"
        px={isMobile ? "12px" : "16px"}
        py={isMobile ? "12px" : "14px"}
        align="center"
        gap={isMobile ? "8px" : "16px"}
      >
        {/* Created */}
        <Box w={isMobile ? "70px" : "100px"} flexShrink={0}>
          <Text
            fontSize={isMobile ? "11px" : "13px"}
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
          >
            {formatDate(order.createdAt)}
          </Text>
        </Box>

        {/* Order ID */}
        <Flex
          w={isMobile ? "70px" : "90px"}
          flexShrink={0}
          as="button"
          onClick={handleCopyId}
          bg="#1D1D1D"
          px={isMobile ? "6px" : "8px"}
          py="6px"
          borderRadius="8px"
          _hover={{ filter: "brightness(1.1)" }}
          cursor="pointer"
          justifyContent="center"
          alignItems="center"
          gap="4px"
        >
          <Text
            fontSize={isMobile ? "10px" : "12px"}
            color={colorsAnalytics.offWhite}
            fontFamily={FONT_FAMILIES.SF_PRO}
          >
            {truncateOrderId(order.orderId)}
          </Text>
          <FiCopy size={10} color={colorsAnalytics.textGray} />
        </Flex>

        {/* Status */}
        <Box w={isMobile ? "70px" : "90px"} flexShrink={0}>
          <StatusBadge status={order.status} />
        </Box>

        {/* Provider */}
        {!isMobile && (
          <Box w="80px" flexShrink={0}>
            <Text
              fontSize="12px"
              color={colorsAnalytics.textGray}
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {order.provider || "—"}
            </Text>
          </Box>
        )}

        {/* Sell */}
        <Flex direction="column" w={isMobile ? "90px" : "140px"} flexShrink={0} gap="2px">
          <Flex align="center" gap="6px">
            <AssetIcon
              asset={getAssetTicker(order.sellCurrency)}
              address={getTokenAddress(order.sellCurrency)}
              chainId={getChainId(order.sellCurrency.chain)}
              size={isMobile ? 14 : 16}
            />
            <Text
              fontSize={isMobile ? "11px" : "13px"}
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {formatAmount(order.quotedSellAmount, order.sellCurrency.token.decimals)}
            </Text>
          </Flex>
          <Text
            fontSize="10px"
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            ml="22px"
          >
            {getAssetTicker(order.sellCurrency)} • {sellChain}
          </Text>
        </Flex>

        {/* Arrow */}
        <Text color={colorsAnalytics.textGray} fontSize="14px">
          →
        </Text>

        {/* Buy */}
        <Flex direction="column" w={isMobile ? "90px" : "140px"} flexShrink={0} gap="2px">
          <Flex align="center" gap="6px">
            <AssetIcon
              asset={getAssetTicker(order.buyCurrency)}
              address={getTokenAddress(order.buyCurrency)}
              chainId={getChainId(order.buyCurrency.chain)}
              size={isMobile ? 14 : 16}
            />
            <Text
              fontSize={isMobile ? "11px" : "13px"}
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {formatAmount(order.quotedBuyAmount, order.buyCurrency.token.decimals)}
            </Text>
          </Flex>
          <Text
            fontSize="10px"
            color={colorsAnalytics.textGray}
            fontFamily={FONT_FAMILIES.SF_PRO}
            ml="22px"
          >
            {getAssetTicker(order.buyCurrency)} • {buyChain}
          </Text>
        </Flex>

        {/* Sender */}
        {!isMobile && (
          <Flex
            w="100px"
            flexShrink={0}
            as="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(order.senderAddress);
              toastSuccess({
                title: "Copied",
                description: "Sender address copied",
              });
            }}
            bg="#1D1D1D"
            px="8px"
            py="6px"
            borderRadius="8px"
            _hover={{ filter: "brightness(1.1)" }}
            cursor="pointer"
            justifyContent="center"
            alignItems="center"
          >
            <Text
              fontSize="11px"
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
            >
              {truncateAddress(order.senderAddress)}
            </Text>
          </Flex>
        )}

        {/* Expand/Collapse */}
        <Flex flex="1" justify="flex-end" align="center">
          {isExpanded ? (
            <FiChevronUp size={16} color={colorsAnalytics.textGray} />
          ) : (
            <FiChevronDown size={16} color={colorsAnalytics.textGray} />
          )}
        </Flex>
      </Flex>

      {/* Expanded Details */}
      {isExpanded && (
        <Flex
          direction="column"
          px={isMobile ? "12px" : "16px"}
          pb="16px"
          gap="12px"
          bg="rgba(255, 255, 255, 0.02)"
          borderTop={`1px solid ${colorsAnalytics.borderGray}`}
        >
          {/* Addresses */}
          <Flex wrap="wrap" gap="16px" mt="12px">
            <Flex direction="column" gap="4px" minW="200px">
              <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                SENDER
              </Text>
              <Flex
                as="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(order.senderAddress);
                  toastSuccess({ title: "Copied", description: "Sender address copied" });
                }}
                align="center"
                gap="6px"
                _hover={{ opacity: 0.8 }}
              >
                <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {order.senderAddress || "—"}
                </Text>
                <FiCopy size={12} color={colorsAnalytics.textGray} />
              </Flex>
            </Flex>

            <Flex direction="column" gap="4px" minW="200px">
              <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                DESTINATION
              </Text>
              <Flex
                as="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(order.destinationAddress);
                  toastSuccess({ title: "Copied", description: "Destination address copied" });
                }}
                align="center"
                gap="6px"
                _hover={{ opacity: 0.8 }}
              >
                <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {order.destinationAddress || "—"}
                </Text>
                <FiCopy size={12} color={colorsAnalytics.textGray} />
              </Flex>
            </Flex>

            <Flex direction="column" gap="4px" minW="200px">
              <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                REFUND
              </Text>
              <Flex
                as="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(order.refundAddress);
                  toastSuccess({ title: "Copied", description: "Refund address copied" });
                }}
                align="center"
                gap="6px"
                _hover={{ opacity: 0.8 }}
              >
                <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {order.refundAddress || "—"}
                </Text>
                <FiCopy size={12} color={colorsAnalytics.textGray} />
              </Flex>
            </Flex>
          </Flex>

          {/* Amounts */}
          <Flex wrap="wrap" gap="16px">
            <Flex direction="column" gap="4px">
              <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                QUOTED SELL
              </Text>
              <Flex align="center" gap="6px">
                <AssetIcon
                  asset={getAssetTicker(order.sellCurrency)}
                  address={getTokenAddress(order.sellCurrency)}
                  chainId={getChainId(order.sellCurrency.chain)}
                  size={14}
                />
                <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {formatAmount(order.quotedSellAmount, order.sellCurrency.token.decimals)} {getAssetTicker(order.sellCurrency)}
                </Text>
              </Flex>
            </Flex>

            <Flex direction="column" gap="4px">
              <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                QUOTED BUY
              </Text>
              <Flex align="center" gap="6px">
                <AssetIcon
                  asset={getAssetTicker(order.buyCurrency)}
                  address={getTokenAddress(order.buyCurrency)}
                  chainId={getChainId(order.buyCurrency.chain)}
                  size={14}
                />
                <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {formatAmount(order.quotedBuyAmount, order.buyCurrency.token.decimals)} {getAssetTicker(order.buyCurrency)}
                </Text>
              </Flex>
            </Flex>

            {order.executedSellAmount && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  EXECUTED SELL
                </Text>
                <Flex align="center" gap="6px">
                  <AssetIcon
                    asset={getAssetTicker(order.sellCurrency)}
                    address={getTokenAddress(order.sellCurrency)}
                    chainId={getChainId(order.sellCurrency.chain)}
                    size={14}
                  />
                  <Text fontSize="12px" color={colorsAnalytics.greenOutline} fontFamily={FONT_FAMILIES.SF_PRO}>
                    {formatAmount(order.executedSellAmount, order.sellCurrency.token.decimals)} {getAssetTicker(order.sellCurrency)}
                  </Text>
                </Flex>
              </Flex>
            )}

            {order.executedBuyAmount && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  EXECUTED BUY
                </Text>
                <Flex align="center" gap="6px">
                  <AssetIcon
                    asset={getAssetTicker(order.buyCurrency)}
                    address={getTokenAddress(order.buyCurrency)}
                    chainId={getChainId(order.buyCurrency.chain)}
                    size={14}
                  />
                  <Text fontSize="12px" color={colorsAnalytics.greenOutline} fontFamily={FONT_FAMILIES.SF_PRO}>
                    {formatAmount(order.executedBuyAmount, order.buyCurrency.token.decimals)} {getAssetTicker(order.buyCurrency)}
                  </Text>
                </Flex>
              </Flex>
            )}
          </Flex>

          {/* Transactions */}
          <Flex wrap="wrap" gap="16px">
            {order.depositTxHash && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  DEPOSIT TX
                </Text>
                <Flex
                  as="button"
                  onClick={(e) => handleOpenExplorer(e, order.depositTxHash, sellChain)}
                  align="center"
                  gap="6px"
                  _hover={{ opacity: 0.8 }}
                >
                  <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                    {truncateAddress(order.depositTxHash || "")}
                  </Text>
                  <FiExternalLink size={12} color={colorsAnalytics.textGray} />
                </Flex>
              </Flex>
            )}

            {order.payoutTxHash && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  PAYOUT TX
                </Text>
                <Flex
                  as="button"
                  onClick={(e) => handleOpenExplorer(e, order.payoutTxHash, buyChain)}
                  align="center"
                  gap="6px"
                  _hover={{ opacity: 0.8 }}
                >
                  <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                    {truncateAddress(order.payoutTxHash || "")}
                  </Text>
                  <FiExternalLink size={12} color={colorsAnalytics.textGray} />
                </Flex>
              </Flex>
            )}

            {order.refundTxHash && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  REFUND TX
                </Text>
                <Flex
                  as="button"
                  onClick={(e) => handleOpenExplorer(e, order.refundTxHash, sellChain)}
                  align="center"
                  gap="6px"
                  _hover={{ opacity: 0.8 }}
                >
                  <Text fontSize="12px" color={colorsAnalytics.offWhite} fontFamily={FONT_FAMILIES.SF_PRO}>
                    {truncateAddress(order.refundTxHash || "")}
                  </Text>
                  <FiExternalLink size={12} color={colorsAnalytics.textGray} />
                </Flex>
              </Flex>
            )}
          </Flex>

          {/* IDs and Timestamps */}
          <Flex wrap="wrap" gap="16px">
            {order.otcSwapId && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  OTC SWAP ID
                </Text>
                <Text fontSize="11px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {order.otcSwapId}
                </Text>
              </Flex>
            )}

            {order.swapperSwapId && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  SWAPPER SWAP ID
                </Text>
                <Text fontSize="11px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {order.swapperSwapId}
                </Text>
              </Flex>
            )}

            <Flex direction="column" gap="4px">
              <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                UPDATED
              </Text>
              <Text fontSize="11px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                {formatDate(order.updatedAt)}
              </Text>
            </Flex>

            {order.terminalAt && (
              <Flex direction="column" gap="4px">
                <Text fontSize="10px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  TERMINAL AT
                </Text>
                <Text fontSize="11px" color={colorsAnalytics.textGray} fontFamily={FONT_FAMILIES.SF_PRO}>
                  {formatDate(order.terminalAt)}
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
});

OrderRow.displayName = "OrderRow";

type FilterStatus = "all" | OrderStatus;

export const LimitOrdersPanel: React.FC = () => {
  const { isMobile } = useWindowSize();
  const [orders, setOrders] = React.useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterStatus>("all");
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchOrders = React.useCallback(
    async (cursor?: string, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params: Parameters<typeof getLimitOrders>[0] = {
          limit: 50,
          cursor,
        };

        if (filter !== "all") {
          params.status = filter;
        }

        const response = await getLimitOrders(params);

        if (append) {
          setOrders((prev) => [...prev, ...response.items]);
        } else {
          setOrders(response.items);
        }
        setNextCursor(response.nextCursor);
      } catch (error) {
        console.error("Failed to fetch limit orders:", error);
        toastError(null, {
          title: "Failed to load orders",
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filter]
  );

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOrders();
    setIsRefreshing(false);
    toastSuccess({
      title: "Refreshed",
      description: "Orders list updated",
    });
  };

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoadingMore || !nextCursor) return;

      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

      if (distanceFromBottom < 100) {
        fetchOrders(nextCursor, true);
      }
    },
    [isLoadingMore, nextCursor, fetchOrders]
  );

  const handleFilterChange = (newFilter: FilterStatus) => {
    setFilter(newFilter);
    setExpandedOrderId(null);
  };

  const filterButtons: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "Unfilled", value: "unfilled" },
    { label: "Filled", value: "filled" },
    { label: "Settled", value: "settled" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Refunded", value: "refunded" },
    { label: "Failed", value: "failed" },
  ];

  return (
    <Box w="100%">
      <GridFlex width="100%" heightBlocks={13} contentPadding={0}>
        <Flex direction="column" w="100%" h="100%">
          {/* Header */}
          <Flex
            px="16px"
            pt="16px"
            pb="12px"
            align="center"
            justify="space-between"
            borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
            flexShrink={0}
            flexWrap="wrap"
            gap="12px"
          >
            <Flex align="center" gap="12px">
              <Text
                fontSize="16px"
                fontWeight="600"
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
              >
                Limit Orders
              </Text>
              <Text
                fontSize="13px"
                color={colorsAnalytics.textGray}
                fontFamily={FONT_FAMILIES.SF_PRO}
              >
                {orders.length} orders
              </Text>
            </Flex>

            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              bg="transparent"
              borderWidth="2px"
              borderRadius="12px"
              borderColor={colorsAnalytics.borderGray}
              color={colorsAnalytics.offWhite}
              fontFamily={FONT_FAMILIES.SF_PRO}
              fontSize="12px"
              px="12px"
              _hover={{ bg: "rgba(255, 255, 255, 0.05)" }}
            >
              <Flex align="center" gap="6px">
                <FiRefreshCw
                  size={14}
                  style={{
                    animation: isRefreshing ? "spin 1s linear infinite" : undefined,
                  }}
                />
                Refresh
              </Flex>
            </Button>
          </Flex>

          {/* Filter Buttons */}
          <Flex
            px="16px"
            py="12px"
            gap={isMobile ? "6px" : "8px"}
            borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
            flexShrink={0}
            overflowX="auto"
            css={{
              "&::-webkit-scrollbar": {
                display: "none",
              },
              scrollbarWidth: "none",
            }}
          >
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                size="sm"
                onClick={() => handleFilterChange(btn.value)}
                bg={filter === btn.value ? colorsAnalytics.greenBackground : "transparent"}
                borderWidth="2px"
                borderRadius="14px"
                borderColor={
                  filter === btn.value ? colorsAnalytics.greenOutline : colorsAnalytics.borderGray
                }
                color={colorsAnalytics.offWhite}
                fontFamily={FONT_FAMILIES.SF_PRO}
                fontSize={isMobile ? "10px" : "12px"}
                px={isMobile ? "10px" : "12px"}
                flexShrink={0}
                _hover={
                  filter === btn.value
                    ? {}
                    : {
                        opacity: 0.8,
                      }
                }
              >
                {btn.label}
              </Button>
            ))}
          </Flex>

          {/* Table Header */}
          {!isMobile && (
            <Flex
              px="16px"
              py="10px"
              fontSize="11px"
              fontWeight="bold"
              color={colorsAnalytics.textGray}
              borderBottom={`1px solid ${colorsAnalytics.borderGray}`}
              flexShrink={0}
              gap="16px"
              align="center"
            >
              <Box w="100px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Created</Text>
              </Box>
              <Box w="90px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Order ID</Text>
              </Box>
              <Box w="90px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Status</Text>
              </Box>
              <Box w="80px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Provider</Text>
              </Box>
              <Box w="140px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Sell</Text>
              </Box>
              <Box w="20px" />
              <Box w="140px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Buy</Text>
              </Box>
              <Box w="100px">
                <Text fontFamily={FONT_FAMILIES.SF_PRO}>Sender</Text>
              </Box>
              <Box flex="1" />
            </Flex>
          )}

          {/* Orders List */}
          <Box
            flex="1"
            overflowY="auto"
            onScroll={handleScroll}
            css={{
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#333",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "#444",
              },
            }}
            minHeight="0"
          >
            {isLoading ? (
              <Flex justify="center" align="center" py="40px">
                <Spinner size="md" color={colorsAnalytics.offWhite} />
              </Flex>
            ) : orders.length === 0 ? (
              <Flex justify="center" align="center" py="40px">
                <Text
                  fontSize="14px"
                  color={colorsAnalytics.textGray}
                  fontFamily={FONT_FAMILIES.SF_PRO}
                >
                  No {filter === "all" ? "" : filter} limit orders found
                </Text>
              </Flex>
            ) : (
              <Flex direction="column" w="100%">
                {orders.map((order) => (
                  <OrderRow
                    key={order.orderId}
                    order={order}
                    isMobile={isMobile}
                    isExpanded={expandedOrderId === order.orderId}
                    onToggle={() =>
                      setExpandedOrderId(
                        expandedOrderId === order.orderId ? null : order.orderId
                      )
                    }
                  />
                ))}
                {isLoadingMore && (
                  <Flex justify="center" py="12px">
                    <Spinner size="sm" color={colorsAnalytics.offWhite} />
                  </Flex>
                )}
                {!nextCursor && orders.length > 0 && (
                  <Flex justify="center" py="12px">
                    <Text
                      fontSize="14px"
                      color={colorsAnalytics.textGray}
                      fontFamily={FONT_FAMILIES.SF_PRO}
                    >
                      No more orders to load
                    </Text>
                  </Flex>
                )}
              </Flex>
            )}
          </Box>
        </Flex>
      </GridFlex>
    </Box>
  );
};
