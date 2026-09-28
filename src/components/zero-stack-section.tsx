import { Lock, Timer, Trash2 } from "lucide-react";

export function ZeroStackSection() {
  return (
    <section
      id="zero-stack"
      className="border-b border-[#E8E2D6] bg-[#F7F4EE]"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
            ZERO-STACK ENVIRONMENT
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            An ephemeral env that never keeps your files.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#64748B]">
            Processing happens in an isolated client session. There is no cloud
            archive, no recovery vault, and no silent sync. When the wipe timer
            hits zero — or the moment you download — the workspace is cleared.
          </p>
        </div>

        <div className="rounded-[32px] border border-[#E8E2D6] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
          <ul className="space-y-5">
            {[
              {
                icon: Lock,
                title: "Session-bound memory",
                body: "Bytes stay in the browser sandbox for the active job only.",
              },
              {
                icon: Timer,
                title: "3-minute wipe clock",
                body: "Idle uploads auto-delete. The navy timer in the header tracks it.",
              },
              {
                icon: Trash2,
                title: "Secure discard",
                body: "Download completes the lifecycle; leftover blobs are revoked.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#101828] text-[#D4AF37]">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-[#0F172A]">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
