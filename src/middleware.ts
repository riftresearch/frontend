// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const issuer = process.env.JWT_ISSUER!;
const audience = process.env.JWT_AUDIENCE!;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  //   if (!pathname.startsWith("/api/private/")) return NextResponse.next();

  const access =
    req.cookies.get("access_token")?.value ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await jwtVerify(access, secret, { issuer, audience });
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/token-balance", "/api/eth-balance", "/api/token-metadata"],
};
