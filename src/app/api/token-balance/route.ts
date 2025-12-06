// src/app/api/token-balance/route.ts
import { NextRequest, NextResponse } from "next/server";

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

// Fetch token balances from QuickNode (for Ethereum only)
async function fetchFromQuickNode(
  wallet: string,
  page: number
): Promise<{ result: QuickNodeToken[] } | null> {
  const quickNodeUrl = process.env.QUICKNODE_ETHEREUM_URL!;

  const res = await fetch(quickNodeUrl, {
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
      chainId: 1, // Ethereum
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

// Fetch token balances from Alchemy (for Base)
async function fetchFromAlchemy(wallet: string): Promise<QuickNodeToken[]> {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    console.error("ALCHEMY_API_KEY not configured");
    return [];
  }

  const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

  try {
    const res = await fetch(alchemyUrl, {
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
      chainId: 8453, // Base
    }));
  } catch (error) {
    console.error("Failed to fetch from Alchemy:", error);
    return [];
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

  const chainId = chainIdStr ? Number(chainIdStr) : NaN;
  if (!Number.isInteger(chainId)) {
    return NextResponse.json({ error: "invalid_chainId" }, { status: 400 });
  }

  const page = pageStr ? Number(pageStr) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "invalid_page" }, { status: 400 });
  }

  if (method !== "qn_getWalletTokenBalance") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 400 });
  }

  // Handle different chain scenarios
  switch (chainId) {
    case 0: {
      // ALL: Fetch from both QuickNode (Ethereum) and Alchemy (Base)
      const [ethereumResult, baseResult] = await Promise.all([
        fetchFromQuickNode(wallet, page),
        fetchFromAlchemy(wallet),
      ]);

      const ethereumTokens = ethereumResult?.result || [];
      const mergedTokens = [...ethereumTokens, ...baseResult];

      console.log("data (merged)", { result: { result: mergedTokens } });
      return NextResponse.json({ result: { result: mergedTokens } });
    }

    case 1: {
      // Ethereum: QuickNode only
      const result = await fetchFromQuickNode(wallet, page);
      const data = { result };
      console.log("data", data);
      return NextResponse.json(data);
    }

    case 8453: {
      // Base: Alchemy only
      const tokens = await fetchFromAlchemy(wallet);
      console.log("data (alchemy)", { result: { result: tokens } });
      return NextResponse.json({ result: { result: tokens } });
    }

    default:
      return NextResponse.json({ error: "Unsupported chain ID" }, { status: 400 });
  }
}
