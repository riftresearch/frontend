// src/app/api/token-metadata/route.ts
import { NextRequest, NextResponse } from "next/server";

// Type definitions for the API response
interface CoinGeckoTokenAttributes {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  image_url: string | null;
  price_usd: string;
}

interface CoinGeckoTokenData {
  id: string;
  type: string;
  attributes: CoinGeckoTokenAttributes;
}

interface CoinGeckoResponse {
  data: CoinGeckoTokenData[];
}

// Response format for our API
interface TokenMetadata {
  name: string;
  ticker: string;
  icon: string | null;
  price: number;
  decimals: number;
}

const SUPPORTED_NETWORKS = {
  ethereum: "eth",
  base: "base",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Get network parameter
    const network = (searchParams.get("network") || "").toLowerCase();
    const networkId = SUPPORTED_NETWORKS[network as keyof typeof SUPPORTED_NETWORKS];

    // Get addresses parameter - can be comma-separated or multiple params
    const addresses: string[] = searchParams.getAll("addresses");
    const addressesParam = addresses.length > 1 ? addresses.join(",") : addresses[0];
    const url = `https://pro-api.coingecko.com/api/v3/onchain/networks/${networkId}/tokens/multi/${addressesParam}`;

    // Check for API key
    const apiKey = process.env.GECKO_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "missing_api_key", details: "CoinGecko Pro API key not configured" },
        { status: 500 }
      );
    }

    // Make request to CoinGecko API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-cg-pro-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const data: CoinGeckoResponse = await response.json();
    console.log("fetched metadata from API", data);
    // Transform the response to our required format
    const tokenMetadata: TokenMetadata[] = data.data.map((token) => ({
      name: token.attributes.name,
      ticker: token.attributes.symbol,
      icon: token.attributes.image_url,
      price: parseFloat(token.attributes.price_usd) || 0,
      decimals: token.attributes.decimals,
    }));

    return NextResponse.json({
      data: tokenMetadata,
      count: tokenMetadata.length,
    });
  } catch (error: any) {
    console.error("Token metadata API error:", error);
    return NextResponse.json(
      {
        error: "internal_server_error",
        message: error?.message ?? "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
