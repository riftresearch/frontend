// app/lib/cookies.ts
import { cookies } from "next/headers";

export async function setAuthCookies(access: string, refresh: string) {
  const isProd = process.env.NODE_ENV === "production";
  const c = await cookies();
  c.set("access_token", access, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 15, // 15m
  });
  c.set("refresh_token", refresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7d
  });
}

export async function clearAuthCookies() {
  const isProd = process.env.NODE_ENV === "production";
  const c = await cookies();
  c.set("access_token", "", { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 0 });
  c.set("refresh_token", "", { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 0 });
}
