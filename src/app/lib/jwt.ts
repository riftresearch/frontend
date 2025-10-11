// app/lib/jwt.ts
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const issuer = process.env.JWT_ISSUER!;
const audience = process.env.JWT_AUDIENCE!;

export type JwtPayload = {
  sub: string;         // userId or wallet address
  addr: string;        // wallet address (lowercase)
  role?: "user" | "admin";
};

export async function mintAccessToken(payload: JwtPayload, minutes = 15) {
  const exp = Math.floor(Date.now() / 1000) + minutes * 60;
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(payload.sub)
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(secret);
}

export async function mintRefreshToken(payload: JwtPayload, days = 7) {
  const exp = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  return await new SignJWT({ ...payload, typ: "refresh" } as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(payload.sub)
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken<T = any>(token: string) {
  const { payload } = await jwtVerify(token, secret, { issuer, audience });
  return payload as T;
}
