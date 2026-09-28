import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E8E2D6] bg-[#0F172A] text-[#E8E2D6]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.08em]">
              PREMIUM UTILITY.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">
              Military-grade ephemeral processing. Zero persistence. Files
              exist only in your session and are securely wiped after download
              or within three minutes.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#334155] bg-[#101828] px-3 py-1.5 text-[11px] font-medium tracking-wide text-[#C5A880]">
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
          <p>© {new Date().getFullYear()} Premium Utility. All rights reserved.</p>
          <p>● SECURE PROTOCOL V2.4</p>
        </div>
      </div>
    </footer>
  );
}
