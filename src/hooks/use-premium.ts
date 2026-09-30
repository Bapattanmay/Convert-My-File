"use client";

import { useCallback, useEffect, useState } from "react";
import type { PremiumStatus } from "@/lib/premium-access";
import { useAuth } from "@/components/auth-provider";

export type UsePremium = {
  isPremium: boolean;
  source: PremiumStatus["source"];
  loading: boolean;
  /** Requests paid upgrade — returns coming-soon until payments ship. */
  requestUpgrade: () => Promise<{
    ok: boolean;
    message: string;
    payments?: "coming_soon";
  }>;
  refresh: () => Promise<void>;
};

/** Premium = server PREMIUM_EMAILS allowlist only (no fake cookie unlock). */
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
      setStatus({
        isPremium: !!data.isPremium && data.source === "allowlist",
        source: data.isPremium ? "allowlist" : "none",
        email: data.email || user?.email,
      });
    } catch {
      setStatus({
        isPremium: false,
        source: "none",
        email: user?.email,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestUpgrade = useCallback(async () => {
    if (!user?.email) {
      return { ok: false, message: "Sign in with Google first." };
    }
    const res = await fetch("/api/premium", {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as PremiumStatus & {
      error?: string;
    };
    if (data.isPremium && data.source === "allowlist") {
      await refresh();
      return { ok: true, message: "Premium active via allowlist." };
    }
    await refresh();
    return {
      ok: false,
      message:
        data.error ||
        "Paid Premium is coming soon (India: Razorpay / Cashfree).",
      payments: "coming_soon" as const,
    };
  }, [user?.email, refresh]);

  return {
    isPremium: status.isPremium,
    source: status.source,
    loading,
    requestUpgrade,
    refresh,
  };
}
