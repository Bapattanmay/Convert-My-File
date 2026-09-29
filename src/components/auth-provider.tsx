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
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  picture?: string;
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
  googleConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
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

function AuthInner({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(true);

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await res.json()) as {
        user: AuthUser | null;
        googleConfigured?: boolean;
      };
      if (typeof data.googleConfigured === "boolean") {
        setGoogleConfigured(data.googleConfigured);
      }
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    void refreshUsage();
  }, [status, session?.usageSessionId, refreshUsage]);

  const syncLocation = useEffectEvent(async () => {
    if (!session?.usageSessionId) return;
    const geo = await readGeo();
    await fetch("/api/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        geo.geoGranted
          ? {
              latitude: geo.latitude,
              longitude: geo.longitude,
              syncIpLocation: true,
            }
          : { syncIpLocation: true }
      ),
    }).catch(() => {});
    void refreshUsage();
  });

  useEffect(() => {
    if (session?.usageSessionId) {
      void syncLocation();
    }
  }, [session?.usageSessionId]);

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

  const signInWithGoogle = useCallback(async () => {
    if (!googleConfigured) {
      throw new Error(
        "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
      );
    }
    await signIn("google", { callbackUrl: "/" });
  }, [googleConfigured]);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
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
        loading: loading || status === "loading",
        loginOpen,
        setLoginOpen,
        googleConfigured,
        signInWithGoogle,
        logout,
        trackFeature,
        requireLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthInner>{children}</AuthInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
