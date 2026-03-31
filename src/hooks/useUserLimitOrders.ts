import { useState, useEffect, useRef, useCallback } from "react";
import type { RiftSdk } from "@riftresearch/sdk";

export interface LimitOrderItem {
  orderId: string;
  status: "unfilled" | "filled" | "cancelled" | "settled" | "refunded" | "failed";
  orderType: string | null;
  sellCurrency: {
    chain: { kind: "BITCOIN" } | { kind: "EVM"; chainId: number };
    token: { kind: "NATIVE"; decimals: number } | { kind: "TOKEN"; address: string; decimals: number };
  } | null;
  buyCurrency: {
    chain: { kind: "BITCOIN" } | { kind: "EVM"; chainId: number };
    token: { kind: "NATIVE"; decimals: number } | { kind: "TOKEN"; address: string; decimals: number };
  } | null;
  quotedSellAmount: string | null;
  quotedBuyAmount: string | null;
  executedSellAmount: string | null;
  executedBuyAmount: string | null;
  createdAt: string;
  updatedAt: string;
}

const POLL_INTERVAL = 12000;

function mapOrder(o: any): LimitOrderItem {
  return {
    orderId: o.orderId,
    status: o.status as LimitOrderItem["status"],
    orderType: o.orderType,
    sellCurrency: o.sellCurrency as LimitOrderItem["sellCurrency"],
    buyCurrency: o.buyCurrency as LimitOrderItem["buyCurrency"],
    quotedSellAmount: o.quotedSellAmount,
    quotedBuyAmount: o.quotedBuyAmount,
    executedSellAmount: o.executedSellAmount,
    executedBuyAmount: o.executedBuyAmount,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function useUserLimitOrders(
  address: string | null,
  rift: RiftSdk | null
) {
  const [openOrders, setOpenOrders] = useState<LimitOrderItem[]>([]);
  const [historyOrders, setHistoryOrders] = useState<LimitOrderItem[]>([]);
  const [hasMoreOpen, setHasMoreOpen] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fetchingRef = useRef(false);
  const fetchIdRef = useRef(0);

  const fetchOrders = useCallback(async () => {
    if (!address || !rift || fetchingRef.current) return;
    fetchingRef.current = true;
    const id = ++fetchIdRef.current;

    try {
      // Fetch by both sender and destination to catch all user orders
      const [openBySender, openByDest, allBySender, allByDest] = await Promise.all([
        rift.getOrders({ sender: address, orderType: "limit", status: "unfilled", limit: 50 }),
        rift.getOrders({ destination: address, orderType: "limit", status: "unfilled", limit: 50 }),
        rift.getOrders({ sender: address, orderType: "limit", limit: 50 }),
        rift.getOrders({ destination: address, orderType: "limit", limit: 50 }),
      ]);

      if (id !== fetchIdRef.current) return; // stale

      // Deduplicate by orderId
      const dedup = (results: typeof openBySender[]) => {
        const map = new Map<string, any>();
        for (const r of results) for (const item of r.items) map.set(item.orderId, item);
        return {
          items: Array.from(map.values()),
          hasMore: results.some((r) => r.nextCursor !== null),
        };
      };

      const openMerged = dedup([openBySender, openByDest]);
      const allMerged = dedup([allBySender, allByDest]);

      const sortDesc = (a: LimitOrderItem, b: LimitOrderItem) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      const open = openMerged.items.map(mapOrder).sort(sortDesc);
      const openIds = new Set(open.map((o) => o.orderId));
      const history = allMerged.items
        .filter((o) => !openIds.has(o.orderId))
        .map(mapOrder)
        .sort(sortDesc);

      setOpenOrders(open);
      setHistoryOrders(history);
      setHasMoreOpen(openMerged.hasMore);
      setHasMoreHistory(allMerged.hasMore);
    } catch (error) {
      console.error("[useUserLimitOrders] Error fetching orders:", error);
    } finally {
      fetchingRef.current = false;
    }
  }, [address, rift]);

  // Reset and fetch when address or rift changes
  useEffect(() => {
    setOpenOrders([]);
    setHistoryOrders([]);
    fetchingRef.current = false;
    fetchIdRef.current++;

    if (!address || !rift) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const currentAddress = address;
    const currentRift = rift;

    Promise.all([
      currentRift.getOrders({ sender: currentAddress, orderType: "limit", status: "unfilled", limit: 50 }),
      currentRift.getOrders({ destination: currentAddress, orderType: "limit", status: "unfilled", limit: 50 }),
      currentRift.getOrders({ sender: currentAddress, orderType: "limit", limit: 50 }),
      currentRift.getOrders({ destination: currentAddress, orderType: "limit", limit: 50 }),
    ])
      .then(([openBySender, openByDest, allBySender, allByDest]) => {
        if (cancelled) return;
        const dedup = (results: typeof openBySender[]) => {
          const map = new Map<string, any>();
          for (const r of results) for (const item of r.items) map.set(item.orderId, item);
          return {
            items: Array.from(map.values()),
            hasMore: results.some((r) => r.nextCursor !== null),
          };
        };
        const openMerged = dedup([openBySender, openByDest]);
        const allMerged = dedup([allBySender, allByDest]);
        const sortDesc = (a: LimitOrderItem, b: LimitOrderItem) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        const open = openMerged.items.map(mapOrder).sort(sortDesc);
        const openIds = new Set(open.map((o) => o.orderId));
        const history = allMerged.items
          .filter((o) => !openIds.has(o.orderId))
          .map(mapOrder)
          .sort(sortDesc);
        setOpenOrders(open);
        setHistoryOrders(history);
        setHasMoreOpen(openMerged.hasMore);
        setHasMoreHistory(allMerged.hasMore);
      })
      .catch((error) => {
        console.error("[useUserLimitOrders] Error:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, rift]);

  // Polling
  useEffect(() => {
    if (!address || !rift) return;
    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [address, rift, fetchOrders]);

  return { openOrders, historyOrders, hasMoreOpen, hasMoreHistory, isLoading, refetch: fetchOrders };
}
