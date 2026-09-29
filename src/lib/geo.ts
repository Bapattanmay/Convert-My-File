import type { LocationInfo } from "@/lib/usage-store";

export function clientIp(headers: Headers): string | undefined {
  const xf = headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim();
  return headers.get("x-real-ip") || undefined;
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
