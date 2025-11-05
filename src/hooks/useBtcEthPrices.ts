import { useEffect } from "react";
import { useStore } from "@/utils/store";

/**
 * Hook to fetch and store BTC and ETH prices
 *
 * This hook fetches prices on mount and stores them in the global store.
 * It's designed to be used at the page level to ensure prices are available
 * throughout the application.
 */
export function useBtcEthPrices() {
  const { setBtcPrice, setEthPrice, btcPrice, ethPrice } = useStore();

  useEffect(() => {
    const fetchETHandBTCPrice = async () => {
      try {
        const response = await fetch("/api/eth-and-btc-price");
        if (response.ok) {
          const data = await response.json();
          setEthPrice(data.ethPrice);
          setBtcPrice(data.btcPrice);
        }
      } catch (error) {
        console.error("Failed to fetch BTC/ETH prices:", error);
      }
    };

    fetchETHandBTCPrice();
  }, [setBtcPrice, setEthPrice]);

  return { btcPrice, ethPrice };
}
