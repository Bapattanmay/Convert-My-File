import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/session";
import { getSession } from "@/lib/usage-store";
import { isGoogleConfigured } from "@/auth";

export async function GET() {
  const token = await readUserSession();
  if (!token) {
    return NextResponse.json({
      user: null,
      googleConfigured: isGoogleConfigured(),
    });
  }
  const session = getSession(token.sid);
  if (!session) {
    return NextResponse.json({
      user: null,
      googleConfigured: isGoogleConfigured(),
    });
  }
  return NextResponse.json({
    googleConfigured: isGoogleConfigured(),
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      picture: session.picture,
      timeSpentSeconds: session.timeSpentSeconds,
      featuresUsed: session.featuresUsed,
      location: session.location,
    },
  });
}
