import { NextResponse } from "next/server";

/** @deprecated Use /api/admin/overview and /api/admin/visitors */
export async function GET() {
  return NextResponse.json(
    { error: "Moved. Use /api/admin/overview and /api/admin/visitors." },
    { status: 410 }
  );
}
