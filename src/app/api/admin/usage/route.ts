import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/session";
import { listSessions, storageNote } from "@/lib/usage-store";

export async function GET() {
  const admin = await readAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  const sessions = listSessions().map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    timeSpentSeconds: s.timeSpentSeconds,
    featuresUsed: s.featuresUsed,
    location: s.location,
    userAgent: s.userAgent,
  }));

  return NextResponse.json({
    sessions,
    storageNote: storageNote(),
    totals: {
      users: sessions.length,
      totalSeconds: sessions.reduce((n, s) => n + s.timeSpentSeconds, 0),
    },
  });
}
