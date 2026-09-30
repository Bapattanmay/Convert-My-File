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

/** Strip admin suffixes like "Corporation" / "Municipal Corporation". */
export function normalizeCityName(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let s = raw.trim();
  if (!s) return undefined;
  s = s
    .replace(
      /\s+(Municipal\s+Corporation|City\s+Corporation|Corporation|Municipality|Metro\s+Region|Metropolitan\s+Area)\s*$/i,
      ""
    )
    .trim();
  return s || undefined;
}

function pickCity(
  candidates: Array<string | undefined | null>
): string | undefined {
  for (const c of candidates) {
    const n = normalizeCityName(c);
    if (n) return n;
  }
  return undefined;
}

async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "ConvertMyFile/1.0 (admin analytics; contact=ops@convert-my-file.local)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    name?: string;
    addresstype?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      city_district?: string;
      suburb?: string;
      county?: string;
      state_district?: string;
      state?: string;
      region?: string;
      country?: string;
    };
  };
  const a = data.address || {};
  // Prefer real city names over OSM "… Corporation" labels / wards.
  const city = pickCity([
    a.state_district && /corporation|municipality/i.test(a.city || "")
      ? a.state_district
      : undefined,
    a.city,
    a.town,
    a.village,
    a.municipality,
    data.addresstype === "city" || data.addresstype === "town"
      ? data.name
      : undefined,
    a.state_district,
    a.city_district,
    a.county,
  ]);
  return {
    city,
    region: a.state || a.region,
    country: a.country,
  };
}

async function reverseGeocodeBigDataCloud(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const url = new URL(
    "https://api.bigdatacloud.net/data/reverse-geocode-client"
  );
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", "en");
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  return {
    city: pickCity([data.city, data.locality]),
    region: data.principalSubdivision,
    country: data.countryName,
  };
}

/**
 * Reverse-geocode lat/lng → city/region/country.
 * Tries Nominatim, then BigDataCloud. Best-effort; returns {} on total failure.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};

  let nominatim: ReverseGeocodeResult = {};
  try {
    nominatim = await reverseGeocodeNominatim(latitude, longitude);
  } catch {
    nominatim = {};
  }
  if (nominatim.city) return nominatim;

  try {
    const bdc = await reverseGeocodeBigDataCloud(latitude, longitude);
    return {
      city: bdc.city || nominatim.city,
      region: bdc.region || nominatim.region,
      country: bdc.country || nominatim.country,
    };
  } catch {
    return nominatim;
  }
}

/**
 * When coords exist but city is missing/placeholder, resolve via reverse geocode.
 */
export async function enrichLocationCity(loc: {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ city?: string; region?: string; country?: string } | null> {
  const missing =
    !loc.city ||
    /^city unknown$/i.test(loc.city) ||
    loc.city === "—" ||
    loc.city === "-";
  if (
    !missing ||
    typeof loc.latitude !== "number" ||
    typeof loc.longitude !== "number" ||
    !Number.isFinite(loc.latitude) ||
    !Number.isFinite(loc.longitude)
  ) {
    return null;
  }
  const geo = await reverseGeocode(loc.latitude, loc.longitude);
  if (!geo.city && !geo.region && !geo.country) return null;
  return {
    city: geo.city || loc.city,
    region: geo.region || loc.region,
    country: geo.country || loc.country,
  };
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
