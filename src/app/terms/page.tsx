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
      <p className="mt-2 text-sm text-[#64748B]">Last updated: September 29, 2026</p>

      <div className="prose-premium mt-10 space-y-6 text-[15px] leading-relaxed text-[#334155]">
        <p>
          By using Convert My File you agree to these Terms. Core conversion,
          translation, merge, and size tools are offered on an as-is basis for
          lawful personal and business use. You must sign in with a Google
          account and accept these Terms and the Privacy Policy before using
          Converter, Translator, Merger, or Compressor.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Google sign-in and usage analytics
        </h2>
        <p>
          Access to the workspace tools requires Google OAuth Login. When you
          sign in, you consent to Convert My File receiving from Google (via
          Auth.js / NextAuth) your account name, email address, and profile
          picture when available, and to our collecting: time spent on the
          platform while signed in; which features you use (Converter,
          Translator, Merger, Compressor); and approximate location derived from
          browser geolocation (if you allow it) and/or your IP address. This
          data is used for platform operation, abuse prevention, and owner
          analytics. Details are in the{" "}
          <Link href="/privacy" className="font-semibold text-[#0F172A] underline">
            Privacy Policy
          </Link>
          .
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Ephemeral file processing
        </h2>
        <p>
          Uploaded file contents are handled in session memory for the active
          job. Files are wiped after download or automatically within three
          minutes if not retrieved. You are responsible for retaining copies of
          any outputs you need. Google identity and usage analytics are separate
          from file contents and may be retained longer on the server.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Acceptable use
        </h2>
        <p>
          Do not upload content you are not authorized to process, malware, or
          material that violates applicable law. Do not attempt to bypass Google
          Login, impersonate others, or abuse the service.
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
