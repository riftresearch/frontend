// app/api/siwe/verify/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SiweMessage } from "siwe";
import { mintAccessToken, mintRefreshToken, verifyToken } from "@/app/lib/jwt";
import { setAuthCookies } from "../../../lib/cookies";

export async function GET() {
  try {
    const access = (await cookies()).get("access_token")?.value;
    if (!access) return NextResponse.json({ authenticated: false });
    await verifyToken(access);
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function POST(req: Request) {
  try {
    const { message, signature } = await req.json();
    const nonceCookie = (await cookies()).get("siwe_nonce")?.value;
    if (!nonceCookie) return NextResponse.json({ error: "Missing nonce" }, { status: 400 });

    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature, nonce: nonceCookie });
    if (!fields.success) return NextResponse.json({ error: "Invalid SIWE" }, { status: 401 });

    const addr = siweMessage.address.toLowerCase();

    // TODO: look up/create user in DB; here we treat addr as user id
    const payload = { sub: addr, addr, role: "user" as const };

    const access = await mintAccessToken(payload, 15);
    const refresh = await mintRefreshToken(payload, 7);
    await setAuthCookies(access, refresh);

    // Invalidate the nonce so it can't be replayed (use same attributes)
    const isProd = process.env.NODE_ENV === "production";
    (await cookies()).set("siwe_nonce", "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ ok: true, address: addr });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "verify failed" }, { status: 400 });
  }
}
