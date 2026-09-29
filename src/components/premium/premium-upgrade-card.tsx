"use client";

import { useState } from "react";
import { Crown, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { usePremium } from "@/hooks/use-premium";

export function PremiumUpgradeCard({
  dense,
  feature,
}: {
  dense?: boolean;
  feature?: string;
}) {
  const { user, setLoginOpen } = useAuth();
  const { isPremium, upgrade, loading, source } = usePremium();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (isPremium) {
    return (
      <div
        className={
          dense
            ? "flex items-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800"
            : "rounded-[24px] border border-emerald-200/80 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-900"
        }
      >
        <Crown className="inline h-4 w-4 text-[#C5A880]" /> Premium active
        {source === "allowlist" ? " (allowlist)" : " (Upgrade)"}
        {feature ? ` · ${feature}` : ""}
      </div>
    );
  }

  const onUpgrade = async () => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await upgrade();
      setNote("Premium unlocked — mock checkout, no payment.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        dense
          ? "rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] px-3 py-3"
          : "rounded-[28px] border border-[#E8E2D6] bg-gradient-to-br from-[#FBF9F5] to-[#F3EEE4] px-5 py-5 sm:px-7 sm:py-6"
      }
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37]">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[#0F172A]">
            {feature ? `${feature} is Premium` : "Unlock Premium"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
            Free stays single-file. Premium unlocks batch convert, PDF editor,
            5-language translate, page-range merge, signatures, quality preview,
            and media/bulk compress. Testing: allowlist{" "}
            <code className="text-xs">PREMIUM_EMAILS</code> or mock Upgrade.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={loading || busy}
              onClick={() => void onUpgrade()}
              className="rounded-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
            >
              <Sparkles className="h-4 w-4" />
              {user
                ? busy
                  ? "Unlocking…"
                  : "Upgrade (mock)"
                : "Login to Upgrade"}
            </Button>
            {note ? (
              <span className="text-xs font-medium text-emerald-700">{note}</span>
            ) : null}
            {err ? (
              <span className="text-xs text-red-600" role="alert">
                {err}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
