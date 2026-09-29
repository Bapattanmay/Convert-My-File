import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  isPremiumEmail,
  PREMIUM_COOKIE,
  type PremiumStatus,
} from "@/lib/premium-access";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim() || "";
  if (!email) {
    const status: PremiumStatus = { isPremium: false, source: "none" };
    return NextResponse.json(status);
  }

  if (isPremiumEmail(email)) {
    const status: PremiumStatus = {
      isPremium: true,
      source: "allowlist",
      email,
    };
    return NextResponse.json(status);
  }

  const jar = await cookies();
  const cookie = jar.get(PREMIUM_COOKIE)?.value || "";
  if (cookie.toLowerCase() === email.toLowerCase()) {
    const status: PremiumStatus = {
      isPremium: true,
      source: "upgrade",
      email,
    };
    return NextResponse.json(status);
  }

  const status: PremiumStatus = { isPremium: false, source: "none", email };
  return NextResponse.json(status);
}

/** Mock checkout — unlocks Premium for the signed-in Google email (no payment). */
export async function POST() {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const res = NextResponse.json({
    isPremium: true,
    source: isPremiumEmail(email) ? "allowlist" : "upgrade",
    email,
    note: "Mock Upgrade — no payment processed. Premium unlocked for this browser session.",
  } satisfies PremiumStatus & { note: string });

  res.cookies.set(PREMIUM_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
