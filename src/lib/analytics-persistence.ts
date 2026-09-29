/**
 * Durable analytics persistence.
 * - Prefer Postgres when DATABASE_URL is set (survives Render web redeploys).
 * - Else JSON files under DATA_DIR (use a Render persistent disk mount for durability).
 * Never DROP / truncate existing data on boot.
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import type { AnalyticsStore } from "@/lib/usage-store-types";

export type { AnalyticsStore };

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "analytics-store.json");
const LEGACY_PATH = path.join(DATA_DIR, "usage-store.json");

export function persistenceBackend(): "postgres" | "file" {
  return process.env.DATABASE_URL ? "postgres" : "file";
}

export function persistencePaths() {
  return { DATA_DIR, STORE_PATH, LEGACY_PATH };
}

export function emptyStore(): AnalyticsStore {
  return { visitors: [], sessions: [], featureEvents: [], adminAudit: [] };
}

function normalizeStore(raw: Partial<AnalyticsStore> | null | undefined): AnalyticsStore {
  return {
    visitors: Array.isArray(raw?.visitors) ? raw!.visitors! : [],
    sessions: Array.isArray(raw?.sessions) ? raw!.sessions! : [],
    featureEvents: Array.isArray(raw?.featureEvents) ? raw!.featureEvents! : [],
    adminAudit: Array.isArray(raw?.adminAudit) ? raw!.adminAudit! : [],
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJsonFileAtomic(filePath: string, data: unknown) {
  await ensureDataDir();
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

let pgPool: import("pg").Pool | null = null;
let pgReady: Promise<void> | null = null;

async function getPool(): Promise<import("pg").Pool> {
  if (pgPool) return pgPool;
  const { Pool } = await import("pg");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "0" ? false : { rejectUnauthorized: false },
    max: 4,
  });
  return pgPool;
}

async function ensurePgSchema() {
  if (pgReady) return pgReady;
  pgReady = (async () => {
    const pool = await getPool();
    // CREATE IF NOT EXISTS only — never DROP
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_store (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  })();
  return pgReady;
}

async function loadFromPostgres(): Promise<AnalyticsStore | null> {
  await ensurePgSchema();
  const pool = await getPool();
  const res = await pool.query<{ data: AnalyticsStore }>(
    `SELECT data FROM analytics_store WHERE id = 1`
  );
  if (!res.rows[0]) return null;
  return normalizeStore(res.rows[0].data);
}

async function saveToPostgres(store: AnalyticsStore) {
  await ensurePgSchema();
  const pool = await getPool();
  await pool.query(
    `INSERT INTO analytics_store (id, data, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE
       SET data = EXCLUDED.data,
           updated_at = NOW()`,
    [JSON.stringify(store)]
  );
}

async function loadFromFiles(): Promise<AnalyticsStore | null> {
  const current = await readJsonFile(STORE_PATH);
  if (current && typeof current === "object") {
    return normalizeStore(current as AnalyticsStore);
  }
  return null;
}

export type LoadResult = {
  store: AnalyticsStore;
  source: "postgres" | "file" | "legacy-file" | "empty";
  migratedFromFile?: boolean;
};

/**
 * Load store. Never wipes existing Postgres/file data.
 * If Postgres is empty but a local JSON file exists, migrate into Postgres once.
 */
export async function loadAnalyticsStore(opts?: {
  migrateLegacy?: (legacy: unknown) => AnalyticsStore;
}): Promise<LoadResult> {
  if (persistenceBackend() === "postgres") {
    const existing = await loadFromPostgres();
    if (existing) {
      return { store: existing, source: "postgres" };
    }
    // Migrate from local JSON if present (e.g. leftover ephemeral data in image)
    const fileData = await readJsonFile(STORE_PATH);
    if (fileData && typeof fileData === "object") {
      const store = normalizeStore(fileData as AnalyticsStore);
      await saveToPostgres(store);
      // Keep a file backup copy under DATA_DIR when writable
      try {
        await writeJsonFileAtomic(STORE_PATH, store);
      } catch {
        /* ignore */
      }
      return { store, source: "postgres", migratedFromFile: true };
    }
    const legacy = await readJsonFile(LEGACY_PATH);
    if (legacy && opts?.migrateLegacy) {
      const store = opts.migrateLegacy(legacy);
      await saveToPostgres(store);
      return { store, source: "postgres", migratedFromFile: true };
    }
    const empty = emptyStore();
    await saveToPostgres(empty);
    return { store: empty, source: "empty" };
  }

  // File backend
  await ensureDataDir();
  if (fsSync.existsSync(STORE_PATH)) {
    const fileData = await readJsonFile(STORE_PATH);
    if (fileData && typeof fileData === "object") {
      return { store: normalizeStore(fileData as AnalyticsStore), source: "file" };
    }
  }
  if (fsSync.existsSync(LEGACY_PATH) && opts?.migrateLegacy) {
    const legacy = await readJsonFile(LEGACY_PATH);
    const store = opts.migrateLegacy(legacy);
    await writeJsonFileAtomic(STORE_PATH, store);
    return { store, source: "legacy-file", migratedFromFile: true };
  }
  const empty = emptyStore();
  await writeJsonFileAtomic(STORE_PATH, empty);
  return { store: empty, source: "empty" };
}

export async function saveAnalyticsStore(store: AnalyticsStore): Promise<void> {
  // Cap growth before persist
  if (store.featureEvents.length > 20000) {
    store.featureEvents = store.featureEvents.slice(0, 20000);
  }
  if (store.sessions.length > 10000) store.sessions = store.sessions.slice(0, 10000);
  if (store.visitors.length > 8000) store.visitors = store.visitors.slice(0, 8000);
  if (store.adminAudit.length > 5000) {
    store.adminAudit = store.adminAudit.slice(0, 5000);
  }

  if (persistenceBackend() === "postgres") {
    await saveToPostgres(store);
    // Best-effort local mirror for debugging / migration
    try {
      await writeJsonFileAtomic(STORE_PATH, store);
    } catch {
      /* ignore */
    }
    return;
  }
  await writeJsonFileAtomic(STORE_PATH, store);
}

export function storageNote(): string {
  if (persistenceBackend() === "postgres") {
    return `Analytics persisted in Postgres (DATABASE_URL). Survives web service redeploys. JSON mirror attempted at ${STORE_PATH}.`;
  }
  return `Analytics stored at ${STORE_PATH}. Attach a Render persistent disk at DATA_DIR or set DATABASE_URL for durability across redeploys.`;
}
