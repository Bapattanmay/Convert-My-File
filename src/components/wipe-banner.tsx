import { Eraser } from "lucide-react";

export function WipeBanner() {
  return (
    <section className="bg-gradient-to-r from-[#0F172A] via-[#101828] to-[#0F172A]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-11 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B1220] text-[#D4AF37] ring-1 ring-[#D4AF37]/35 shadow-[0_0_24px_rgba(212,175,55,0.15)]">
            <Eraser className="h-5 w-5" />
          </span>
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Secure wipe is always on.
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
              After upload, the header timer counts down from 3:00. Download to
              keep your result — or let the wipe finish and the session forgets
              the file entirely.
            </p>
          </div>
        </div>
        <a
          href="#tools"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-[#0F172A] shadow-[0_10px_30px_rgba(212,175,55,0.25)] transition hover:-translate-y-0.5 hover:bg-[#C5A880]"
        >
          Start a secure job
        </a>
      </div>
    </section>
  );
}
