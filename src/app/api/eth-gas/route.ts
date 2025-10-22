// src/app/api/eth-gas/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chainIdStr = searchParams.get("chainId");

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
        return NextResponse.json({ error: "Unsupported chain ID" }, { status: 400 });
    }

    // Fetch max priority fee per gas
    const priorityFeeRes = await fetch(quickNodeUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_maxPriorityFeePerGas",
        params: [],
      }),
    });

    if (!priorityFeeRes.ok) {
      return NextResponse.json(
        { error: "failed_to_fetch_priority_fee", status: priorityFeeRes.status },
        { status: 502 }
      );
    }

    const priorityFeeData = await priorityFeeRes.json();

    if (priorityFeeData.error) {
      return NextResponse.json(
        { error: "rpc_error", details: priorityFeeData.error },
        { status: 502 }
      );
    }

    // Fetch fee history to get base fee
    const feeHistoryRes = await fetch(quickNodeUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 2,
        jsonrpc: "2.0",
        method: "eth_feeHistory",
        params: ["0x1", "latest", []],
      }),
    });

    if (!feeHistoryRes.ok) {
      return NextResponse.json(
        { error: "failed_to_fetch_fee_history", status: feeHistoryRes.status },
        { status: 502 }
      );
    }

    const feeHistoryData = await feeHistoryRes.json();

    if (feeHistoryData.error) {
      return NextResponse.json(
        { error: "rpc_error", details: feeHistoryData.error },
        { status: 502 }
      );
    }

    // Extract base fee from fee history (latest block's base fee)
    const baseFeePerGas = feeHistoryData.result?.baseFeePerGas?.[0];
    const maxPriorityFeePerGas = priorityFeeData.result;

    if (!baseFeePerGas || !maxPriorityFeePerGas) {
      return NextResponse.json({ error: "invalid_gas_data" }, { status: 502 });
    }

    // Convert hex strings to BigInt for calculation
    const baseFee = BigInt(baseFeePerGas);
    const priorityFee = BigInt(maxPriorityFeePerGas * 1.5);

    // Calculate maxFeePerGas = baseFee + (maxPriorityFeePerGas * 1.5)
    const maxFeePerGas = baseFee + priorityFee;

    // Return as hex strings
    return NextResponse.json({
      maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "bad_request", message: e?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
}
