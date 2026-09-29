import { NextResponse } from "next/server";

/** Name-only login removed — Google OAuth is required. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Name-only login is disabled. Sign in with Google to use Convert My File.",
      googleRequired: true,
    },
    { status: 410 }
  );
}
