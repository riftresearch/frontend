import { formatUnits } from "viem";
import type { TokenData, TokenBalance, TokenPrice } from "./types";
import { Network } from "./types";
import ETHEREUM_ADDRESS_METADATA from "./tokenData/1/address_to_metadata.json";
import BASE_ADDRESS_METADATA from "./tokenData/8453/address_to_metadata.json";

const DEFILLAMA_BASE_URL = "https://coins.llama.fi/prices/current";

// Metadata type that matches the JSON files (icon can be null)
type TokenMetadataEntry = { name: string; ticker: string; decimals?: number; icon?: string | null };

// DefiLlama chain parameter type
type DefiLlamaChainParam = "ethereum" | "base" | "coingecko";

// Unified network configuration
interface NetworkConfig {
  defiLlamaChain: DefiLlamaChainParam | null;
  chainId: number;
  metadata: Record<string, TokenMetadataEntry>;
}

const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  [Network.ALL]: {
    defiLlamaChain: null,
    chainId: 0,
    metadata: {},
  },
  [Network.ETHEREUM]: {
    defiLlamaChain: "ethereum",
    chainId: 1,
    metadata: ETHEREUM_ADDRESS_METADATA as unknown as Record<string, TokenMetadataEntry>,
  },
  [Network.BASE]: {
    defiLlamaChain: "base",
    chainId: 8453,
    metadata: BASE_ADDRESS_METADATA as unknown as Record<string, TokenMetadataEntry>,
  },
};

// Derived reverse lookup: chainId -> Network
const CHAIN_ID_TO_NETWORK: Record<number, Network> = Object.entries(NETWORK_CONFIG).reduce(
  (acc, [network, config]) => {
    acc[config.chainId] = network as Network;
    return acc;
  },
  {} as Record<number, Network>
);

// Supported chains for fetching user tokens (excluding ALL)
const SUPPORTED_CHAINS = [Network.ETHEREUM, Network.BASE] as const;

export interface DefiLlamaTokenPrice {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
  decimals?: number;
}

export interface TokenPricesResponse {
  coins: Record<string, DefiLlamaTokenPrice>;
}

/**
 * Fetches token prices from DefiLlama
 *
 * @param chain - The chain to fetch prices for ('ethereum', 'base', or 'coingecko')
 * @param addresses - Array of token addresses (or coingecko ids for 'coingecko' chain)
 * @param searchWidth - Optional time window for price lookup (e.g. '4h')
 * @returns Token prices keyed by chain:address
 */
export async function fetchTokenPrices(
  chain: DefiLlamaChainParam,
  addresses: string[],
  searchWidth?: string
): Promise<TokenPricesResponse> {
  if (addresses.length === 0) {
    return { coins: {} };
  }

  const coins = addresses.map((a) => `${chain}:${a}`).join(",");
  const url = searchWidth
    ? `${DEFILLAMA_BASE_URL}/${coins}?searchWidth=${encodeURIComponent(searchWidth)}`
    : `${DEFILLAMA_BASE_URL}/${coins}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DefiLlama request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches a single token price from DefiLlama
 *
 * @param chain - The chain to fetch the price for
 * @param address - Token address (or coingecko id for 'coingecko' chain)
 * @returns The token price or null if not found
 */
export async function fetchTokenPrice(
  chain: DefiLlamaChainParam,
  address: string
): Promise<DefiLlamaTokenPrice | null> {
  const key = `${chain}:${address.toLowerCase()}`;
  const response = await fetchTokenPrices(chain, [address]);
  // DefiLlama returns lowercase addresses - try both cases
  return response.coins[key] ?? response.coins[`${chain}:${address}`] ?? null;
}

/**
 * Fetches BTC and ETH prices from DefiLlama (via CoinGecko IDs)
 */
export async function fetchBtcEthPrices(): Promise<{
  btcPrice: number | null;
  ethPrice: number | null;
}> {
  try {
    const response = await fetchTokenPrices("coingecko", ["bitcoin", "ethereum"]);
    return {
      btcPrice: response.coins["coingecko:bitcoin"]?.price ?? null,
      ethPrice: response.coins["coingecko:ethereum"]?.price ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch BTC/ETH prices:", error);
    return { btcPrice: null, ethPrice: null };
  }
}

// ============================================================================
// Multi-chain User Token Fetching Functions
// ============================================================================

/**
 * Fetches all ERC20 tokens for a wallet across all supported chains
 * @param walletAddress - The wallet address to fetch tokens for
 * @returns Mapping of Network -> TokenBalance[]
 */
export async function fetchWalletTokens(
  walletAddress: string
): Promise<Record<Network, TokenBalance[]>> {
  console.log("[Balance Check] Fetching token balances for address:", walletAddress);

  const result: Record<Network, TokenBalance[]> = {
    [Network.ALL]: [],
    [Network.ETHEREUM]: [],
    [Network.BASE]: [],
  };

  try {
    // Fetch all tokens across all chains (Alchemy returns all tokens in one call)
    const response = await fetch(`/api/token-balance?wallet=${walletAddress}`, {
      method: "GET",
    });
    const data = await response.json();

    if (!data.result?.result || !Array.isArray(data.result.result)) {
      console.log("[Balance Check] No tokens found");
      return result;
    }

    const allTokens = data.result.result as TokenBalance[];
    console.log("[Balance Check] Total tokens fetched:", allTokens.length);

    // Group tokens by chainId and enrich with metadata
    for (const token of allTokens) {
      const network = CHAIN_ID_TO_NETWORK[token.chainId];
      if (!network || network === Network.ALL) continue;

      const config = NETWORK_CONFIG[network];

      // Enrich tokens with empty names using local metadata
      let enrichedToken = token;
      if (token.name === "") {
        const addressLower = token.address.toLowerCase();
        const metadata = config.metadata[addressLower];
        if (metadata) {
          enrichedToken = {
            ...token,
            name: metadata.name || token.name,
            symbol: metadata.ticker || token.symbol,
            decimals: metadata.decimals ?? token.decimals,
          };
        }
      }

      result[network].push(enrichedToken);
    }

    return result;
  } catch (e) {
    console.error("Failed to fetch wallet tokens:", e);
    return result;
  }
}

/**
 * Fetches token prices for multiple chains from DefiLlama
 * @param addressesByChain - Mapping of Network -> addresses to fetch prices for
 * @returns Mapping of Network -> (address -> TokenPrice)
 */
export async function fetchAllTokenPrices(
  addressesByChain: Partial<Record<Network, string[]>>
): Promise<Record<Network, Record<string, TokenPrice & { decimals?: number }>>> {
  const result: Record<Network, Record<string, TokenPrice & { decimals?: number }>> = {
    [Network.ALL]: {},
    [Network.ETHEREUM]: {},
    [Network.BASE]: {},
  };

  const BATCH_SIZE = 30;

  // Process each chain
  const chainPromises = SUPPORTED_CHAINS.map(async (network) => {
    const addresses = addressesByChain[network];
    if (!addresses || addresses.length === 0) return;

    const config = NETWORK_CONFIG[network];
    if (!config.defiLlamaChain) return;

    // Batch addresses into chunks
    const batches: string[][] = [];
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      batches.push(addresses.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `[Price Check] Fetching prices for ${addresses.length} tokens on ${network} in ${batches.length} batches`
    );

    // Fetch all batches in parallel
    const batchResults = await Promise.all(
      batches.map(async (batch, index) => {
        try {
          const data = await fetchTokenPrices(config.defiLlamaChain!, batch);
          return data.coins || {};
        } catch (error) {
          console.error(`Failed to fetch prices for batch ${index + 1} on ${network}:`, error);
          return {};
        }
      })
    );

    // Merge batch results
    const prices: Record<string, TokenPrice & { decimals?: number }> = {};
    for (const batchData of batchResults) {
      for (const [key, coinData] of Object.entries<any>(batchData)) {
        const address = key.split(":")[1]?.toLowerCase();
        if (address) {
          prices[address] = coinData as TokenPrice & { decimals?: number };
        }
      }
    }

    result[network] = prices;
    console.log(
      `[Price Check] Successfully fetched ${Object.keys(prices).length} prices for ${network}`
    );
  });

  await Promise.all(chainPromises);
  return result;
}

/**
 * Fetches native ETH balance across all supported chains
 * @param walletAddress - The wallet address to fetch ETH balance for
 * @returns Mapping of Network -> TokenData (or null if no meaningful balance)
 */
export async function fetchUserEth(
  walletAddress: string
): Promise<Record<Network, TokenData | null>> {
  const ETH_ICON = "https://assets.smold.app/api/chains/1/logo-128.png";

  const result: Record<Network, TokenData | null> = {
    [Network.ALL]: null,
    [Network.ETHEREUM]: null,
    [Network.BASE]: null,
  };

  try {
    console.log("[Balance Check] Fetching ETH balance for address:", walletAddress);

    // Fetch ETH balances for all supported chains (no chainIds = fetch all)
    const response = await fetch(`/api/eth-balance?wallet=${walletAddress}`, { method: "GET" });
    const data = await response.json();

    if (data.error) {
      console.error("Failed to fetch ETH balance:", data.error);
      return result;
    }

    const ethPrice = data.price;

    // Process balances for each chain
    if (data.balances) {
      for (const [chainIdStr, balanceData] of Object.entries<any>(data.balances)) {
        const chainId = Number(chainIdStr);
        const network = CHAIN_ID_TO_NETWORK[chainId];
        if (!network || network === Network.ALL) continue;

        const balanceEth = Number(formatUnits(BigInt(balanceData.balance), 18));
        const usdValue = balanceEth * ethPrice;

        // Only include ETH if it has meaningful value (> $1)
        if (usdValue <= 1) continue;

        result[network] = {
          name: "Ethereum",
          ticker: "ETH",
          address: "0x0000000000000000000000000000000000000000",
          balance: balanceEth.toString(),
          usdValue: `$${usdValue.toFixed(2)}`,
          icon: ETH_ICON,
          decimals: 18,
          chainId,
        };
      }
    }

    return result;
  } catch (e) {
    console.error("Failed to fetch ETH balance:", e);
    return result;
  }
}

/**
 * Gets the DefiLlama chain name for a given Network
 */
export function getDefiLlamaChain(network: Network): DefiLlamaChainParam | null {
  return NETWORK_CONFIG[network].defiLlamaChain;
}

/**
 * Gets the numeric chain ID for a given Network
 */
export function getChainId(network: Network): number {
  return NETWORK_CONFIG[network].chainId;
}

/**
 * Gets the Network enum for a given numeric chain ID
 */
export function getNetwork(chainId: number): Network | undefined {
  return CHAIN_ID_TO_NETWORK[chainId];
}

/**
 * Gets the metadata mapping for a given Network
 */
export function getMetadata(network: Network): Record<string, TokenMetadataEntry> {
  return NETWORK_CONFIG[network].metadata;
}

/**
 * List of supported chain Network values (excluding ALL)
 */
export const SUPPORTED_CHAIN_NETWORKS = SUPPORTED_CHAINS;
