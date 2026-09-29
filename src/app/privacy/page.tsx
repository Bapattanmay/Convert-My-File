import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
        LEGAL
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold text-[#0F172A]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#64748B]">Last updated: September 28, 2026</p>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-[#334155]">
        <p>
          Convert My File is built around zero persistence. File contents
          processed in the browser workspace are not uploaded to a long-term
          archive and are discarded when you download or when the three-minute
          wipe completes.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          What we process
        </h2>
        <p>
          Document bytes stay in your session for the active job. We do not sell
          file contents. Optional “Recognize ID” / Premium flows may collect
          identity metadata only when you explicitly opt in; core tools do not
          require an account.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Wipe timer
        </h2>
        <p>
          After upload, a countdown warns that idle files will be erased. This
          is a privacy control, not a bug. Download promptly if you need the
          result.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Contact
        </h2>
        <p>
          Privacy questions:{" "}
          <Link href="/contact" className="font-semibold text-[#0F172A] underline">
            Contact
          </Link>
          .
        </p>
      </div>

      <Link
        href="/"
        className="mt-12 inline-flex rounded-full bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Back to workspace
      </Link>
    </div>
  );
}
