import { enrichLocationCity } from "@/lib/geo";
import { patchVisitorLocation } from "@/lib/usage-store";
import type { LocationInfo } from "@/lib/usage-store-types";

type Locatable = {
  id: string;
  location?: {
    source?: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    ip?: string;
  };
};

function asLocationInfo(
  loc?: Locatable["location"]
): LocationInfo {
  return {
    source:
      loc?.source === "browser_geolocation" ||
      loc?.source === "ip_approximate"
        ? loc.source
        : "unknown",
    city: loc?.city,
    region: loc?.region,
    country: loc?.country,
    latitude: loc?.latitude,
    longitude: loc?.longitude,
    ip: loc?.ip,
  };
}

/**
 * If a visitor has coords but no usable city, reverse-geocode and persist.
 */
export async function ensureVisitorCity(
  visitor: Locatable
): Promise<LocationInfo> {
  const loc = asLocationInfo(visitor.location);
  const enriched = await enrichLocationCity(loc);
  if (!enriched?.city) return loc;
  const next: LocationInfo = {
    ...loc,
    city: enriched.city,
    region: enriched.region || loc.region,
    country: enriched.country || loc.country,
  };
  await patchVisitorLocation(visitor.id, next);
  return next;
}

/** Enrich a list (bounded concurrency) for admin table rows. */
export async function ensureVisitorCities(
  visitors: Locatable[],
  opts?: { limit?: number }
): Promise<Map<string, LocationInfo>> {
  const limit = opts?.limit ?? 8;
  const out = new Map<string, LocationInfo>();
  const need = visitors.filter((v) => {
    const loc = v.location;
    const missing =
      !loc?.city ||
      /^city unknown$/i.test(loc.city) ||
      loc.city === "—" ||
      loc.city === "-";
    return (
      missing &&
      typeof loc?.latitude === "number" &&
      typeof loc?.longitude === "number"
    );
  });
  const batch = need.slice(0, limit);
  await Promise.all(
    batch.map(async (v) => {
      try {
        const loc = await ensureVisitorCity(v);
        out.set(v.id, loc);
      } catch {
        /* ignore */
      }
    })
  );
  return out;
}
