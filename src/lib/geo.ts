import type { LocationInfo } from "@/lib/usage-store";

export function clientIp(headers: Headers): string | undefined {
  const xf = headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim();
  return headers.get("x-real-ip") || undefined;
}

export type ReverseGeocodeResult = {
  city?: string;
  region?: string;
  country?: string;
};

/**
 * Reverse-geocode lat/lng → city/region/country (Nominatim).
 * Best-effort; returns {} on failure / rate limit.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "10");
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "ConvertMyFile/1.0 (admin analytics; contact=ops@convert-my-file.local)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state?: string;
        region?: string;
        country?: string;
      };
    };
    const a = data.address || {};
    return {
      city: a.city || a.town || a.village || a.municipality || a.county,
      region: a.state || a.region,
      country: a.country,
    };
  } catch {
    return {};
  }
}

/** Approximate location from IP using ipapi.co (no key, rate-limited). */
export async function lookupIpLocation(
  ip?: string
): Promise<Partial<LocationInfo>> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return {
      source: "ip_approximate",
      ip: ip || "local",
      city: "Local",
      region: "Development",
      country: "—",
      latitude: undefined,
      longitude: undefined,
    };
  }
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { source: "ip_approximate", ip };
    const data = (await res.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
    };
    if (data.error) return { source: "ip_approximate", ip };
    return {
      source: "ip_approximate",
      ip,
      city: data.city,
      region: data.region,
      country: data.country_name,
      latitude: data.latitude,
      longitude: data.longitude,
    };
  } catch {
    return { source: "ip_approximate", ip };
  }
}
