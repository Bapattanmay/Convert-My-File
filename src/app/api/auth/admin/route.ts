import { NextResponse } from "next/server";

/** Password admin login removed — use Google allowlist (ADMIN_EMAILS). */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Password admin login is disabled. Sign in with an allowlisted Google account and open /admin.",
    },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
