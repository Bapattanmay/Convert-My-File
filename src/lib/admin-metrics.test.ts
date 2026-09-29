import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeOverview,
  filterVisitors,
  isActiveNow,
  isSessionOpen,
  rangeStart,
  truncateIp,
  ACTIVE_NOW_MS,
  SESSION_IDLE_MS,
} from "../lib/admin-metrics";

describe("truncateIp", () => {
  it("zeros IPv4 last octet", () => {
    assert.equal(truncateIp("203.0.113.45"), "203.0.113.0");
  });
  it("shortens IPv6", () => {
    const out = truncateIp("2001:db8:85a3::8a2e:370:7334");
    assert.ok(out?.startsWith("2001:db8"));
  });
});

describe("active / session windows", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");
  it("active now within 5 minutes", () => {
    assert.equal(
      isActiveNow(new Date(now - ACTIVE_NOW_MS + 1000).toISOString(), now),
      true
    );
    assert.equal(
      isActiveNow(new Date(now - ACTIVE_NOW_MS - 1000).toISOString(), now),
      false
    );
  });
  it("session open within 2 minutes idle", () => {
    assert.equal(
      isSessionOpen(new Date(now - SESSION_IDLE_MS + 500).toISOString(), null, now),
      true
    );
    assert.equal(
      isSessionOpen(new Date(now - SESSION_IDLE_MS - 500).toISOString(), null, now),
      false
    );
    assert.equal(
      isSessionOpen(new Date(now).toISOString(), "2026-09-29T11:59:00.000Z", now),
      false
    );
  });
});

describe("computeOverview", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");
  const visitors = [
    {
      id: "v1",
      name: "A",
      email: "a@x.com",
      firstSeenAt: "2026-09-01T00:00:00.000Z",
      lastSeenAt: "2026-09-29T11:50:00.000Z",
      featuresUsed: ["converter"],
      totalTimeSeconds: 120,
    },
    {
      id: "v2",
      name: "B",
      email: "b@x.com",
      firstSeenAt: "2026-09-29T10:00:00.000Z",
      lastSeenAt: "2026-09-29T11:55:00.000Z",
      featuresUsed: ["merger"],
      totalTimeSeconds: 60,
    },
  ];
  const sessions = [
    {
      visitorId: "v1",
      startedAt: "2026-09-29T11:00:00.000Z",
      lastHeartbeatAt: "2026-09-29T11:58:00.000Z",
      timeSpentSeconds: 90,
      featuresUsed: ["converter"],
    },
    {
      visitorId: "v2",
      startedAt: "2026-09-29T11:30:00.000Z",
      lastHeartbeatAt: "2026-09-29T11:59:00.000Z",
      timeSpentSeconds: 60,
      featuresUsed: ["merger"],
    },
  ];
  const events = [
    {
      visitorId: "v1",
      feature: "converter",
      at: "2026-09-29T11:05:00.000Z",
    },
    {
      visitorId: "v2",
      feature: "merger",
      at: "2026-09-29T11:35:00.000Z",
    },
    {
      visitorId: "v2",
      feature: "merger",
      at: "2026-09-20T11:35:00.000Z",
    },
  ];

  it("aggregates 24h metrics", () => {
    const o = computeOverview({
      range: "24h",
      now,
      visitors,
      sessions,
      events,
    });
    assert.equal(o.uniqueVisitors, 2);
    assert.equal(o.sessions, 2);
    assert.equal(o.featureEvents, 2);
    assert.equal(o.featureCounts.converter, 1);
    assert.equal(o.featureCounts.merger, 1);
    assert.equal(o.avgSessionSeconds, 75);
    assert.equal(o.returningVisitors, 1);
    assert.equal(o.newVisitors, 1);
    assert.equal(o.activeNow, 2);
  });

  it("rangeStart aligns", () => {
    assert.equal(rangeStart("24h", now), now - 24 * 60 * 60 * 1000);
  });
});

describe("filterVisitors", () => {
  const visitors = [
    {
      id: "v1",
      name: "Alex",
      email: "alex@ex.com",
      firstSeenAt: "2026-09-29T10:00:00.000Z",
      lastSeenAt: "2026-09-29T11:00:00.000Z",
      featuresUsed: ["converter", "merger"],
      totalTimeSeconds: 100,
    },
    {
      id: "v2",
      name: "Blake",
      email: "blake@ex.com",
      firstSeenAt: "2026-09-29T10:00:00.000Z",
      lastSeenAt: "2026-09-29T12:00:00.000Z",
      featuresUsed: ["translator"],
      totalTimeSeconds: 50,
    },
  ];

  it("filters by q and feature and sorts", () => {
    const rows = filterVisitors({
      visitors,
      sessions: [],
      q: "alex",
      feature: "merger",
      sort: "time_desc",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "v1");
  });
});
