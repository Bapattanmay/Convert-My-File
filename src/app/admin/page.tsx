"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessionRow = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  googleSub?: string;
  createdAt: string;
  lastSeenAt: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: {
    source: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    ip?: string;
  };
  userAgent?: string;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}m ${s}s`;
}

function formatPlace(loc: SessionRow["location"]) {
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (loc.latitude != null && loc.longitude != null) {
    return `${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}`;
  }
  return "Unknown";
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [storageNote, setStorageNote] = useState("");
  const [totals, setTotals] = useState({ users: 0, totalSeconds: 0 });

  const loadUsage = useCallback(async () => {
    const res = await fetch("/api/admin/usage", { credentials: "include" });
    if (res.status === 401) {
      setAuthed(false);
      setChecking(false);
      return;
    }
    const data = (await res.json()) as {
      sessions: SessionRow[];
      storageNote: string;
      totals: { users: number; totalSeconds: number };
    };
    setSessions(data.sessions);
    setStorageNote(data.storageNote);
    setTotals(data.totals);
    setAuthed(true);
    setChecking(false);
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/admin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Login failed.");
      return;
    }
    setPassword("");
    await loadUsage();
  }

  async function onLogout() {
    await fetch("/api/auth/admin", { method: "DELETE", credentials: "include" });
    setAuthed(false);
    setSessions([]);
  }

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#64748B]" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 sm:px-8">
        <div className="rounded-[28px] border border-[#E6DFD2] bg-white/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37]">
            <Shield className="h-5 w-5" />
          </span>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-[#0F172A]">
            Admin login
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Owner access to usage analytics. Credentials come from environment
            variables.
          </p>
          <form onSubmit={onLogin} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-user">Username</Label>
              <Input
                id="admin-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-pass">Password</Label>
              <Input
                id="admin-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="rounded-xl"
              />
            </div>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#0F172A] text-white"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-[#64748B] underline"
          >
            ← Back to Convert My File
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
            OWNER
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[#0F172A]">
            Usage dashboard
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            {totals.users} users · {formatDuration(totals.totalSeconds)} total
            time tracked
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadUsage()}
            className="rounded-full"
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void onLogout()}
            className="rounded-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>

      {storageNote ? (
        <p className="mt-6 rounded-2xl border border-[#E6DFD2] bg-[#FBF9F5] px-4 py-3 text-xs leading-relaxed text-[#64748B]">
          {storageNote}
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-[24px] border border-[#E6DFD2] bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#E6DFD2] bg-[#F7F4EE] text-xs uppercase tracking-wider text-[#64748B]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Features</th>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[#94A3B8]"
                >
                  No usage sessions yet. Ask someone to log in on the main site.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#F1EDE4] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[#0F172A]">
                    <div className="flex items-center gap-2">
                      {s.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.picture}
                          alt=""
                          className="h-8 w-8 rounded-full ring-1 ring-[#E6DFD2]"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <div>
                        <div>{s.name}</div>
                        {s.email ? (
                          <div className="text-[11px] font-normal text-[#64748B]">
                            {s.email}
                          </div>
                        ) : null}
                        <div className="mt-0.5 text-[11px] font-normal text-[#94A3B8]">
                          {new Date(s.createdAt).toLocaleString()}
                          {s.googleSub ? " · Google" : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    <div>{formatPlace(s.location)}</div>
                    <div className="mt-0.5 text-[11px] text-[#94A3B8]">
                      {s.location.source.replace(/_/g, " ")}
                      {s.location.ip ? ` · ${s.location.ip}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {s.featuresUsed.length
                      ? s.featuresUsed.join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#0F172A]">
                    {formatDuration(s.timeSpentSeconds)}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {new Date(s.lastSeenAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Link
        href="/"
        className="mt-8 inline-block text-sm font-medium text-[#64748B] underline"
      >
        ← Back to Convert My File
      </Link>
    </div>
  );
}
