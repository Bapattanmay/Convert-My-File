import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  isSessionOpen,
  SESSION_IDLE_MS,
  truncateIp,
  type FeatureId,
} from "@/lib/admin-metrics";

export type LocationInfo = {
  source: "browser_geolocation" | "ip_approximate" | "unknown";
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  /** Truncated IP (last octet zeroed) */
  ip?: string;
};

export type Visitor = {
  id: string;
  googleSub?: string;
  email?: string;
  name: string;
  picture?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalTimeSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
  userAgent?: string;
};

export type AnalyticsSession = {
  id: string;
  visitorId: string;
  startedAt: string;
  endedAt?: string | null;
  lastHeartbeatAt: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
};

export type FeatureEvent = {
  id: string;
  visitorId: string;
  sessionId: string;
  feature: string;
  at: string;
};

export type AdminAudit = {
  id: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  at: string;
};

export type AnalyticsStore = {
  visitors: Visitor[];
  sessions: AnalyticsSession[];
  featureEvents: FeatureEvent[];
  adminAudit: AdminAudit[];
};

/** Legacy shape (pre-rebuild) — migrated on read. */
type LegacyUsageSession = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  googleSub?: string;
  createdAt: string;
  lastSeenAt: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
  userAgent?: string;
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "analytics-store.json");
const LEGACY_PATH = path.join(DATA_DIR, "usage-store.json");

function emptyStore(): AnalyticsStore {
  return { visitors: [], sessions: [], featureEvents: [], adminAudit: [] };
}

function migrateLegacy(legacy: { sessions?: LegacyUsageSession[] }): AnalyticsStore {
  const store = emptyStore();
  for (const s of legacy.sessions || []) {
    const visitorId = crypto.randomUUID();
    const loc = {
      ...s.location,
      ip: truncateIp(s.location?.ip),
      // Drop precise coords for retained records unless recently needed — keep city-level
      latitude: undefined,
      longitude: undefined,
    };
    store.visitors.push({
      id: visitorId,
      googleSub: s.googleSub,
      email: s.email,
      name: s.name,
      picture: s.picture,
      firstSeenAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      totalTimeSeconds: s.timeSpentSeconds || 0,
      featuresUsed: s.featuresUsed || [],
      location: loc,
      userAgent: s.userAgent,
    });
    store.sessions.push({
      id: s.id,
      visitorId,
      startedAt: s.createdAt,
      endedAt: s.lastSeenAt,
      lastHeartbeatAt: s.lastSeenAt,
      timeSpentSeconds: s.timeSpentSeconds || 0,
      featuresUsed: s.featuresUsed || [],
      location: loc,
    });
    for (const f of s.featuresUsed || []) {
      store.featureEvents.push({
        id: crypto.randomUUID(),
        visitorId,
        sessionId: s.id,
        feature: f,
        at: s.createdAt,
      });
    }
  }
  return store;
}

function ensureStore(): AnalyticsStore {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as AnalyticsStore;
      if (Array.isArray(raw.visitors) && Array.isArray(raw.sessions)) {
        return {
          visitors: raw.visitors,
          sessions: raw.sessions,
          featureEvents: raw.featureEvents || [],
          adminAudit: raw.adminAudit || [],
        };
      }
    } catch {
      /* fall through */
    }
  }
  if (fs.existsSync(LEGACY_PATH)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, "utf8")) as {
        sessions?: LegacyUsageSession[];
      };
      const migrated = migrateLegacy(legacy);
      writeStore(migrated);
      return migrated;
    } catch {
      /* fall through */
    }
  }
  const empty = emptyStore();
  writeStore(empty);
  return empty;
}

function writeStore(store: AnalyticsStore) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Cap growth
  if (store.featureEvents.length > 20000) {
    store.featureEvents = store.featureEvents.slice(0, 20000);
  }
  if (store.sessions.length > 10000) store.sessions = store.sessions.slice(0, 10000);
  if (store.visitors.length > 8000) store.visitors = store.visitors.slice(0, 8000);
  if (store.adminAudit.length > 5000) {
    store.adminAudit = store.adminAudit.slice(0, 5000);
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function closeStaleSessions(store: AnalyticsStore, now = Date.now()) {
  for (const s of store.sessions) {
    if (s.endedAt) continue;
    const t = Date.parse(s.lastHeartbeatAt);
    if (Number.isNaN(t) || now - t >= SESSION_IDLE_MS) {
      s.endedAt = new Date(t + SESSION_IDLE_MS).toISOString();
    }
  }
}

export function getAnalyticsStore(): AnalyticsStore {
  const store = ensureStore();
  closeStaleSessions(store);
  return store;
}

export function upsertGoogleVisitor(input: {
  googleSub: string;
  name: string;
  email: string;
  picture?: string;
  userAgent?: string;
}): { visitor: Visitor; session: AnalyticsSession } {
  const store = ensureStore();
  closeStaleSessions(store);
  const now = new Date().toISOString();
  let visitor =
    store.visitors.find(
      (v) =>
        (input.googleSub && v.googleSub === input.googleSub) ||
        (input.email && v.email === input.email)
    ) || null;

  if (!visitor) {
    visitor = {
      id: crypto.randomUUID(),
      googleSub: input.googleSub.slice(0, 120),
      email: input.email.slice(0, 200),
      name: input.name.trim().slice(0, 120),
      picture: input.picture?.slice(0, 500),
      firstSeenAt: now,
      lastSeenAt: now,
      totalTimeSeconds: 0,
      featuresUsed: [],
      location: { source: "unknown" },
      userAgent: input.userAgent?.slice(0, 300),
    };
    store.visitors.unshift(visitor);
  } else {
    visitor.name = input.name.trim().slice(0, 120);
    visitor.email = input.email.slice(0, 200);
    visitor.picture = input.picture?.slice(0, 500) || visitor.picture;
    visitor.googleSub = input.googleSub.slice(0, 120);
    visitor.lastSeenAt = now;
    if (input.userAgent) visitor.userAgent = input.userAgent.slice(0, 300);
  }

  let session = store.sessions.find(
    (s) => s.visitorId === visitor!.id && isSessionOpen(s.lastHeartbeatAt, s.endedAt)
  );
  if (!session) {
    session = {
      id: crypto.randomUUID(),
      visitorId: visitor.id,
      startedAt: now,
      endedAt: null,
      lastHeartbeatAt: now,
      timeSpentSeconds: 0,
      featuresUsed: [],
      location: { ...visitor.location },
    };
    store.sessions.unshift(session);
  } else {
    session.lastHeartbeatAt = now;
  }

  writeStore(store);
  return { visitor, session };
}

export function heartbeat(input: {
  sessionId?: string;
  visitorId?: string;
  addSeconds?: number;
  feature?: string;
  location?: Partial<LocationInfo>;
}): { visitor: Visitor; session: AnalyticsSession } | null {
  const store = ensureStore();
  closeStaleSessions(store);
  const nowIso = new Date().toISOString();

  let session: AnalyticsSession | undefined;
  if (input.sessionId) {
    session = store.sessions.find((s) => s.id === input.sessionId);
  }
  if (!session && input.visitorId) {
    session = store.sessions.find(
      (s) =>
        s.visitorId === input.visitorId &&
        isSessionOpen(s.lastHeartbeatAt, s.endedAt)
    );
  }
  if (!session) return null;

  // Revive if within idle window already closed incorrectly — open new if fully idle
  if (session.endedAt && !isSessionOpen(session.lastHeartbeatAt, null)) {
    const visitor = store.visitors.find((v) => v.id === session!.visitorId);
    if (!visitor) return null;
    session = {
      id: crypto.randomUUID(),
      visitorId: visitor.id,
      startedAt: nowIso,
      endedAt: null,
      lastHeartbeatAt: nowIso,
      timeSpentSeconds: 0,
      featuresUsed: [],
      location: { ...visitor.location },
    };
    store.sessions.unshift(session);
  }

  session.endedAt = null;
  session.lastHeartbeatAt = nowIso;
  const add = Math.min(Math.max(input.addSeconds || 0, 0), 120);
  session.timeSpentSeconds += add;

  const visitor = store.visitors.find((v) => v.id === session!.visitorId);
  if (!visitor) return null;
  visitor.lastSeenAt = nowIso;
  visitor.totalTimeSeconds += add;

  if (input.location) {
    const loc: LocationInfo = {
      ...session.location,
      ...input.location,
      ip: truncateIp(input.location.ip ?? session.location.ip),
    };
    // Prefer not retaining precise coords long-term — keep for active session only
    session.location = loc;
    visitor.location = {
      source: loc.source,
      city: loc.city,
      region: loc.region,
      country: loc.country,
      ip: loc.ip,
    };
  }

  if (input.feature) {
    const f = input.feature.slice(0, 40);
    if (!session.featuresUsed.includes(f)) session.featuresUsed.push(f);
    if (!visitor.featuresUsed.includes(f)) visitor.featuresUsed.push(f);
    store.featureEvents.unshift({
      id: crypto.randomUUID(),
      visitorId: visitor.id,
      sessionId: session.id,
      feature: f,
      at: nowIso,
    });
  }

  // persist visitor/session updates
  const vi = store.visitors.findIndex((v) => v.id === visitor.id);
  if (vi >= 0) store.visitors[vi] = visitor;
  const si = store.sessions.findIndex((s) => s.id === session!.id);
  if (si >= 0) store.sessions[si] = session;

  writeStore(store);
  return { visitor, session };
}

export function getVisitor(id: string): Visitor | null {
  return getAnalyticsStore().visitors.find((v) => v.id === id) ?? null;
}

export function getSessionById(id: string): AnalyticsSession | null {
  return getAnalyticsStore().sessions.find((s) => s.id === id) ?? null;
}

export function getVisitorDetail(id: string) {
  const store = getAnalyticsStore();
  const visitor = store.visitors.find((v) => v.id === id);
  if (!visitor) return null;
  const sessions = store.sessions.filter((s) => s.visitorId === id);
  const events = store.featureEvents.filter((e) => e.visitorId === id);
  const audit = store.adminAudit.filter((a) => a.targetId === id);
  return { visitor, sessions, events, audit };
}

export function recordAdminAudit(input: {
  adminEmail: string;
  action: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  const store = ensureStore();
  store.adminAudit.unshift({
    id: crypto.randomUUID(),
    adminEmail: input.adminEmail,
    action: input.action,
    targetId: input.targetId,
    meta: input.meta,
    at: new Date().toISOString(),
  });
  writeStore(store);
}

export function storageNote(): string {
  return `Analytics stored at ${STORE_PATH}. On Render free/ephemeral disks this may reset on redeploy unless a persistent disk is attached (DATA_DIR).`;
}

// ——— Compatibility shims for existing auth/track/me ———

export type UsageSession = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  googleSub?: string;
  createdAt: string;
  lastSeenAt: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
  userAgent?: string;
  visitorId?: string;
};

export function upsertGoogleSession(input: {
  googleSub: string;
  name: string;
  email: string;
  picture?: string;
  userAgent?: string;
}): UsageSession {
  const { visitor, session } = upsertGoogleVisitor(input);
  return {
    id: session.id,
    visitorId: visitor.id,
    name: visitor.name,
    email: visitor.email,
    picture: visitor.picture,
    googleSub: visitor.googleSub,
    createdAt: session.startedAt,
    lastSeenAt: visitor.lastSeenAt,
    timeSpentSeconds: session.timeSpentSeconds,
    featuresUsed: session.featuresUsed,
    location: visitor.location,
    userAgent: visitor.userAgent,
  };
}

export function getSession(id: string): UsageSession | null {
  const store = getAnalyticsStore();
  const session = store.sessions.find((s) => s.id === id);
  if (!session) return null;
  const visitor = store.visitors.find((v) => v.id === session.visitorId);
  if (!visitor) return null;
  return {
    id: session.id,
    visitorId: visitor.id,
    name: visitor.name,
    email: visitor.email,
    picture: visitor.picture,
    googleSub: visitor.googleSub,
    createdAt: session.startedAt,
    lastSeenAt: visitor.lastSeenAt,
    timeSpentSeconds: session.timeSpentSeconds,
    featuresUsed: session.featuresUsed,
    location: visitor.location,
    userAgent: visitor.userAgent,
  };
}

export function touchSession(
  id: string,
  patch: {
    addSeconds?: number;
    feature?: string;
    location?: Partial<LocationInfo>;
  }
): UsageSession | null {
  const result = heartbeat({
    sessionId: id,
    addSeconds: patch.addSeconds,
    feature: patch.feature,
    location: patch.location,
  });
  if (!result) return null;
  return getSession(result.session.id);
}

export function listSessions(): UsageSession[] {
  const store = getAnalyticsStore();
  return store.sessions.map((session) => {
    const visitor = store.visitors.find((v) => v.id === session.visitorId);
    return {
      id: session.id,
      visitorId: session.visitorId,
      name: visitor?.name || "Unknown",
      email: visitor?.email,
      picture: visitor?.picture,
      googleSub: visitor?.googleSub,
      createdAt: session.startedAt,
      lastSeenAt: visitor?.lastSeenAt || session.lastHeartbeatAt,
      timeSpentSeconds: session.timeSpentSeconds,
      featuresUsed: session.featuresUsed,
      location: visitor?.location || session.location,
      userAgent: visitor?.userAgent,
    };
  });
}

export function adminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "bapattanmay@gmail.com",
    password: process.env.ADMIN_PASSWORD || "Bapattanmay@12345",
  };
}

export type { FeatureId };
