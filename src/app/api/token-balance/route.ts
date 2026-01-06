// src/app/api/token-balance/route.ts
import { NextRequest, NextResponse } from "next/server";

// Network configuration mapping chainId to Alchemy RPC URL
const NETWORKS: Record<number, { rpcUrl: string; name: string }> = {
  1: {
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    name: "ethereum",
  },
  8453: {
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    name: "base",
  },
};

// Alchemy response types
interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

interface AlchemyResponse {
  jsonrpc: string;
  id: number;
  result: {
    address: string;
    tokenBalances: AlchemyTokenBalance[];
  };
}

// Normalized token type returned by this endpoint
interface TokenBalance {
  address: string;
  totalBalance: string;
  decimals: number;
  name: string;
  symbol: string;
  chainId: number;
}

// Convert hex string to decimal string
function hexToDecimalString(hex: string): string {
  if (!hex || hex === "0x" || hex === "0x0") {
    return "0";
  }
  try {
    return BigInt(hex).toString();
  } catch {
    return "0";
  }
}

// Fetch token balances from Alchemy
async function fetchTokenBalances(wallet: string, chainId: number): Promise<TokenBalance[]> {
  const network = NETWORKS[chainId];
  if (!network) {
    console.error(`Network not configured for chainId ${chainId}`);
    return [];
  }

  console.log("SAMEEEE fetching token balances for chainId", chainId, "network", network);

  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.error("ALCHEMY_API_KEY not configured");
    return [];
  }

  try {
    const res = await fetch(network.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [wallet, "erc20"],
      }),
    });

    const data: AlchemyResponse = await res.json();

    if (!data.result?.tokenBalances) {
      return [];
    }

    // Filter out zero balances and transform to normalized format
    const nonZeroBalances = data.result.tokenBalances.filter(
      (token) => token.tokenBalance !== "0x0" && token.tokenBalance !== "0x"
    );

    return nonZeroBalances.map((token) => ({
      address: token.contractAddress,
      totalBalance: hexToDecimalString(token.tokenBalance),
      decimals: 0, // Will be enriched with metadata on client
      name: "", // Will be enriched with metadata on client
      symbol: "", // Will be enriched with metadata on client
      chainId,
    }));
  } catch (error) {
    console.error(`Failed to fetch token balances for chain ${chainId}:`, error);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") ?? undefined;
  const chainIdStr = searchParams.get("chainId");

  if (!wallet) {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
  }

  // If chainId not provided or is 0, fetch from all networks
  if (!chainIdStr || chainIdStr === "0") {
    const chainIds = Object.keys(NETWORKS).map(Number);
    const results = await Promise.all(
      chainIds.map((chainId) => fetchTokenBalances(wallet, chainId))
    );

    const mergedTokens = results.flat();
    console.log("[token-balance] Fetched", mergedTokens.length, "tokens across all chains");
    return NextResponse.json({ result: { result: mergedTokens } });
  }

  // Handle specific chain
  const chainId = Number(chainIdStr);
  if (!Number.isInteger(chainId)) {
    return NextResponse.json({ error: "invalid_chainId" }, { status: 400 });
  }

  const network = NETWORKS[chainId];
  if (!network) {
    return NextResponse.json({ error: "Unsupported chain ID" }, { status: 400 });
  }

  const tokens = await fetchTokenBalances(wallet, chainId);
  console.log(`[token-balance] Fetched ${tokens.length} tokens for ${network.name}`);
  return NextResponse.json({ result: { result: tokens } });
}
