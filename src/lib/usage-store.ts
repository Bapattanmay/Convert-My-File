import fs from "fs";
import path from "path";
import crypto from "crypto";

export type LocationInfo = {
  source: "browser_geolocation" | "ip_approximate" | "unknown";
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  ip?: string;
};

export type UsageSession = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  googleSub?: string;
  createdAt: string;
  lastSeenAt: string;
  /** Accumulated active seconds from heartbeats */
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
  userAgent?: string;
};

export type StoreShape = {
  sessions: UsageSession[];
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "usage-store.json");

function ensureStore(): StoreShape {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const empty: StoreShape = { sessions: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as StoreShape;
  } catch {
    const empty: StoreShape = { sessions: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function writeStore(store: StoreShape) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

/** @deprecated Name-only login removed — Google OAuth required. */
export function createSession(input: {
  name: string;
  location: LocationInfo;
  userAgent?: string;
  email?: string;
  picture?: string;
  googleSub?: string;
}): UsageSession {
  const store = ensureStore();
  const now = new Date().toISOString();
  const session: UsageSession = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 120),
    email: input.email?.slice(0, 200),
    picture: input.picture?.slice(0, 500),
    googleSub: input.googleSub?.slice(0, 120),
    createdAt: now,
    lastSeenAt: now,
    timeSpentSeconds: 0,
    featuresUsed: [],
    location: input.location,
    userAgent: input.userAgent?.slice(0, 300),
  };
  store.sessions.unshift(session);
  if (store.sessions.length > 5000) store.sessions.length = 5000;
  writeStore(store);
  return session;
}

/** Create or refresh a usage row keyed by Google subject. */
export function upsertGoogleSession(input: {
  googleSub: string;
  name: string;
  email: string;
  picture?: string;
  userAgent?: string;
}): UsageSession {
  const store = ensureStore();
  const now = new Date().toISOString();
  const idx = store.sessions.findIndex(
    (s) =>
      (input.googleSub && s.googleSub === input.googleSub) ||
      (input.email && s.email === input.email)
  );
  if (idx >= 0) {
    const s = store.sessions[idx];
    s.name = input.name.trim().slice(0, 120);
    s.email = input.email.slice(0, 200);
    s.picture = input.picture?.slice(0, 500) || s.picture;
    s.googleSub = input.googleSub.slice(0, 120);
    s.lastSeenAt = now;
    if (input.userAgent) s.userAgent = input.userAgent.slice(0, 300);
    store.sessions[idx] = s;
    // Move to front
    store.sessions.splice(idx, 1);
    store.sessions.unshift(s);
    writeStore(store);
    return s;
  }
  return createSession({
    name: input.name,
    email: input.email,
    picture: input.picture,
    googleSub: input.googleSub,
    location: { source: "unknown" },
    userAgent: input.userAgent,
  });
}

export function getSession(id: string): UsageSession | null {
  const store = ensureStore();
  return store.sessions.find((s) => s.id === id) ?? null;
}

export function touchSession(
  id: string,
  patch: {
    addSeconds?: number;
    feature?: string;
    location?: Partial<LocationInfo>;
  }
): UsageSession | null {
  const store = ensureStore();
  const idx = store.sessions.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const s = store.sessions[idx];
  s.lastSeenAt = new Date().toISOString();
  if (patch.addSeconds && patch.addSeconds > 0) {
    s.timeSpentSeconds += Math.min(patch.addSeconds, 120);
  }
  if (patch.feature) {
    const f = patch.feature.slice(0, 40);
    if (!s.featuresUsed.includes(f)) s.featuresUsed.push(f);
  }
  if (patch.location) {
    s.location = { ...s.location, ...patch.location };
  }
  store.sessions[idx] = s;
  writeStore(store);
  return s;
}

export function listSessions(): UsageSession[] {
  return ensureStore().sessions;
}

export function adminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "bapattanmay@gmail.com",
    password: process.env.ADMIN_PASSWORD || "Bapattanmay@12345",
  };
}

export function storageNote(): string {
  return `Usage data is stored on the server filesystem at ${STORE_PATH}. On Render free/ephemeral disks this may reset on redeploy unless a persistent disk is attached (DATA_DIR).`;
}
