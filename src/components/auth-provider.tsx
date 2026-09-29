"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  name: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: {
    source: string;
    city?: string;
    region?: string;
    country?: string;
  };
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginOpen: boolean;
  setLoginOpen: (open: boolean) => void;
  login: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  trackFeature: (feature: string) => void;
  requireLogin: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readGeo(): Promise<{
  latitude?: number;
  longitude?: number;
  geoGranted: boolean;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { geoGranted: false };
  }
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 600_000,
      });
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      geoGranted: true,
    };
  } catch {
    return { geoGranted: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const heartbeat = useEffectEvent(() => {
    if (!user) return;
    void fetch("/api/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds: 15 }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { timeSpentSeconds?: number } | null) => {
        if (data?.timeSpentSeconds != null) {
          setUser((u) =>
            u ? { ...u, timeSpentSeconds: data.timeSpentSeconds! } : u
          );
        }
      })
      .catch(() => {});
  });

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => heartbeat(), 15_000);
    return () => window.clearInterval(id);
  }, [user]);

  const login = useCallback(async (name: string) => {
    const geo = await readGeo();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        latitude: geo.latitude,
        longitude: geo.longitude,
        geoGranted: geo.geoGranted,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      session?: { id: string; name: string; location: AuthUser["location"] };
    };
    if (!res.ok || !data.session) {
      return { ok: false as const, error: data.error || "Login failed." };
    }
    setUser({
      id: data.session.id,
      name: data.session.name,
      timeSpentSeconds: 0,
      featuresUsed: [],
      location: data.session.location,
    });
    setLoginOpen(false);
    return { ok: true as const };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }, []);

  const trackFeature = useCallback(
    (feature: string) => {
      if (!user) return;
      void fetch("/api/track", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { featuresUsed?: string[] } | null) => {
          if (data?.featuresUsed) {
            setUser((u) => (u ? { ...u, featuresUsed: data.featuresUsed! } : u));
          }
        })
        .catch(() => {});
    },
    [user]
  );

  const requireLogin = useCallback(() => {
    if (user) return true;
    setLoginOpen(true);
    return false;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginOpen,
        setLoginOpen,
        login,
        logout,
        trackFeature,
        requireLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
