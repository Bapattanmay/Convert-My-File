/**
 * Retention test: write marker visitor → reload store → confirm present.
 * Uses DATABASE_URL if set, else file DATA_DIR.
 *
 *   DATABASE_URL=... node scripts/test-analytics-persistence.mjs
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const MARKER = `persist-marker-${Date.now()}`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // Dynamic import compiled TS via tsx if available; else talk to Postgres directly
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required for this retention test");
  }

  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_store (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await pool.query(`SELECT data FROM analytics_store WHERE id = 1`);
  let store = existing.rows[0]?.data || {
    visitors: [],
    sessions: [],
    featureEvents: [],
    adminAudit: [],
  };

  const visitorId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  store.visitors = store.visitors || [];
  store.sessions = store.sessions || [];
  store.featureEvents = store.featureEvents || [];
  store.adminAudit = store.adminAudit || [];

  store.visitors.unshift({
    id: visitorId,
    googleSub: `test-${MARKER}`,
    email: `${MARKER}@persist.test`,
    name: MARKER,
    firstSeenAt: now,
    lastSeenAt: now,
    totalTimeSeconds: 42,
    featuresUsed: ["converter"],
    location: { source: "unknown" },
  });
  store.sessions.unshift({
    id: sessionId,
    visitorId,
    startedAt: now,
    endedAt: null,
    lastHeartbeatAt: now,
    timeSpentSeconds: 42,
    featuresUsed: ["converter"],
    location: { source: "unknown" },
  });
  store.featureEvents.unshift({
    id: crypto.randomUUID(),
    visitorId,
    sessionId,
    feature: "converter",
    at: now,
  });
  store.adminAudit.unshift({
    id: crypto.randomUUID(),
    adminEmail: "persist@test",
    action: "retention_seed",
    targetId: visitorId,
    at: now,
  });

  await pool.query(
    `INSERT INTO analytics_store (id, data, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(store)]
  );

  // Simulate "restart": new pool connection, re-read
  await pool.end();
  const pool2 = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  const again = await pool2.query(`SELECT data, updated_at FROM analytics_store WHERE id = 1`);
  const data = again.rows[0]?.data;
  const found = (data?.visitors || []).some((v) => v.name === MARKER);
  const sessionFound = (data?.sessions || []).some((s) => s.id === sessionId);
  const eventFound = (data?.featureEvents || []).some(
    (e) => e.visitorId === visitorId && e.feature === "converter"
  );
  const auditFound = (data?.adminAudit || []).some(
    (a) => a.action === "retention_seed" && a.targetId === visitorId
  );

  const report = {
    at: new Date().toISOString(),
    marker: MARKER,
    visitorId,
    sessionId,
    backend: "postgres",
    afterReconnect: {
      foundVisitor: found,
      foundSession: sessionFound,
      foundEvent: eventFound,
      foundAudit: auditFound,
      visitorCount: data?.visitors?.length ?? 0,
      sessionCount: data?.sessions?.length ?? 0,
    },
    status:
      found && sessionFound && eventFound && auditFound ? "PASS" : "FAIL",
  };

  fs.writeFileSync(
    path.join(OUT, "analytics-persistence-results.json"),
    JSON.stringify(report, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT, "analytics-persistence-results.txt"),
    `${report.status}\tmarker=${MARKER}\tvisitors=${report.afterReconnect.visitorCount}\n`
  );
  console.log(JSON.stringify(report, null, 2));
  await pool2.end();
  if (report.status !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
