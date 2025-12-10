// src/app/api/token-balance/route.ts
import { NextRequest, NextResponse } from "next/server";

// Network configuration mapping chainId to RPC URL
const NETWORKS: Record<number, { rpcUrl: string; name: string; useQuickNode: boolean }> = {
  1: {
    rpcUrl: process.env.QUICKNODE_ETHEREUM_URL!,
    name: "ethereum",
    useQuickNode: true,
  },
  8453: {
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    name: "base",
    useQuickNode: false,
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

// QuickNode response token type
interface QuickNodeToken {
  address: string;
  totalBalance: string;
  decimals: number;
  name: string;
  symbol: string;
  chainId: number;
}

// Fetch token balances from QuickNode (for Ethereum mainnet)
async function fetchFromQuickNode(
  wallet: string,
  chainId: number,
  page: number
): Promise<{ result: QuickNodeToken[] } | null> {
  const network = NETWORKS[chainId];
  if (!network || !network.useQuickNode) {
    console.error(`QuickNode not configured for chainId ${chainId}`);
    return null;
  }

  const res = await fetch(network.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: 67,
      jsonrpc: "2.0",
      method: "qn_getWalletTokenBalance",
      params: [{ wallet, perPage: 100, page }],
    }),
  });

  const data = await res.json();

  // Add chainId to each token
  if (data.result?.result && Array.isArray(data.result.result)) {
    data.result.result = data.result.result.map((token: Omit<QuickNodeToken, "chainId">) => ({
      ...token,
      chainId,
    }));
  }

  return data.result;
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

// Fetch token balances from Alchemy (for non-Ethereum chains like Base)
async function fetchFromAlchemy(wallet: string, chainId: number): Promise<QuickNodeToken[]> {
  const network = NETWORKS[chainId];
  if (!network || network.useQuickNode) {
    console.error(`Alchemy not configured for chainId ${chainId}`);
    return [];
  }

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

    // Filter out zero balances and transform to QuickNode format
    const nonZeroBalances = data.result.tokenBalances.filter(
      (token) => token.tokenBalance !== "0x0" && token.tokenBalance !== "0x"
    );

    // Transform Alchemy response to match QuickNode format
    // Convert hex balance to decimal string
    return nonZeroBalances.map((token) => ({
      address: token.contractAddress,
      totalBalance: hexToDecimalString(token.tokenBalance),
      decimals: 0, // Default, will be enriched with actual metadata
      name: "", // Will be enriched
      symbol: "", // Will be enriched
      chainId,
    }));
  } catch (error) {
    console.error("Failed to fetch from Alchemy:", error);
    return [];
  }
}

// Fetch tokens for a single chain
async function fetchTokensForChain(
  wallet: string,
  chainId: number,
  page: number
): Promise<QuickNodeToken[]> {
  const network = NETWORKS[chainId];
  if (!network) {
    return [];
  }

  if (network.useQuickNode) {
    const result = await fetchFromQuickNode(wallet, chainId, page);
    return result?.result || [];
  } else {
    return fetchFromAlchemy(wallet, chainId);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") ?? undefined;
  const chainIdStr = searchParams.get("chainId");
  const pageStr = searchParams.get("page");
  const method = searchParams.get("method") ?? "qn_getWalletTokenBalance";

  if (!wallet) {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
  }

  const page = pageStr ? Number(pageStr) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "invalid_page" }, { status: 400 });
  }

  if (method !== "qn_getWalletTokenBalance") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 400 });
  }

  // If chainId not provided or is 0, fetch from all networks
  if (!chainIdStr || chainIdStr === "0") {
    const chainIds = Object.keys(NETWORKS).map(Number);
    const results = await Promise.all(
      chainIds.map((cid) => fetchTokensForChain(wallet, cid, page))
    );

    const mergedTokens = results.flat();
    console.log("data (merged)", { result: { result: mergedTokens } });
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

  const tokens = await fetchTokensForChain(wallet, chainId, page);
  console.log(`data (${network.name})`, { result: { result: tokens } });
  return NextResponse.json({ result: { result: tokens } });
}
