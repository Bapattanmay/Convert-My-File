import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
        LEGAL
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold text-[#0F172A]">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-[#64748B]">Last updated: September 28, 2026</p>

      <div className="prose-premium mt-10 space-y-6 text-[15px] leading-relaxed text-[#334155]">
        <p>
          By using Convert My File you agree to process files only in the
          ephemeral client workspace provided by the service. Core conversion,
          translation, merge, and size tools are offered on an as-is basis for
          lawful personal and business use.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Ephemeral processing
        </h2>
        <p>
          Uploaded material is handled in session memory. Files are wiped after
          download or automatically within three minutes if not retrieved. You
          are responsible for retaining copies of any outputs you need.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Acceptable use
        </h2>
        <p>
          Do not upload content you are not authorized to process, malware, or
          material that violates applicable law. Premium identity features, when
          enabled, remain subject to additional verification terms.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Liability
        </h2>
        <p>
          Outputs are generated for convenience. Verify critical documents
          before relying on them. Convert My File is not liable for data loss
          resulting from the intentional wipe timer or session discard.
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
