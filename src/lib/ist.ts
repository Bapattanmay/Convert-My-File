/** IST / en-IN helpers for admin UI and exports. */

const IST = "Asia/Kolkata";

export function formatIst(
  iso: string | number | Date,
  opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }
): string {
  const d = typeof iso === "string" || typeof iso === "number" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...opts }).format(d);
}

export function formatIstTime(iso: string | number | Date): string {
  return formatIst(iso, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}
