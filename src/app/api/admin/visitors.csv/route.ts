import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getAnalyticsStore,
  recordAdminAudit,
} from "@/lib/usage-store";
import { filterVisitors, type RangeKey } from "@/lib/admin-metrics";
import { formatIst } from "@/lib/ist";

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

  const header = [
    "id",
    "name",
    "email",
    "firstSeenAt_IST",
    "lastSeenAt_IST",
    "totalTimeSeconds",
    "features",
    "city",
    "region",
    "country",
    "ip",
    "locationSource",
  ];

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const v of rows) {
    lines.push(
      [
        v.id,
        escape(v.name),
        escape(v.email || ""),
        escape(formatIst(v.firstSeenAt)),
        escape(formatIst(v.lastSeenAt)),
        String(v.totalTimeSeconds),
        escape(v.featuresUsed.join("|")),
        escape(v.location?.city || ""),
        escape(v.location?.region || ""),
        escape(v.location?.country || ""),
        escape(v.location?.ip || ""),
        escape(v.location?.source || ""),
      ].join(",")
    );
  }

  recordAdminAudit({
    adminEmail: admin.email,
    action: "export_visitors_csv",
    meta: { range, count: rows.length },
  });

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visitors-${range}.csv"`,
    },
  });
}
