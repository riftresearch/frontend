// src/app/api/eth-balance/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet") ?? undefined;
    const chainIdStr = searchParams.get("chainId");

    if (!wallet) {
      return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
    }

    const chainId = chainIdStr ? Number(chainIdStr) : NaN;
    if (!Number.isInteger(chainId)) {
      return NextResponse.json({ error: "invalid_chainId" }, { status: 400 });
    }

    // Get QuickNode URL based on chain ID
    let quickNodeUrl: string;
    switch (chainId) {
      case 1:
        quickNodeUrl = process.env.QUICKNODE_ETHEREUM_URL!;
        break;
      case 8453:
        quickNodeUrl = process.env.QUICKNODE_BASE_URL!;
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported chain ID" },
          { status: 400 }
        );
    }

    // Fetch ETH balance using QuickNode RPC
    const balanceRes = await fetch(quickNodeUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 67,
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [wallet, "latest"],
      }),
    });

    if (!balanceRes.ok) {
      return NextResponse.json(
        { error: "failed_to_fetch_balance", status: balanceRes.status },
        { status: 502 }
      );
    }

    const balanceData = await balanceRes.json();
    
    if (balanceData.error) {
      return NextResponse.json(
        { error: "rpc_error", details: balanceData.error },
        { status: 502 }
      );
    }
    // Fetch ETH price using DeFiLlama
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
      return NextResponse.json(
        { error: "invalid_price_data" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      balance: balanceData.result,
      price: ethPrice,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", message: e?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
}
