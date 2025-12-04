import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, Address, erc20Abi, parseUnits } from "viem";
import { mainnet } from "viem/chains";
import { PERMIT2_ABI, PERMIT2_ADDRESS, UNIVERSAL_ROUTER_ADDRESS } from "@/utils/constants";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get("userAddress");
    const tokenAddress = searchParams.get("tokenAddress");
    const rawInputAmount = searchParams.get("rawInputAmount");
    const decimals = searchParams.get("decimals");

    // Validate required parameters
    if (!userAddress || !tokenAddress) {
      return NextResponse.json(
        { error: "Missing required parameters: userAddress, tokenAddress" },
        { status: 400 }
      );
    }

    // Create viem public client using QuickNode RPC
    const rpcUrl = process.env.QUICKNODE_ETHEREUM_URL;
    if (!rpcUrl) {
      console.error("QUICKNODE_ETHEREUM_URL is not configured");
      return NextResponse.json({ error: "RPC URL not configured" }, { status: 500 });
    }

    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    // Read allowance from Permit2 contract
    const result = await publicClient.readContract({
      address: PERMIT2_ADDRESS as Address,
      abi: PERMIT2_ABI,
      functionName: "allowance",
      args: [userAddress as Address, tokenAddress as Address, UNIVERSAL_ROUTER_ADDRESS as Address],
    });

    // Check if token has allowance to Permit2
    let permit2HasAllowance = false;
    if (rawInputAmount && decimals) {
      try {
        const tokenAllowance = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [userAddress as Address, PERMIT2_ADDRESS as Address],
        });

        const requiredAmount = parseUnits(rawInputAmount, parseInt(decimals));
        console.log("Required amount:", requiredAmount);
        console.log("Token allowance:", tokenAllowance);
        permit2HasAllowance = tokenAllowance >= requiredAmount;
      } catch (error) {
        console.error("Error checking token allowance to Permit2:", error);
        // Default to false - user needs approval if we can't check
        permit2HasAllowance = false;
      }
    }

    // Return allowance details (amount, expiration, nonce) + permit2HasAllowance
    return NextResponse.json({
      amount: result[0].toString(), // uint160
      expiration: result[1].toString(), // uint48
      nonce: result[2].toString(), // uint48
      permit2HasAllowance,
    });
  } catch (error) {
    console.error("Error fetching permit allowance:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch permit allowance",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
