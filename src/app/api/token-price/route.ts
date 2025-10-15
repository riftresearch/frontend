// src/app/api/token-price/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_CHAINS = new Set(["ethereum", "base", "coingecko"]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = (searchParams.get("chain") || "").toLowerCase();
    if (!SUPPORTED_CHAINS.has(chain)) {
      return NextResponse.json(
        { error: "unsupported_chain", details: "Use 'ethereum' or 'base'" },
        { status: 400 }
      );
    }

    // addresses can be provided as a single comma-separated value or multiple 'addresses' params
    let addresses: string[] = searchParams.getAll("addresses");
    if (addresses.length === 1 && addresses[0].includes(",")) {
      addresses = addresses[0].split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "invalid_addresses", details: "Provide addresses as comma-separated or repeated query params" },
        { status: 400 }
      );
    }

    const searchWidth = searchParams.get("searchWidth") || undefined;

    const coins = addresses.map((a) => `${chain}:${a}`).join(",");
    const baseUrl = `https://coins.llama.fi/prices/current/${coins}`;
    const url = searchWidth ? `${baseUrl}?searchWidth=${encodeURIComponent(searchWidth)}` : baseUrl;

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "upstream_error", status: res.status, body: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", message: e?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
}
