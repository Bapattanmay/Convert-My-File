import crypto from "crypto";
import {
  isSessionOpen,
  SESSION_IDLE_MS,
  truncateIp,
  type FeatureId,
} from "@/lib/admin-metrics";
import {
  loadAnalyticsStore,
  saveAnalyticsStore,
  storageNote as persistenceNote,
  persistenceBackend,
  persistencePaths,
} from "@/lib/analytics-persistence";
import type {
  AdminAudit,
  AnalyticsSession,
  AnalyticsStore,
  FeatureEvent,
  LocationInfo,
  Visitor,
} from "@/lib/usage-store-types";

export type {
  AdminAudit,
  AnalyticsSession,
  AnalyticsStore,
  FeatureEvent,
  LocationInfo,
  Visitor,
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

function migrateLegacy(legacy: unknown): AnalyticsStore {
  const raw = legacy as { sessions?: LegacyUsageSession[] };
  const store: AnalyticsStore = {
    visitors: [],
    sessions: [],
    featureEvents: [],
    adminAudit: [],
  };
  for (const s of raw.sessions || []) {
    const visitorId = crypto.randomUUID();
    const loc = {
      ...s.location,
      ip: truncateIp(s.location?.ip),
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

function closeStaleSessions(store: AnalyticsStore, now = Date.now()) {
  for (const s of store.sessions) {
    if (s.endedAt) continue;
    const t = Date.parse(s.lastHeartbeatAt);
    if (Number.isNaN(t) || now - t >= SESSION_IDLE_MS) {
      s.endedAt = new Date(t + SESSION_IDLE_MS).toISOString();
    }
  }
}

/** Serialize mutations so concurrent requests don't clobber each other. */
let chain: Promise<unknown> = Promise.resolve();

function withStore<T>(
  fn: (store: AnalyticsStore) => T | Promise<T>
): Promise<T> {
  const run = chain.then(async () => {
    const loaded = await loadAnalyticsStore({ migrateLegacy });
    const store = loaded.store;
    closeStaleSessions(store);
    const result = await fn(store);
    await saveAnalyticsStore(store);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function getAnalyticsStore(): Promise<AnalyticsStore> {
  const loaded = await loadAnalyticsStore({ migrateLegacy });
  closeStaleSessions(loaded.store);
  return loaded.store;
}

export async function upsertGoogleVisitor(input: {
  googleSub: string;
  name: string;
  email: string;
  picture?: string;
  userAgent?: string;
}): Promise<{ visitor: Visitor; session: AnalyticsSession }> {
  return withStore((store) => {
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
      (s) =>
        s.visitorId === visitor!.id &&
        isSessionOpen(s.lastHeartbeatAt, s.endedAt)
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

    return { visitor, session };
  });
}

export async function heartbeat(input: {
  sessionId?: string;
  visitorId?: string;
  addSeconds?: number;
  feature?: string;
  location?: Partial<LocationInfo>;
}): Promise<{ visitor: Visitor; session: AnalyticsSession } | null> {
  return withStore((store) => {
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
      session.location = loc;
      // Keep lat/lng on the visitor record (admin table + detail).
      visitor.location = {
        source: loc.source,
        city: loc.city,
        region: loc.region,
        country: loc.country,
        ip: loc.ip,
        latitude: loc.latitude,
        longitude: loc.longitude,
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

    const vi = store.visitors.findIndex((v) => v.id === visitor.id);
    if (vi >= 0) store.visitors[vi] = visitor;
    const si = store.sessions.findIndex((s) => s.id === session!.id);
    if (si >= 0) store.sessions[si] = session;

    return { visitor, session };
  });
}

export async function getVisitor(id: string): Promise<Visitor | null> {
  const store = await getAnalyticsStore();
  return store.visitors.find((v) => v.id === id) ?? null;
}

export async function getSessionById(
  id: string
): Promise<AnalyticsSession | null> {
  const store = await getAnalyticsStore();
  return store.sessions.find((s) => s.id === id) ?? null;
}

export async function getVisitorDetail(id: string) {
  const store = await getAnalyticsStore();
  const visitor = store.visitors.find((v) => v.id === id);
  if (!visitor) return null;
  const sessions = store.sessions.filter((s) => s.visitorId === id);
  const events = store.featureEvents.filter((e) => e.visitorId === id);
  const audit = store.adminAudit.filter((a) => a.targetId === id);
  return { visitor, sessions, events, audit };
}

export async function recordAdminAudit(input: {
  adminEmail: string;
  action: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  await withStore((store) => {
    store.adminAudit.unshift({
      id: crypto.randomUUID(),
      adminEmail: input.adminEmail,
      action: input.action,
      targetId: input.targetId,
      meta: input.meta,
      at: new Date().toISOString(),
    });
  });
}

export function storageNote(): string {
  return persistenceNote();
}

export function getPersistenceInfo() {
  return {
    backend: persistenceBackend(),
    ...persistencePaths(),
  };
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

export async function upsertGoogleSession(input: {
  googleSub: string;
  name: string;
  email: string;
  picture?: string;
  userAgent?: string;
}): Promise<UsageSession> {
  const { visitor, session } = await upsertGoogleVisitor(input);
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

export async function getSession(id: string): Promise<UsageSession | null> {
  const store = await getAnalyticsStore();
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

export async function touchSession(
  id: string,
  patch: {
    addSeconds?: number;
    feature?: string;
    location?: Partial<LocationInfo>;
  }
): Promise<UsageSession | null> {
  const result = await heartbeat({
    sessionId: id,
    addSeconds: patch.addSeconds,
    feature: patch.feature,
    location: patch.location,
  });
  if (!result) return null;
  return getSession(result.session.id);
}

export async function listSessions(): Promise<UsageSession[]> {
  const store = await getAnalyticsStore();
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
