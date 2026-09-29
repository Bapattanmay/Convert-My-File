import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getAnalyticsStore,
  recordAdminAudit,
  storageNote,
} from "@/lib/usage-store";
import { computeOverview, type RangeKey } from "@/lib/admin-metrics";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "7d") as RangeKey;
  if (!["24h", "7d", "30d"].includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const store = await getAnalyticsStore();
  const overview = computeOverview({
    range,
    visitors: store.visitors,
    sessions: store.sessions,
    events: store.featureEvents,
  });

  const active = store.sessions
    .filter((s) => {
      const t = Date.parse(s.lastHeartbeatAt);
      return Date.now() - t < 5 * 60_000 && !s.endedAt;
    })
    .map((s) => {
      const v = store.visitors.find((x) => x.id === s.visitorId);
      return {
        sessionId: s.id,
        visitorId: s.visitorId,
        name: v?.name || "Unknown",
        email: v?.email,
        picture: v?.picture,
        lastHeartbeatAt: s.lastHeartbeatAt,
        featuresUsed: s.featuresUsed,
        location: v?.location || s.location,
      };
    });

  await recordAdminAudit({
    adminEmail: admin.email,
    action: "view_overview",
    meta: { range },
  });

  return NextResponse.json({
    overview,
    activeNow: active,
    storageNote: storageNote(),
    admin: { email: admin.email, name: admin.name, image: admin.image },
  });
}
