import { useEffect } from "react";
import { useAnalyticsStore } from "@/utils/analyticsStore";

/**
 * Hook to fetch and update Bitcoin price from CoinGecko API
 */
export function useBtcPrice() {
  const setBtcPriceUsd = useAnalyticsStore((s) => s.setBtcPriceUsd);

  useEffect(() => {
    async function fetchBtcPrice() {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );

        if (!response.ok) {
          console.error("Failed to fetch BTC price:", response.status);
          return;
        }

        const data = await response.json();
        const price = data?.bitcoin?.usd;

        if (typeof price === "number" && price > 0) {
          console.log(`BTC Price updated: $${price.toLocaleString()}`);
          setBtcPriceUsd(price);
        }
      } catch (error) {
        console.error("Error fetching BTC price:", error);
      }
    }

    // Fetch immediately on mount
    fetchBtcPrice();

    // Update every 5 minutes
    const interval = setInterval(fetchBtcPrice, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [setBtcPriceUsd]);
}
