import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/session";
import { touchSession } from "@/lib/usage-store";
import { clientIp, lookupIpLocation } from "@/lib/geo";
import { truncateIp } from "@/lib/admin-metrics";

export async function POST(req: Request) {
  const token = await readUserSession();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    feature?: string;
    seconds?: number;
    syncIpLocation?: boolean;
    // Legacy browser coords ignored — we only use approximate IP location.
    latitude?: number;
    longitude?: number;
  } | null;

  let locationPatch:
    | {
        source: "ip_approximate";
        latitude?: number;
        longitude?: number;
        city?: string;
        region?: string;
        country?: string;
        ip?: string;
      }
    | undefined;

  if (body?.syncIpLocation) {
    const ip = clientIp(req.headers);
    const ipLoc = await lookupIpLocation(ip);
    locationPatch = {
      source: "ip_approximate",
      city: ipLoc.city,
      region: ipLoc.region,
      country: ipLoc.country,
      latitude: ipLoc.latitude,
      longitude: ipLoc.longitude,
      ip: truncateIp(ipLoc.ip || ip),
    };
  }

  const updated = await touchSession(token.sid, {
    feature: body?.feature,
    addSeconds:
      typeof body?.seconds === "number" && body.seconds > 0
        ? body.seconds
        : undefined,
    location: locationPatch,
  });

  if (!updated) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    timeSpentSeconds: updated.timeSpentSeconds,
    featuresUsed: updated.featuresUsed,
    location: updated.location,
  });
}
