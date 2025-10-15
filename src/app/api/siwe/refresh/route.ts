// app/api/auth/refresh/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken, mintAccessToken } from "@/app/lib/jwt";
import { setAuthCookies } from "@/app/lib/cookies";

export async function POST() {
  const refresh = (await cookies()).get("refresh_token")?.value;
  if (!refresh) return NextResponse.json({ error: "No refresh" }, { status: 401 });

  try {
    const payload = await verifyToken<any>(refresh);
    if (payload.typ !== "refresh") throw new Error("Not a refresh token");
    const access = await mintAccessToken(
      {
        sub: payload.sub,
        addr: payload.addr,
        role: payload.role,
      },
      15
    );
    await setAuthCookies(access, refresh); // keep same refresh for simplicity (you can rotate)
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid refresh" }, { status: 401 });
  }
}
