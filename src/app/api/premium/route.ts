import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPremiumEmail, type PremiumStatus } from "@/lib/premium-access";

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

  const status: PremiumStatus = { isPremium: false, source: "none", email };
  return NextResponse.json(status);
}

/**
 * Paid Premium checkout is not live.
 * Do not set entitlement cookies or claim a commercial paid unlock.
 * India next step: Razorpay or Cashfree + webhook → server entitlement row.
 */
export async function POST() {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  if (isPremiumEmail(email)) {
    const status: PremiumStatus = {
      isPremium: true,
      source: "allowlist",
      email,
    };
    return NextResponse.json(status);
  }

  return NextResponse.json(
    {
      isPremium: false,
      source: "none",
      email,
      payments: "coming_soon",
      paymentProvidersIndia: ["Razorpay", "Cashfree"],
      error:
        "Paid Premium checkout is coming soon. We do not unlock Premium without payment. For India, the next integration path is Razorpay or Cashfree with a server-side entitlement after webhook confirmation.",
    } satisfies PremiumStatus & { error: string },
    { status: 402 }
  );
}
