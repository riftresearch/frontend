// src/app/api/token-balance/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") ?? undefined;
  const chainIdStr = searchParams.get("chainId");
  const method = searchParams.get("method") ?? "qn_getWalletTokenBalance";

  if (!wallet) {
    return NextResponse.json({ error: "missing_wallet" }, { status: 400 });
  }

  const chainId = chainIdStr ? Number(chainIdStr) : NaN;
  if (!Number.isInteger(chainId)) {
    return NextResponse.json({ error: "invalid_chainId" }, { status: 400 });
  }

  if (method !== "qn_getWalletTokenBalance") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 400 });
  }

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

  const res = await fetch(quickNodeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: 67,
      jsonrpc: "2.0",
      method: "qn_getWalletTokenBalance",
      params: [{ wallet, perPage: 50 }],
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
