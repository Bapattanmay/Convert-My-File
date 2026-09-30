"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import {
  Activity,
  Download,
  LogOut,
  RefreshCw,
  Search,
  Users,
  Clock,
  Zap,
  MapPin,
  X,
} from "lucide-react";
import {
  FEATURE_COLORS,
  FEATURES,
  type RangeKey,
} from "@/lib/admin-metrics";
import { formatDuration, formatIst, formatIstTime } from "@/lib/ist";

type AdminInfo = { email: string; name?: string | null; image?: string | null };

type OverviewPayload = {
  overview: {
    range: RangeKey;
    asOf: string;
    uniqueVisitors: number;
    sessions: number;
    activeNow: number;
    avgSessionSeconds: number;
    featureEvents: number;
    returningVisitors: number;
    newVisitors: number;
    featureCounts: Record<string, number>;
    totalTimeSeconds: number;
  };
  activeNow: Array<{
    sessionId: string;
    visitorId: string;
    name: string;
    email?: string;
    picture?: string;
    lastHeartbeatAt: string;
    featuresUsed: string[];
    location: {
      city?: string;
      region?: string;
      country?: string;
      source?: string;
      ip?: string;
      latitude?: number;
      longitude?: number;
    };
  }>;
  storageNote: string;
  admin: AdminInfo;
};

type LocBits = {
  city?: string;
  region?: string;
  country?: string;
  source?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
};

type VisitorRow = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalTimeSeconds: number;
  featuresUsed: string[];
  location: LocBits;
  active: boolean;
  sessionCount: number;
};

type VisitorDetail = {
  visitor: VisitorRow & { googleSub?: string; userAgent?: string };
  sessions: Array<{
    id: string;
    startedAt: string;
    endedAt?: string | null;
    lastHeartbeatAt: string;
    timeSpentSeconds: number;
    featuresUsed: string[];
  }>;
  events: Array<{ id: string; feature: string; at: string }>;
  audit: Array<{
    id: string;
    adminEmail: string;
    action: string;
    at: string;
  }>;
  active: boolean;
};

function formatCoords(loc: LocBits) {
  if (
    typeof loc.latitude !== "number" ||
    typeof loc.longitude !== "number" ||
    !Number.isFinite(loc.latitude) ||
    !Number.isFinite(loc.longitude)
  ) {
    return null;
  }
  return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
}

function placeMeta(loc: LocBits) {
  const src = (loc.source || "unknown").replace(/_/g, " ");
  const bits = [src];
  if (loc.ip) bits.push(loc.ip);
  return bits.join(" · ");
}

function cityLabel(loc: LocBits) {
  return (
    loc.city ||
    [loc.region, loc.country].filter(Boolean).join(", ") ||
    "—"
  );
}

export function AdminDashboard({ admin }: { admin: AdminInfo }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = (searchParams.get("range") || "7d") as RangeKey;
  const feature = searchParams.get("feature") || "";
  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "lastSeen_desc";
  const selectedId = searchParams.get("visitor") || "";

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qDraft, setQDraft] = useState(q);
  const [nowTick, setNowTick] = useState(() => new Date());

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadOverview = useCallback(async () => {
    const res = await fetch(`/api/admin/overview?range=${range}`, {
      credentials: "include",
    });
    if (res.status === 404) {
      setError("notfound");
      return;
    }
    if (!res.ok) throw new Error("overview failed");
    const data = (await res.json()) as OverviewPayload;
    setOverview(data);
  }, [range]);

  const loadVisitors = useCallback(async () => {
    const sp = new URLSearchParams({ range, sort });
    if (q) sp.set("q", q);
    if (feature) sp.set("feature", feature);
    const res = await fetch(`/api/admin/visitors?${sp}`, {
      credentials: "include",
    });
    if (res.status === 404) {
      setError("notfound");
      return;
    }
    if (!res.ok) throw new Error("visitors failed");
    const data = (await res.json()) as { visitors: VisitorRow[] };
    setVisitors(data.visitors);
  }, [range, q, feature, sort]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const res = await fetch(`/api/admin/visitors/${id}`, {
      credentials: "include",
    });
    if (!res.ok) {
      setDetail(null);
      return;
    }
    setDetail((await res.json()) as VisitorDetail);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadOverview(), loadVisitors()]);
      if (selectedId) await loadDetail(selectedId);
      setError(null);
    } catch {
      setError("load");
    } finally {
      setLoading(false);
    }
  }, [loadOverview, loadVisitors, loadDetail, selectedId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Poll active now every 30s
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadOverview();
      setNowTick(new Date());
    }, 30_000);
    return () => window.clearInterval(id);
  }, [loadOverview]);

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const maxFeature = useMemo(() => {
    const counts = overview?.overview.featureCounts || {};
    return Math.max(1, ...Object.values(counts));
  }, [overview]);

  if (error === "notfound") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F0E8] p-8 font-[family-name:var(--font-admin-sans)]">
        <div className="max-w-md text-center">
          <p className="text-sm text-[#64748B]">This page could not be found.</p>
          <Link href="/" className="mt-4 inline-block text-sm underline">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen bg-[#F3F0E8] text-[#0F172A] font-[family-name:var(--font-admin-sans)]">
      {/* 1 — Top bar */}
      <header className="sticky top-0 z-40 border-b border-[#E4DDD0] bg-[#F3F0E8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="font-[family-name:var(--font-admin-mono)] text-[10px] font-medium tracking-[0.22em] text-[#A89060]">
              CONVERT MY FILE · OPS
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              Admin panel
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["24h", "7d", "30d"] as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setQuery({ range: r })}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition ${
                  range === r
                    ? "bg-[#0F172A] text-[#F7F4EE]"
                    : "bg-white text-[#64748B] ring-1 ring-[#E4DDD0] hover:text-[#0F172A]"
                }`}
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-[#E4DDD0]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-[#E4DDD0]">
              {admin.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={admin.image}
                  alt=""
                  className="h-7 w-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F172A] text-[10px] text-white">
                  A
                </span>
              )}
              <span className="max-w-[160px] truncate text-xs font-medium">
                {admin.email}
              </span>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="text-[#94A3B8] hover:text-[#0F172A]"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1400px] justify-between px-5 pb-3 text-[11px] text-[#94A3B8] sm:px-8 font-[family-name:var(--font-admin-mono)]">
          <span>IST {formatIst(nowTick)}</span>
          <span>
            As of{" "}
            {overview ? formatIstTime(overview.overview.asOf) : "—"} IST
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-8 px-5 py-8 sm:px-8">
        {/* 2 — KPI cards */}
        <section aria-label="Key metrics">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                label: "Unique visitors",
                value: overview?.overview.uniqueVisitors ?? "—",
                icon: Users,
              },
              {
                label: "Sessions",
                value: overview?.overview.sessions ?? "—",
                icon: Activity,
              },
              {
                label: "Active now",
                value: overview?.overview.activeNow ?? "—",
                icon: Zap,
                accent: true,
              },
              {
                label: "Avg session",
                value: overview
                  ? formatDuration(overview.overview.avgSessionSeconds)
                  : "—",
                icon: Clock,
              },
              {
                label: "Feature events",
                value: overview?.overview.featureEvents ?? "—",
                icon: Activity,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={`rounded-2xl border border-[#E4DDD0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${
                  kpi.accent ? "ring-1 ring-[#D4AF37]/40" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-[#94A3B8] uppercase">
                    {kpi.label}
                  </p>
                  <kpi.icon className="h-4 w-4 text-[#C5A880]" />
                </div>
                <p className="mt-3 font-[family-name:var(--font-admin-mono)] text-2xl font-semibold tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
          {overview ? (
            <p className="mt-3 text-xs text-[#94A3B8]">
              {overview.overview.newVisitors} new ·{" "}
              {overview.overview.returningVisitors} returning ·{" "}
              {formatDuration(overview.overview.totalTimeSeconds)} total time
            </p>
          ) : null}
        </section>

        {/* 3 — Feature mix */}
        <section aria-label="Feature mix">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-[#0F172A]">
                Feature mix
              </h2>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Events in selected range — click to filter visitors
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const count = overview?.overview.featureCounts[f] || 0;
              const pct = Math.round((count / maxFeature) * 100);
              const active = feature === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setQuery({ feature: active ? null : f, visitor: null })
                  }
                  className={`rounded-2xl border bg-white p-4 text-left transition ${
                    active
                      ? "border-[#0F172A] shadow-md"
                      : "border-[#E4DDD0] hover:border-[#C5A880]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold uppercase tracking-[0.14em]"
                      style={{ color: FEATURE_COLORS[f] }}
                    >
                      {f}
                    </span>
                    <span className="font-[family-name:var(--font-admin-mono)] text-sm tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F3F0E8]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: FEATURE_COLORS[f],
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4 — Active now */}
        <section aria-label="Active now">
          <h2 className="text-sm font-semibold">Active now</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Heartbeat within 5 minutes · polls every 30s
          </p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {(overview?.activeNow || []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#E4DDD0] bg-white/60 px-4 py-6 text-sm text-[#94A3B8]">
                No active sessions
              </p>
            ) : (
              overview!.activeNow.map((a) => (
                <button
                  key={a.sessionId}
                  type="button"
                  onClick={() => setQuery({ visitor: a.visitorId })}
                  className="min-w-[220px] rounded-2xl border border-[#E4DDD0] bg-white p-3 text-left shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {a.name}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[#94A3B8]">
                    {a.email || "—"}
                  </p>
                  <p className="mt-2 text-[11px] text-[#64748B]">
                    {a.featuresUsed.join(", ") || "browsing"} ·{" "}
                    {formatIstTime(a.lastHeartbeatAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        {/* 5 — Filters */}
        <section
          aria-label="Filters"
          className="flex flex-col gap-3 rounded-2xl border border-[#E4DDD0] bg-white p-4 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery({ q: qDraft || null });
              }}
              placeholder="Search name or email"
              className="w-full rounded-xl border border-[#E4DDD0] bg-[#FBF9F5] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#C5A880]"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setQuery({ sort: e.target.value })}
            className="rounded-xl border border-[#E4DDD0] bg-[#FBF9F5] px-3 py-2.5 text-sm"
          >
            <option value="lastSeen_desc">Last seen ↓</option>
            <option value="lastSeen_asc">Last seen ↑</option>
            <option value="time_desc">Time ↓</option>
            <option value="time_asc">Time ↑</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
          </select>
          <a
            href={`/api/admin/visitors.csv?range=${range}${q ? `&q=${encodeURIComponent(q)}` : ""}${feature ? `&feature=${feature}` : ""}&sort=${sort}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0F172A] px-4 py-2.5 text-xs font-semibold text-white"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </a>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          {/* 6 — Visitors table */}
          <section aria-label="Visitors" className="overflow-hidden rounded-2xl border border-[#E4DDD0] bg-white">
            <div className="border-b border-[#E4DDD0] px-4 py-3">
              <h2 className="text-sm font-semibold">Visitors</h2>
              <p className="text-xs text-[#94A3B8]">{visitors.length} rows</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#F7F4EE] text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Visitor</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Features</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-[#94A3B8]"
                      >
                        No visitors in this range
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => setQuery({ visitor: v.id })}
                        className={`cursor-pointer border-t border-[#F1EDE4] hover:bg-[#FBF9F5] ${
                          selectedId === v.id ? "bg-[#F7F4EE]" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {v.picture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.picture}
                                alt=""
                                className="h-8 w-8 rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-[10px] text-white">
                                {v.name.slice(0, 1)}
                              </span>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 font-medium">
                                {v.active ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                ) : null}
                                {v.name}
                              </div>
                              <div className="text-[11px] text-[#94A3B8]">
                                {v.email || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#475569]" data-testid="admin-location-cell">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-[#C5A880]" />
                            <span className="font-medium text-[#0F172A]">
                              {cityLabel(v.location)}
                            </span>
                          </div>
                          <div className="mt-0.5 font-[family-name:var(--font-admin-mono)] text-[11px] text-[#475569]">
                            {formatCoords(v.location) || "coords unavailable"}
                          </div>
                          <div className="text-[11px] text-[#94A3B8]">
                            {placeMeta(v.location)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {v.featuresUsed.length
                              ? v.featuresUsed.map((f) => (
                                  <span
                                    key={f}
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                    style={{
                                      background:
                                        FEATURE_COLORS[
                                          f as keyof typeof FEATURE_COLORS
                                        ] || "#64748B",
                                    }}
                                  >
                                    {f}
                                  </span>
                                ))
                              : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-[family-name:var(--font-admin-mono)] tabular-nums">
                          {formatDuration(v.totalTimeSeconds)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">
                          {formatIst(v.lastSeenAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 7 — Visitor detail */}
          <section
            aria-label="Visitor detail"
            className="rounded-2xl border border-[#E4DDD0] bg-white"
          >
            <div className="flex items-center justify-between border-b border-[#E4DDD0] px-4 py-3">
              <h2 className="text-sm font-semibold">Visitor detail</h2>
              {selectedId ? (
                <button
                  type="button"
                  onClick={() => setQuery({ visitor: null })}
                  className="text-[#94A3B8] hover:text-[#0F172A]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {!detail ? (
              <p className="px-4 py-10 text-center text-sm text-[#94A3B8]">
                Select a visitor to inspect sessions, events, and audit trail
              </p>
            ) : (
              <div className="space-y-5 p-4">
                <div className="flex items-start gap-3">
                  {detail.visitor.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={detail.visitor.picture}
                      alt=""
                      className="h-12 w-12 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div>
                    <p className="font-semibold">{detail.visitor.name}</p>
                    <p className="text-xs text-[#64748B]">
                      {detail.visitor.email}
                    </p>
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      {detail.active ? "Active now" : "Idle"}
                    </p>
                  </div>
                </div>
                <div data-testid="admin-location-detail">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Location
                  </p>
                  <div className="mt-2 rounded-xl bg-[#F7F4EE] px-3 py-2 text-xs text-[#0F172A]">
                    <p className="font-medium">
                      {detail.visitor.location.city || "City unknown"}
                      {detail.visitor.location.region
                        ? `, ${detail.visitor.location.region}`
                        : ""}
                      {detail.visitor.location.country
                        ? `, ${detail.visitor.location.country}`
                        : ""}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-admin-mono)] text-[#475569]">
                      {formatCoords(detail.visitor.location) ||
                        "Latitude / longitude unavailable"}
                    </p>
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      {placeMeta(detail.visitor.location)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Sessions
                  </p>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
                    {detail.sessions.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-xl bg-[#F7F4EE] px-3 py-2"
                      >
                        <div className="font-[family-name:var(--font-admin-mono)]">
                          {formatIst(s.startedAt)}
                          {s.endedAt ? ` → ${formatIstTime(s.endedAt)}` : " · open"}
                        </div>
                        <div className="text-[#64748B]">
                          {formatDuration(s.timeSpentSeconds)} ·{" "}
                          {s.featuresUsed.join(", ") || "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Feature events
                  </p>
                  <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-[#475569]">
                    {detail.events.slice(0, 40).map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span className="font-medium capitalize">{e.feature}</span>
                        <span className="font-[family-name:var(--font-admin-mono)] text-[#94A3B8]">
                          {formatIstTime(e.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 8 — Audit log */}
        <section
          aria-label="Admin audit log"
          className="rounded-2xl border border-[#E4DDD0] bg-white"
        >
          <div className="border-b border-[#E4DDD0] px-4 py-3">
            <h2 className="text-sm font-semibold">Admin audit</h2>
            <p className="text-xs text-[#94A3B8]">
              Detail views and exports recorded for this visitor (and global
              actions appear when viewing a visitor)
            </p>
          </div>
          <ul className="max-h-48 divide-y divide-[#F1EDE4] overflow-y-auto text-xs">
            {(detail?.audit || []).length === 0 ? (
              <li className="px-4 py-6 text-[#94A3B8]">
                Open a visitor to see targeted audit entries. Overview / list /
                CSV actions are also written server-side.
              </li>
            ) : (
              detail!.audit.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  <span>
                    <span className="font-semibold">{a.action}</span>
                    <span className="text-[#94A3B8]"> · {a.adminEmail}</span>
                  </span>
                  <span className="font-[family-name:var(--font-admin-mono)] text-[#94A3B8]">
                    {formatIst(a.at)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        {overview?.storageNote ? (
          <p className="text-[11px] leading-relaxed text-[#94A3B8]">
            {overview.storageNote}
          </p>
        ) : null}

        <div className="pb-8 text-xs text-[#94A3B8]">
          <Link href="/" className="underline hover:text-[#0F172A]">
            ← Back to Convert My File
          </Link>
          {!admin.email ? (
            <button
              type="button"
              className="ml-4 underline"
              onClick={() => void signIn("google", { callbackUrl: "/admin" })}
            >
              Sign in with Google
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
