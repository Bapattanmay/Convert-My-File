import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[#1E293B] bg-gradient-to-b from-[#0F172A] to-[#0B1220] text-[#E8E2D6]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 0%, rgba(212,175,55,0.12), transparent 45%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.04em]">
              Convert My File
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">
              Military-grade ephemeral processing. Zero persistence. Files
              exist only in your session and are securely wiped after download
              or within three minutes.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#334155]/80 bg-[#101828]/80 px-3 py-1.5 text-[11px] font-medium tracking-wide text-[#C5A880] backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              ZERO-PERSISTENCE ARCHITECTURE
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium">
            <Link
              href="/privacy"
              className="text-[#CBD5E1] transition hover:text-[#D4AF37]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-[#CBD5E1] transition hover:text-[#D4AF37]"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="text-[#CBD5E1] transition hover:text-[#D4AF37]"
            >
              Contact
            </Link>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[#1E293B] pt-6 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Convert My File. All rights reserved.</p>
          <p>● SECURE PROTOCOL V2.4</p>
        </div>
      </div>
    </footer>
  );
}
