import { Layers3, ShieldOff, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Precision tooling",
    body: "Convert formats, translate documents, merge packs, and hit exact KB/MB targets without leaving the browser.",
  },
  {
    icon: ShieldOff,
    title: "Zero persistence",
    body: "Google Login unlocks tools; file bytes stay in memory and vanish on download or after the three-minute wipe — not archived with your account.",
  },
  {
    icon: Layers3,
    title: "One calm surface",
    body: "A single workspace for every file job — navy, gold, and cream — designed for focus instead of dashboard clutter.",
  },
];

export function FeatureCards() {
  return (
    <section className="border-b border-[#E6DFD2]/80 bg-[#FBF9F5]/60">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
            BUILT FOR DISCRETION
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            File work that leaves no footprint.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#64748B]">
            Convert My File keeps the ritual simple: upload, shape the result,
            preview, download — then the session erases itself.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="group rounded-[28px] border border-[#E6DFD2]/90 bg-white/90 p-7 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-[#C5A880]/70 hover:shadow-[0_26px_64px_rgba(15,23,42,0.1)]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-[#D4AF37] shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition group-hover:scale-105">
                <feature.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
