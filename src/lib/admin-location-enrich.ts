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

function asLocationInfo(loc?: Locatable["location"]): LocationInfo {
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

function needsEnrichment(loc?: Locatable["location"]): boolean {
  if (!loc) return false;
  const cityMissing =
    !loc.city ||
    /^city unknown$/i.test(loc.city) ||
    loc.city === "—" ||
    loc.city === "-";
  const coordsMissing =
    typeof loc.latitude !== "number" ||
    typeof loc.longitude !== "number" ||
    !Number.isFinite(loc.latitude) ||
    !Number.isFinite(loc.longitude);
  // Enrich when we have a signal (IP or coords) but display fields are incomplete.
  if (cityMissing || coordsMissing) {
    return Boolean(loc.ip) || !coordsMissing;
  }
  return false;
}

/**
 * Ensure visitor has city + lat/lng when IP and/or coords can resolve them.
 */
export async function ensureVisitorCity(
  visitor: Locatable
): Promise<LocationInfo> {
  const loc = asLocationInfo(visitor.location);
  const enriched = await enrichLocationCity(loc);
  if (!enriched) return loc;
  const next: LocationInfo = {
    ...loc,
    city: enriched.city || loc.city,
    region: enriched.region || loc.region,
    country: enriched.country || loc.country,
    latitude:
      typeof enriched.latitude === "number" ? enriched.latitude : loc.latitude,
    longitude:
      typeof enriched.longitude === "number"
        ? enriched.longitude
        : loc.longitude,
  };
  await patchVisitorLocation(visitor.id, next);
  return next;
}

/** Enrich a list (bounded concurrency) for admin table rows. */
export async function ensureVisitorCities(
  visitors: Locatable[],
  opts?: { limit?: number }
): Promise<Map<string, LocationInfo>> {
  const limit = opts?.limit ?? 12;
  const out = new Map<string, LocationInfo>();
  const need = visitors.filter((v) => needsEnrichment(v.location));
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
