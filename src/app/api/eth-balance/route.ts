// src/app/api/eth-balance/route.ts
import { NextRequest, NextResponse } from "next/server";

// Network configuration mapping chainId to RPC URL
const NETWORKS: Record<number, { rpcUrl: string; name: string }> = {
  1: {
    rpcUrl: process.env.QUICKNODE_ETHEREUM_URL!,
    name: "ethereum",
  },
  8453: {
    rpcUrl: process.env.QUICKNODE_BASE_URL!,
    name: "base",
  },
};

interface ChainBalance {
  balance: string;
  price: number;
}

// Fetch ETH balance for a single chain
async function fetchEthBalanceForChain(
  wallet: string,
  chainId: number
): Promise<{ chainId: number; balance: string } | null> {
  const network = NETWORKS[chainId];
  if (!network) {
    console.error(`Network not configured for chainId ${chainId}`);
    return null;
  }

  try {
    const res = await fetch(network.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 67,
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [wallet, "latest"],
      }),
    });

    if (!res.ok) {
      console.error(`Failed to fetch balance for chain ${chainId}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.error) {
      console.error(`RPC error for chain ${chainId}:`, data.error);
      return null;
    }

    return { chainId, balance: data.result };
  } catch (error) {
    console.error(`Error fetching balance for chain ${chainId}:`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet") ?? undefined;
    const chainIdsStr = searchParams.get("chainIds"); // optional comma-separated list like "1,8453"

    if (!wallet) {
      return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
    }

    // Fetch ETH price once (shared across all chains)
    const priceUrl = "https://coins.llama.fi/prices/current/coingecko:ethereum";
    const priceRes = await fetch(priceUrl, { method: "GET" });

    if (!priceRes.ok) {
      return NextResponse.json(
        { error: "failed_to_fetch_price", status: priceRes.status },
        { status: 502 }
      );
    }

    const priceData = await priceRes.json();
    const ethPrice = priceData.coins?.["coingecko:ethereum"]?.price;

    if (typeof ethPrice !== "number") {
      return NextResponse.json({ error: "invalid_price_data" }, { status: 502 });
    }

    // Parse chainIds - if not provided, fetch all networks
    let chainIds: number[];
    if (chainIdsStr) {
      chainIds = chainIdsStr
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && NETWORKS[id]);

      if (chainIds.length === 0) {
        return NextResponse.json({ error: "no_valid_chainIds" }, { status: 400 });
      }
    } else {
      // Default to all networks
      chainIds = Object.keys(NETWORKS).map(Number);
    }

    // Fetch balances for all chains in parallel
    const balanceResults = await Promise.all(
      chainIds.map((chainId) => fetchEthBalanceForChain(wallet, chainId))
    );

    // Build response mapping chainId -> { balance, price }
    const balances: Record<number, ChainBalance> = {};
    for (const result of balanceResults) {
      if (result) {
        balances[result.chainId] = {
          balance: result.balance,
          price: ethPrice,
        };
      }
    }

    return NextResponse.json({ balances, price: ethPrice });
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", message: e?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
}
