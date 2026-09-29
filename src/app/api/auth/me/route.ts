import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/session";
import { getSession } from "@/lib/usage-store";

export async function GET() {
  const token = await readUserSession();
  if (!token) return NextResponse.json({ user: null });
  const session = getSession(token.sid);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: session.id,
      name: session.name,
      timeSpentSeconds: session.timeSpentSeconds,
      featuresUsed: session.featuresUsed,
      location: session.location,
    },
  });
}
