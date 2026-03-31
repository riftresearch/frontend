import { Flex, Text, Spinner } from "@chakra-ui/react";
import { useState, useCallback } from "react";
import { FONT_FAMILIES } from "@/utils/font";
import { colors } from "@/utils/colors";
import { useStore } from "@/utils/store";
import { toastSuccess, toastError } from "@/utils/toast";
import { BTC_ICON, ETH_ICON, FALLBACK_TOKEN_ICON } from "@/utils/constants";
import { getDynamicWalletClient } from "@/utils/wallet";
import { useSwitchNetwork, useUserWallets } from "@dynamic-labs/sdk-react-core";
import type { LimitOrderItem } from "@/hooks/useUserLimitOrders";

import BASE_ADDRESS_METADATA from "@/utils/tokenData/8453/address_to_metadata.json";
import ETHEREUM_ADDRESS_METADATA from "@/utils/tokenData/1/address_to_metadata.json";

function formatBaseUnitAmount(rawAmount: string, decimals: number): string {
  try {
    const raw = BigInt(rawAmount);
    const divisor = BigInt(10 ** decimals);
    const wholePart = raw / divisor;
    const remainder = raw % divisor;
    if (remainder === 0n) return wholePart.toString();
    const remainderStr = remainder.toString().padStart(decimals, "0");
    const trimmed = remainderStr.replace(/0+$/, "");

    // For values with a whole part > 0, show up to 4 decimals
    if (wholePart > 0n) {
      return `${wholePart}.${trimmed.slice(0, 4)}`;
    }

    // For small values (0.000...), show at least 2 significant digits
    const firstNonZero = trimmed.search(/[1-9]/);
    if (firstNonZero === -1) return `${wholePart}.${trimmed}`;
    const sigEnd = Math.min(firstNonZero + 2, trimmed.length);
    return `${wholePart}.${remainderStr.slice(0, firstNonZero + (sigEnd - firstNonZero))}`;
  } catch {
    const num = parseFloat(rawAmount);
    if (num === 0) return "0";
    // Use toPrecision for small numbers to get significant digits
    if (Math.abs(num) < 1) return parseFloat(num.toPrecision(2)).toString();
    return num.toFixed(4).replace(/\.?0+$/, "");
  }
}

function getCurrencyDisplay(currency: LimitOrderItem["sellCurrency"]): {
  ticker: string;
  icon: string;
  decimals: number;
} {
  if (!currency) return { ticker: "???", icon: FALLBACK_TOKEN_ICON, decimals: 18 };

  const { chain, token } = currency;

  if (chain.kind === "BITCOIN") {
    return { ticker: "BTC", icon: BTC_ICON, decimals: token.decimals };
  }

  if (chain.kind === "EVM" && token.kind === "NATIVE") {
    return {
      ticker: "ETH",
      icon: ETH_ICON,
      decimals: token.decimals,
    };
  }

  if (chain.kind === "EVM" && token.kind === "TOKEN") {
    const addr = token.address.toLowerCase();
    const meta =
      chain.chainId === 8453
        ? (BASE_ADDRESS_METADATA as any)[addr]
        : (ETHEREUM_ADDRESS_METADATA as any)[addr];

    return {
      ticker: meta?.ticker || `${addr.slice(0, 6)}...`,
      icon: meta?.icon || FALLBACK_TOKEN_ICON,
      decimals: token.decimals,
    };
  }

  return { ticker: "???", icon: FALLBACK_TOKEN_ICON, decimals: 18 };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getStatusConfig(status: LimitOrderItem["status"]) {
  switch (status) {
    case "unfilled":
      return { label: "Open", color: "#FFB347", bg: "rgba(255,179,71,0.15)" };
    case "filled":
      return { label: "Filled", color: colors.greenOutline, bg: "rgba(72,201,77,0.15)" };
    case "settled":
      return { label: "Settled", color: colors.greenOutline, bg: "rgba(72,201,77,0.15)" };
    case "cancelled":
      return { label: "Cancelled", color: colors.textGray, bg: "rgba(165,165,165,0.15)" };
    case "refunded":
      return { label: "Refunded", color: "#FFB347", bg: "rgba(255,179,71,0.15)" };
    case "failed":
      return { label: "Failed", color: colors.red, bg: "rgba(178,50,50,0.15)" };
    default:
      return { label: status, color: colors.textGray, bg: "rgba(165,165,165,0.15)" };
  }
}

interface LimitOrderRowProps {
  order: LimitOrderItem;
  onCancelled: () => void;
}

export const LimitOrderRow = ({ order, onCancelled }: LimitOrderRowProps) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const rift = useStore((s) => s.rift);
  const primaryEvmAddress = useStore((s) => s.primaryEvmAddress);
  const evmWalletClients = useStore((s) => s.evmWalletClients);
  const setEvmWalletClientForAddress = useStore((s) => s.setEvmWalletClientForAddress);
  const userWallets = useUserWallets();
  const switchNetwork = useSwitchNetwork();

  const sell = getCurrencyDisplay(order.sellCurrency);
  const buy = getCurrencyDisplay(order.buyCurrency);
  const statusConfig = getStatusConfig(order.status);

  const isNonZero = (v: string | null) => v != null && v !== "" && v !== "0";

  const sellAmount = isNonZero(order.quotedSellAmount)
    ? formatBaseUnitAmount(order.quotedSellAmount!, sell.decimals)
    : "—";
  const buyAmount = isNonZero(order.quotedBuyAmount)
    ? formatBaseUnitAmount(order.quotedBuyAmount!, buy.decimals)
    : "—";

  // For history, show executed amounts if available
  const displaySellAmount = isNonZero(order.executedSellAmount) && order.status !== "unfilled"
    ? formatBaseUnitAmount(order.executedSellAmount!, sell.decimals)
    : sellAmount;
  const displayBuyAmount = isNonZero(order.executedBuyAmount) && order.status !== "unfilled"
    ? formatBaseUnitAmount(order.executedBuyAmount!, buy.decimals)
    : buyAmount;

  const handleCancel = useCallback(async () => {
    if (!rift || !primaryEvmAddress || isCancelling) return;

    setIsCancelling(true);
    try {
      // Determine the chain for this order
      const rawChainId =
        order.sellCurrency?.chain.kind === "EVM"
          ? order.sellCurrency.chain.chainId
          : 1;
      const chainId = (rawChainId === 1 || rawChainId === 8453 ? rawChainId : 1) as 1 | 8453;

      // Switch wallet to the order's chain if needed
      const evmWallet = userWallets.find(
        (w) =>
          w.chain?.toUpperCase() === "EVM" &&
          w.address.toLowerCase() === primaryEvmAddress.toLowerCase()
      );

      if (evmWallet) {
        const currentNetwork = Number(await evmWallet.getNetwork());
        if (currentNetwork !== chainId) {
          await switchNetwork({ wallet: evmWallet, network: chainId });
        }
      }

      let walletClient = evmWalletClients[primaryEvmAddress.toLowerCase()]?.[chainId] || null;

      if (!walletClient && evmWallet) {
        walletClient = await getDynamicWalletClient(evmWallet, primaryEvmAddress, chainId);
        setEvmWalletClientForAddress(primaryEvmAddress, chainId, walletClient);
      }

      if (!walletClient) {
        toastError(null, {
          title: "Wallet not available",
          description: "Please reconnect your wallet to cancel this order.",
        });
        return;
      }

      const result = await rift.cancelOrder({
        orderId: order.orderId,
        walletClient,
      });

      if (result.accepted) {
        toastSuccess({
          title: "Order cancelled",
          description: `Order ${order.orderId.slice(0, 8)}... has been cancelled.`,
        });
        onCancelled();
      } else {
        toastError(null, {
          title: "Cancel failed",
          description: "The cancellation request was not accepted.",
        });
      }
    } catch (error) {
      console.error("[LimitOrderRow] Cancel error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const isUserRejection =
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("user denied");

      if (isUserRejection) {
        toastError(null, {
          title: "Cancelled",
          description: "You rejected the cancellation request.",
        });
      } else {
        toastError(error as Error, {
          title: "Cancel failed",
          description: "Failed to cancel order. Please try again.",
        });
      }
    } finally {
      setIsCancelling(false);
    }
  }, [rift, primaryEvmAddress, evmWalletClients, userWallets, order, isCancelling, onCancelled, setEvmWalletClientForAddress, switchNetwork]);

  return (
    <Flex
      w="100%"
      p="12px 14px"
      borderRadius="12px"
      bg="rgba(255,255,255,0.03)"
      border="1px solid"
      borderColor={colors.borderGray}
      direction="column"
      gap="8px"
      _hover={{ bg: "rgba(255,255,255,0.05)" }}
      transition="background 0.15s ease"
    >
      {/* Top row: sell → buy */}
      <Flex justify="space-between" align="center">
        <Flex align="center" gap="6px" flex={1} minW={0}>
          <img
            src={sell.icon}
            alt={sell.ticker}
            width={18}
            height={18}
            style={{ borderRadius: "50%", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_TOKEN_ICON; }}
          />
          <Text
            fontSize="13px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.offWhite}
            letterSpacing="-0.5px"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {displaySellAmount} {sell.ticker}
          </Text>

          <Text fontSize="11px" color={colors.darkerGray} mx="2px">
            →
          </Text>

          <img
            src={buy.icon}
            alt={buy.ticker}
            width={18}
            height={18}
            style={{ borderRadius: "50%", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_TOKEN_ICON; }}
          />
          <Text
            fontSize="13px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={colors.offWhite}
            letterSpacing="-0.5px"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {displayBuyAmount} {buy.ticker}
          </Text>
        </Flex>

        {/* Status badge */}
        <Flex
          px="8px"
          py="2px"
          borderRadius="6px"
          bg={statusConfig.bg}
          flexShrink={0}
          ml="8px"
        >
          <Text
            fontSize="11px"
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={statusConfig.color}
            fontWeight="bold"
            letterSpacing="-0.3px"
          >
            {statusConfig.label}
          </Text>
        </Flex>
      </Flex>

      {/* Bottom row: time + cancel */}
      <Flex justify="space-between" align="center">
        <Text
          fontSize="11px"
          fontFamily={FONT_FAMILIES.AUX_MONO}
          color={colors.darkerGray}
          letterSpacing="-0.3px"
        >
          {timeAgo(order.createdAt)}
        </Text>

        {order.status === "unfilled" && (
          <Flex
            as="button"
            px="10px"
            py="3px"
            borderRadius="6px"
            bg={isCancelling ? "rgba(178,50,50,0.1)" : "rgba(178,50,50,0.15)"}
            border="1px solid"
            borderColor={isCancelling ? "transparent" : "rgba(178,50,50,0.3)"}
            cursor={isCancelling ? "not-allowed" : "pointer"}
            onClick={handleCancel}
            _hover={!isCancelling ? { bg: "rgba(178,50,50,0.3)" } : undefined}
            transition="all 0.15s ease"
            align="center"
            gap="6px"
          >
            {isCancelling && <Spinner size="xs" color={colors.red} />}
            <Text
              fontSize="11px"
              fontFamily={FONT_FAMILIES.AUX_MONO}
              color={colors.red}
              fontWeight="bold"
              letterSpacing="-0.3px"
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
