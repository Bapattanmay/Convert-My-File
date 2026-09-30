import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/session";
import { touchSession } from "@/lib/usage-store";
import { clientIp, lookupIpLocation, reverseGeocode } from "@/lib/geo";
import { truncateIp } from "@/lib/admin-metrics";

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
    syncIpLocation?: boolean;
  } | null;

  let locationPatch:
    | {
        source: "browser_geolocation" | "ip_approximate";
        latitude?: number;
        longitude?: number;
        city?: string;
        region?: string;
        country?: string;
        ip?: string;
      }
    | undefined;

  if (
    typeof body?.latitude === "number" &&
    typeof body?.longitude === "number"
  ) {
    const ip = clientIp(req.headers);
    const [geo, ipLoc] = await Promise.all([
      reverseGeocode(body.latitude, body.longitude),
      lookupIpLocation(ip),
    ]);
    // Prefer reverse-geocoded city from browser coordinates (never leave
    // lat/lng without a city when the geocoder returned one).
    locationPatch = {
      source: "browser_geolocation",
      latitude: body.latitude,
      longitude: body.longitude,
      city: geo.city || ipLoc.city,
      region: geo.region || ipLoc.region,
      country: geo.country || ipLoc.country,
      ip: truncateIp(ipLoc.ip || ip),
    };
  } else if (body?.syncIpLocation) {
    const ip = clientIp(req.headers);
    const ipLoc = await lookupIpLocation(ip);
    locationPatch = {
      source: (ipLoc.source || "ip_approximate") as "ip_approximate",
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
