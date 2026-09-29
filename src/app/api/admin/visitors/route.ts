import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getAnalyticsStore,
  recordAdminAudit,
} from "@/lib/usage-store";
import {
  filterVisitors,
  isActiveNow,
  type RangeKey,
} from "@/lib/admin-metrics";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "7d") as RangeKey;
  const q = url.searchParams.get("q") || undefined;
  const feature = url.searchParams.get("feature") || undefined;
  const sort = url.searchParams.get("sort") || "lastSeen_desc";

  const store = getAnalyticsStore();
  const rows = filterVisitors({
    visitors: store.visitors,
    sessions: store.sessions,
    q,
    feature,
    sort,
    range: ["24h", "7d", "30d"].includes(range) ? range : "7d",
  });

  const enriched = rows.map((v) => {
    const open = store.sessions.find(
      (s) => s.visitorId === v.id && isActiveNow(s.lastHeartbeatAt)
    );
    return {
      id: v.id,
      name: v.name,
      email: v.email,
      picture: v.picture,
      firstSeenAt: v.firstSeenAt,
      lastSeenAt: v.lastSeenAt,
      totalTimeSeconds: v.totalTimeSeconds,
      featuresUsed: v.featuresUsed,
      location: v.location || { source: "unknown" },
      active: Boolean(open),
      sessionCount: store.sessions.filter((s) => s.visitorId === v.id).length,
    };
  });

  recordAdminAudit({
    adminEmail: admin.email,
    action: "list_visitors",
    meta: { range, q, feature, sort, count: enriched.length },
  });

  return NextResponse.json({ visitors: enriched });
}
