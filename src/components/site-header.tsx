"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useWipeTimer, formatCountdown } from "@/components/wipe-provider";

export function SiteHeader() {
  const { active, secondsLeft } = useWipeTimer();

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8E2D6]/bg-[#F7F4EE]/80 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37] shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-transform duration-300 group-hover:scale-[1.03]">
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[0.08em] text-[#0F172A] sm:text-base">
              PREMIUM UTILITY.
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-[#64748B]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
              SECURE PROTOCOL V2.4
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {active && secondsLeft !== null ? (
            <div
              className="flex items-center gap-2 rounded-full bg-[#0F172A] px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] animate-in fade-in zoom-in-95 duration-300"
              role="timer"
              aria-live="polite"
              aria-label={`File deleted in ${formatCountdown(secondsLeft)}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4AF37] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D4AF37]" />
              </span>
              <span className="hidden sm:inline">file deleted in</span>
              <span className="tabular-nums text-[#D4AF37]">
                {formatCountdown(secondsLeft)}
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="rounded-full bg-[#0F172A] px-5 py-2.5 text-xs font-semibold tracking-[0.12em] text-white shadow-[0_10px_30px_rgba(15,23,42,0.2)] transition hover:bg-[#1E293B]"
            >
              RECOGNIZE ID
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
