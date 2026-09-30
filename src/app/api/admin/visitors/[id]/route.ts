import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getVisitorDetail,
  recordAdminAudit,
} from "@/lib/usage-store";
import { isActiveNow } from "@/lib/admin-metrics";
import { ensureVisitorCity } from "@/lib/admin-location-enrich";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await ctx.params;
  const detail = await getVisitorDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const location = await ensureVisitorCity(detail.visitor);
  const visitor = { ...detail.visitor, location };

  await recordAdminAudit({
    adminEmail: admin.email,
    action: "view_visitor",
    targetId: id,
  });

  const active = detail.sessions.some((s) => isActiveNow(s.lastHeartbeatAt));

  return NextResponse.json({
    visitor,
    sessions: detail.sessions,
    events: detail.events.slice(0, 200),
    audit: detail.audit.slice(0, 50),
    active,
  });
}
