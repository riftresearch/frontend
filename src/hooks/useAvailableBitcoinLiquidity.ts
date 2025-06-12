import { useQuery } from "@tanstack/react-query";
import esplora from "@interlay/esplora-btc-api";
import { useStore } from "../utils/store";

/**
 * Returns a map of market maker Bitcoin addresses to their balances (in satoshis),
 * and the largest balance among them, for the currently selected chain.
 */
export function useAvailableBitcoinLiquidity() {
  const selectedChainConfig = useStore((state) => state.selectedChainConfig);
  const esploraUrl = selectedChainConfig.esploraUrl;
  const marketMakers = selectedChainConfig.marketMakers;

  return useQuery({
    queryKey: [
      "marketMakerBitcoinBalances",
      selectedChainConfig.chainId,
      marketMakers.map((mm) => mm.bitcoinAddress).join(","),
    ],
    queryFn: async () => {
      if (!marketMakers.length) return { balances: {}, largestBalance: 0 };
      const addressApi = new esplora.AddressApi({
        basePath: esploraUrl,
        isJsonMime: (mime) => mime.startsWith("application/json"),
      });
      const balances: Record<string, number> = {};
      let largestBalance = 0;
      await Promise.all(
        marketMakers.map(async ({ bitcoinAddress }) => {
          try {
            const { data } = await addressApi.getAddress(bitcoinAddress);
            const balance =
              (data.chain_stats.funded_txo_sum ?? 0) +
              (data.mempool_stats.funded_txo_sum ?? 0) -
              ((data.chain_stats.spent_txo_sum ?? 0) +
                (data.mempool_stats.spent_txo_sum ?? 0));
            balances[bitcoinAddress] = balance;
            if (balance > largestBalance) largestBalance = balance;
          } catch (e) {
            balances[bitcoinAddress] = 0;
          }
        })
      );
      return { balances, largestBalance };
    },
    enabled: !!esploraUrl && marketMakers.length > 0,
    staleTime: 10_000, // 10 seconds
    refetchInterval: 10_000, // Refetch every 10 seconds
  });
}
