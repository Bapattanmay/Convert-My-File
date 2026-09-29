import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/session";

/** Clears legacy cookie; client should also call next-auth signOut. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
