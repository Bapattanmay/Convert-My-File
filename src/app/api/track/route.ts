import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/session";
import { touchSession } from "@/lib/usage-store";

export async function POST(req: Request) {
  const token = await readUserSession();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    feature?: string;
    seconds?: number;
    latitude?: number;
    longitude?: number;
  } | null;

  const updated = touchSession(token.sid, {
    feature: body?.feature,
    addSeconds:
      typeof body?.seconds === "number" && body.seconds > 0
        ? body.seconds
        : undefined,
    location:
      typeof body?.latitude === "number" && typeof body?.longitude === "number"
        ? {
            source: "browser_geolocation",
            latitude: body.latitude,
            longitude: body.longitude,
          }
        : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    timeSpentSeconds: updated.timeSpentSeconds,
    featuresUsed: updated.featuresUsed,
  });
}
