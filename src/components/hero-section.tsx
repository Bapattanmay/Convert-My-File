export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#E6DFD2]/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 14% 20%, rgba(212,175,55,0.22), transparent 40%), radial-gradient(circle at 86% 12%, rgba(15,23,42,0.07), transparent 38%), linear-gradient(160deg, rgba(255,252,246,0.9) 0%, rgba(246,242,234,0.5) 55%, rgba(239,234,225,0.85) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-8 h-80 w-80 rounded-full border border-[#C5A880]/25 animate-in fade-in duration-1000"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 top-28 h-52 w-52 rounded-full border border-[#0F172A]/08"
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
        <p className="text-xs font-semibold tracking-[0.24em] text-[#C5A880] animate-in fade-in slide-in-from-bottom-2 duration-700">
          PRIVATE · EPHEMERAL · PRECISE
        </p>
        <p className="mt-4 font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.08em] text-[#0F172A]/70 sm:text-base">
          Convert My File
        </p>
        <h1 className="mt-3 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.5rem,7vw,5.4rem)] font-bold leading-[0.94] tracking-[-0.035em] text-[#0F172A] animate-in fade-in slide-in-from-bottom-3 duration-700">
          REDEFINING
          <br />
          FILE HANDLING.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[#475569] sm:text-lg animate-in fade-in slide-in-from-bottom-4 duration-1000">
          Convert, translate, merge, and resize files in a zero-stack workspace
          that forgets everything the moment you leave.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href="#tools"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-7 py-3.5 text-sm font-semibold tracking-wide text-white shadow-[0_16px_44px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.3)]"
          >
            Open workspace
          </a>
          <a
            href="#zero-stack"
            className="inline-flex items-center justify-center rounded-full border border-[#0F172A]/12 bg-white/75 px-7 py-3.5 text-sm font-semibold tracking-wide text-[#0F172A] shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur transition hover:border-[#C5A880] hover:bg-white"
          >
            How privacy works
          </a>
        </div>
      </div>
    </section>
  );
}
