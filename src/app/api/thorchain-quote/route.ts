import { NextRequest, NextResponse } from "next/server";

const THORCHAIN_API_URL = "https://swap-api.unstoppable.money/v1/quote";
const THORCHAIN_API_KEY = "79a24bddb8b1768dbb2662e136aca9006baa6d4e3e6d761219b2ab4279a42bb4";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(THORCHAIN_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        "x-api-key": THORCHAIN_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Thorchain API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Thorchain API error", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch Thorchain quote:", error);
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
  }
}
