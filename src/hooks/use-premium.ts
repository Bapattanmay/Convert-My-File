"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readLocalPremiumEmails,
  writeLocalPremiumEmail,
  type PremiumStatus,
} from "@/lib/premium-access";
import { useAuth } from "@/components/auth-provider";

export type UsePremium = {
  isPremium: boolean;
  source: PremiumStatus["source"];
  loading: boolean;
  upgrade: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Premium = PREMIUM_EMAILS allowlist OR mock Upgrade cookie/localStorage.
 */
export function usePremium(): UsePremium {
  const { user } = useAuth();
  const [status, setStatus] = useState<PremiumStatus>({
    isPremium: false,
    source: "none",
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/premium", { credentials: "include" });
      const data = (await res.json()) as PremiumStatus;
      let isPremium = !!data.isPremium;
      let source = data.source || "none";
      if (!isPremium && user?.email) {
        const local = readLocalPremiumEmails();
        if (local.includes(user.email.trim().toLowerCase())) {
          isPremium = true;
          source = "upgrade";
        }
      }
      setStatus({
        isPremium,
        source: isPremium ? source : "none",
        email: data.email || user?.email,
      });
    } catch {
      if (user?.email) {
        const local = readLocalPremiumEmails();
        const hit = local.includes(user.email.trim().toLowerCase());
        setStatus({
          isPremium: hit,
          source: hit ? "upgrade" : "none",
          email: user.email,
        });
      } else {
        setStatus({ isPremium: false, source: "none" });
      }
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upgrade = useCallback(async () => {
    if (!user?.email) throw new Error("Sign in with Google first.");
    const res = await fetch("/api/premium", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Upgrade failed");
    }
    writeLocalPremiumEmail(user.email);
    await refresh();
  }, [user?.email, refresh]);

  return {
    isPremium: status.isPremium,
    source: status.source,
    loading,
    upgrade,
    refresh,
  };
}
