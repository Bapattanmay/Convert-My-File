export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#E8E2D6] bg-[#F7F4EE]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(197,168,128,0.28), transparent 42%), radial-gradient(circle at 88% 8%, rgba(15,23,42,0.08), transparent 36%), linear-gradient(135deg, transparent 0%, rgba(232,226,214,0.65) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full border border-[#C5A880]/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 top-28 h-48 w-48 rounded-full border border-[#0F172A]/10"
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <p className="animate-in fade-in slide-in-from-bottom-2 duration-700 text-xs font-semibold tracking-[0.22em] text-[#C5A880]">
          PRIVATE · EPHEMERAL · PRECISE
        </p>
        <h1 className="mt-5 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.4rem,7vw,5.2rem)] font-bold leading-[0.95] tracking-[-0.03em] text-[#0F172A]">
          REDEFINING
          <br />
          FILE HANDLING.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[#475569] sm:text-lg">
          Convert, translate, merge, and resize files in a zero-stack workspace
          that forgets everything the moment you leave.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#tools"
            className="inline-flex items-center justify-center rounded-full bg-[#0F172A] px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_14px_40px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-[#1E293B]"
          >
            Open workspace
          </a>
          <a
            href="#zero-stack"
            className="inline-flex items-center justify-center rounded-full border border-[#0F172A]/15 bg-white/70 px-6 py-3 text-sm font-semibold tracking-wide text-[#0F172A] backdrop-blur transition hover:border-[#C5A880] hover:text-[#101828]"
          >
            How privacy works
          </a>
        </div>
      </div>
    </section>
  );
}
