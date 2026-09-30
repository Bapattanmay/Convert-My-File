/** Pure metric helpers — unit-tested. */

export type RangeKey = "24h" | "7d" | "30d";

export const FEATURES = [
  "converter",
  "translator",
  "merger",
  "compressor",
] as const;
export type FeatureId = (typeof FEATURES)[number];

export const FEATURE_COLORS: Record<FeatureId, string> = {
  converter: "#0F172A",
  translator: "#2563EB",
  merger: "#059669",
  compressor: "#D97706",
};

export const HEARTBEAT_MS = 30_000;
export const SESSION_IDLE_MS = 2 * 60_000;
export const ACTIVE_NOW_MS = 5 * 60_000;

export function rangeToMs(range: RangeKey): number {
  switch (range) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

export function rangeStart(range: RangeKey, now = Date.now()): number {
  return now - rangeToMs(range);
}

export function isActiveNow(
  lastHeartbeatAt: string | number | null | undefined,
  now = Date.now()
): boolean {
  if (!lastHeartbeatAt) return false;
  const t =
    typeof lastHeartbeatAt === "number"
      ? lastHeartbeatAt
      : Date.parse(lastHeartbeatAt);
  if (Number.isNaN(t)) return false;
  return now - t < ACTIVE_NOW_MS;
}

export function isSessionOpen(
  lastHeartbeatAt: string | number | null | undefined,
  endedAt?: string | null,
  now = Date.now()
): boolean {
  if (endedAt) return false;
  if (!lastHeartbeatAt) return false;
  const t =
    typeof lastHeartbeatAt === "number"
      ? lastHeartbeatAt
      : Date.parse(lastHeartbeatAt);
  if (Number.isNaN(t)) return false;
  return now - t < SESSION_IDLE_MS;
}

export function truncateIp(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  // IPv4: zero last octet
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    parts[3] = "0";
    return parts.join(".");
  }
  // IPv6: keep /64-ish prefix (first 4 hextets)
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":") + "::";
  }
  return ip;
}

export type SessionLike = {
  visitorId: string;
  startedAt: string;
  endedAt?: string | null;
  lastHeartbeatAt: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
};

export type EventLike = {
  visitorId: string;
  feature: string;
  at: string;
};

export type VisitorLike = {
  id: string;
  email?: string;
  name: string;
  picture?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  featuresUsed: string[];
  totalTimeSeconds: number;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    source?: string;
    ip?: string;
    latitude?: number;
    longitude?: number;
  };
};

/** Format admin location cell: city + lat/lng. */
export function formatAdminLocation(loc?: {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  ip?: string;
}): { cityLine: string; coords: string | null; meta: string } {
  const cityLine =
    [loc?.city, loc?.region, loc?.country].filter(Boolean).join(", ") || "—";
  const coords =
    typeof loc?.latitude === "number" &&
    typeof loc?.longitude === "number" &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude)
      ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
      : null;
  const src = (loc?.source || "unknown").replace(/_/g, " ");
  const meta = loc?.ip ? `${src} · ${loc.ip}` : src;
  return { cityLine, coords, meta };
}

export function computeOverview(input: {
  range: RangeKey;
  now?: number;
  visitors: VisitorLike[];
  sessions: SessionLike[];
  events: EventLike[];
}) {
  const now = input.now ?? Date.now();
  const start = rangeStart(input.range, now);

  const sessionsInRange = input.sessions.filter(
    (s) => Date.parse(s.startedAt) >= start
  );
  const visitorIds = new Set(sessionsInRange.map((s) => s.visitorId));
  // Also count visitors whose lastSeen falls in range even without new session start
  for (const v of input.visitors) {
    if (Date.parse(v.lastSeenAt) >= start) visitorIds.add(v.id);
  }

  const eventsInRange = input.events.filter((e) => Date.parse(e.at) >= start);
  const activeNow = input.sessions.filter((s) =>
    isActiveNow(s.lastHeartbeatAt, now)
  ).length;

  const totalSeconds = sessionsInRange.reduce(
    (n, s) => n + (s.timeSpentSeconds || 0),
    0
  );
  const avgSessionSeconds =
    sessionsInRange.length > 0
      ? Math.round(totalSeconds / sessionsInRange.length)
      : 0;

  const featureCounts: Record<string, number> = {};
  for (const f of FEATURES) featureCounts[f] = 0;
  for (const e of eventsInRange) {
    featureCounts[e.feature] = (featureCounts[e.feature] || 0) + 1;
  }

  const returning = [...visitorIds].filter((id) => {
    const v = input.visitors.find((x) => x.id === id);
    if (!v) return false;
    return Date.parse(v.firstSeenAt) < start;
  }).length;

  return {
    range: input.range,
    asOf: new Date(now).toISOString(),
    uniqueVisitors: visitorIds.size,
    sessions: sessionsInRange.length,
    activeNow,
    avgSessionSeconds,
    featureEvents: eventsInRange.length,
    returningVisitors: returning,
    newVisitors: Math.max(0, visitorIds.size - returning),
    featureCounts,
    totalTimeSeconds: totalSeconds,
  };
}

export function filterVisitors(input: {
  visitors: VisitorLike[];
  sessions: SessionLike[];
  q?: string;
  feature?: string;
  sort?: string;
  range?: RangeKey;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const start = input.range ? rangeStart(input.range, now) : 0;
  const q = (input.q || "").trim().toLowerCase();
  const feature = (input.feature || "").trim().toLowerCase();

  let rows = input.visitors.filter((v) => {
    if (start && Date.parse(v.lastSeenAt) < start && Date.parse(v.firstSeenAt) < start) {
      // include if any session in range
      const has = input.sessions.some(
        (s) => s.visitorId === v.id && Date.parse(s.startedAt) >= start
      );
      if (!has) return false;
    }
    if (q) {
      const hay = `${v.name} ${v.email || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (feature) {
      if (!v.featuresUsed.map((f) => f.toLowerCase()).includes(feature)) {
        return false;
      }
    }
    return true;
  });

  const sort = input.sort || "lastSeen_desc";
  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "time_desc":
        return b.totalTimeSeconds - a.totalTimeSeconds;
      case "time_asc":
        return a.totalTimeSeconds - b.totalTimeSeconds;
      case "lastSeen_asc":
        return Date.parse(a.lastSeenAt) - Date.parse(b.lastSeenAt);
      case "lastSeen_desc":
      default:
        return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
    }
  });

  return rows;
}
