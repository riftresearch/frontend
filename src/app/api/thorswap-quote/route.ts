import { NextRequest, NextResponse } from "next/server";

const THORSWAP_API_URL = "https://api.swapkit.dev/quote";
const THORSWAP_API_KEY = "3a86e7e1-54fd-4766-8cf5-d16ae00dde1b";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(THORSWAP_API_URL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-api-key": THORSWAP_API_KEY,
        "x-version": "3",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ThorSwap API error:", response.status, errorText);
      return NextResponse.json(
        { error: "ThorSwap API error", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch ThorSwap quote:", error);
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
  }
}
