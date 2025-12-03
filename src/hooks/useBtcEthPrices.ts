import { useEffect, useRef } from "react";
import { useStore } from "@/utils/store";
import { fetchBtcEthPrices } from "@/utils/defiLlamaClient";

const REFRESH_INTERVAL_MS = 60_000; // 1 minute

/**
 * Hook to fetch and store BTC and ETH prices from DefiLlama
 *
 * This hook fetches prices on mount and refreshes every minute.
 * It's designed to be used at the page level to ensure prices are available
 * throughout the application.
 */
export function useBtcEthPrices() {
  const { setBtcPrice, setEthPrice, btcPrice, ethPrice } = useStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      const { btcPrice, ethPrice } = await fetchBtcEthPrices();
      if (btcPrice) setBtcPrice(btcPrice);
      if (ethPrice) setEthPrice(ethPrice);
    };

    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setBtcPrice, setEthPrice]);

  return { btcPrice, ethPrice };
}
