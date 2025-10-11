// app/api/siwe/nonce/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateNonce } from "siwe";

export async function GET() {
  // EIP-4361 requires nonce to be at least 8 chars, [a-zA-Z0-9] only
  const nonce = generateNonce();
  const isProd = process.env.NODE_ENV === "production";
  (await cookies()).set("siwe_nonce", nonce, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 5,
  });
  return NextResponse.json({ nonce });
}
