import { NextResponse } from "next/server";
import { createSession } from "@/lib/usage-store";
import { clientIp, lookupIpLocation } from "@/lib/geo";
import { signUserToken, USER_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    latitude?: number;
    longitude?: number;
    geoGranted?: boolean;
  } | null;

  const name = body?.name?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Please enter your name (at least 2 characters)." },
      { status: 400 }
    );
  }

  const ip = clientIp(req.headers);
  const ipLoc = await lookupIpLocation(ip);

  const location =
    body?.geoGranted &&
    typeof body.latitude === "number" &&
    typeof body.longitude === "number"
      ? {
          source: "browser_geolocation" as const,
          latitude: body.latitude,
          longitude: body.longitude,
          city: ipLoc.city,
          region: ipLoc.region,
          country: ipLoc.country,
          ip: ipLoc.ip || ip,
        }
      : {
          source: (ipLoc.source || "ip_approximate") as
            | "ip_approximate"
            | "unknown",
          latitude: ipLoc.latitude,
          longitude: ipLoc.longitude,
          city: ipLoc.city,
          region: ipLoc.region,
          country: ipLoc.country,
          ip: ipLoc.ip || ip,
        };

  const session = createSession({
    name,
    location,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  const token = await signUserToken({
    sid: session.id,
    name: session.name,
    role: "user",
  });

  const res = NextResponse.json({
    ok: true,
    session: {
      id: session.id,
      name: session.name,
      location: session.location,
    },
  });
  res.cookies.set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
