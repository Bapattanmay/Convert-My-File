"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Files } from "lucide-react";
import { useWipeTimer, formatCountdown } from "@/components/wipe-provider";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/login-dialog";

export function SiteHeader() {
  const pathname = usePathname();
  const { active, secondsLeft } = useWipeTimer();
  const { user, loading, setLoginOpen, logout } = useAuth();

  if (pathname?.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#E6DFD2]/70 bg-[#F7F4EE]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-[#D4AF37] shadow-[0_10px_28px_rgba(15,23,42,0.22)] transition duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_14px_32px_rgba(15,23,42,0.28)]">
            <Files className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[0.04em] text-[#0F172A] sm:text-[17px]">
              Convert My File
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] text-[#64748B]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.7)]" />
              SECURE PROTOCOL V2.4
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {active && secondsLeft !== null ? (
            <div
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-4 py-2.5 text-xs font-semibold tracking-wide text-white shadow-[0_12px_32px_rgba(15,23,42,0.28)] animate-in fade-in zoom-in-95 duration-300"
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
          ) : null}

          {!loading && user ? (
            <div className="flex items-center gap-2">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt=""
                  className="hidden h-8 w-8 rounded-full ring-1 ring-[#E6DFD2] sm:block"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <span className="hidden max-w-[160px] truncate text-xs font-semibold text-[#475569] sm:inline">
                {user.name}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-full border border-[#E6DFD2] bg-white/80 px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-[#0F172A] transition hover:bg-white"
              >
                Log out
              </button>
            </div>
          ) : !loading ? (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="rounded-full bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-5 py-2.5 text-xs font-semibold tracking-[0.12em] text-white shadow-[0_12px_32px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.28)]"
            >
              Login
            </button>
          ) : null}
        </div>
      </div>
      <div className="gold-hairline h-px w-full" />
      <LoginDialog />
    </header>
  );
}
