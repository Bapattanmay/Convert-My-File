import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Convert My File",
  description:
    "Terms of Service for Convert My File, including Google Login, ephemeral file processing, and Premium use.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
        LEGAL
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold text-[#0F172A]">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-[#64748B]">
        Last updated: September 30, 2026
      </p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[#334155]">
        <p>
          These Terms govern your use of{" "}
          <strong className="text-[#0F172A]">Convert My File</strong> at{" "}
          <a
            href="https://convert-my-file-oo3r.onrender.com"
            className="font-semibold text-[#0F172A] underline"
          >
            convert-my-file-oo3r.onrender.com
          </a>
          . By signing in with Google and using Converter, Translator, Merger,
          Compressor, or Premium workflows, you agree to these Terms and the{" "}
          <Link href="/privacy" className="font-semibold text-[#0F172A] underline">
            Privacy Policy
          </Link>
          .
        </p>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            1. The service
          </h2>
          <p className="mt-3">
            Convert My File offers browser-based utilities to convert,
            translate, merge, compress, and (for Premium) batch or edit files.
            Features are provided as-is for lawful personal and internal
            business use. Availability may change as we improve or redeploy the
            product.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            2. Google sign-in and consent
          </h2>
          <p className="mt-3">
            Workspace tools require Google OAuth Login. Before continuing you
            must accept these Terms and the Privacy Policy. You consent to our
            receiving from Google (via Auth.js / NextAuth) your name, email, and
            profile picture when available, and to our recording time spent,
            features used, and approximate location (browser geolocation and/or
            IP-based). Details are in the Privacy Policy. You must be at least
            18 years old to create a session and use the tools.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            3. Ephemeral file processing
          </h2>
          <p className="mt-3">
            Uploaded file contents are handled in session memory for the active
            job. Files are wiped after download or automatically within about
            three minutes if not retrieved. You are responsible for keeping
            copies of any outputs you need. Google identity and usage analytics
            are separate from file contents and may be retained longer on the
            server (including Postgres when configured).
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            4. Acceptable use
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Process only content you are authorized to handle; do not upload
              malware or unlawful material.
            </li>
            <li>
              Do not bypass Google Login, impersonate others, scrape the service
              abusively, or attack the infrastructure.
            </li>
            <li>
              Do not use Translator / Premium language batch to send passwords,
              payment card numbers, or other secrets to third-party translation
              APIs.
            </li>
            <li>
              Respect rate limits and fair-use capacity of free and Premium
              workflows.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            5. Premium and mock Upgrade
          </h2>
          <p className="mt-3">
            Some workflows are marked Premium. Access may be granted via an
            allowlisted email or a mock “Upgrade” path used for testing—no real
            payment processor is charged unless we clearly introduce paid
            billing later. Premium features remain subject to these Terms and
            ephemeral file handling. We may change Premium packaging or revoke
            mock upgrades for abuse.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            6. Outputs and your responsibility
          </h2>
          <p className="mt-3">
            Conversions, translations, merges, compressions, signatures, and
            edits are generated for convenience. Formats and quality can vary.
            Verify critical documents before relying on them. You are solely
            responsible for how you use outputs.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            7. Disclaimer and liability limits
          </h2>
          <p className="mt-3">
            The service is provided “as is” and “as available,” without
            warranties of uninterrupted availability, fitness for a particular
            purpose, or error-free output. To the fullest extent permitted by
            applicable law, Convert My File and its operators are not liable for
            indirect, incidental, special, or consequential damages, or for data
            loss arising from the intentional wipe timer, session discard,
            hosting redeploys, or third-party API failures (including Google,
            translation, or geo providers). Our aggregate liability for claims
            relating to the service is limited to the greater of (a) the amounts
            you paid us for Premium in the three months before the claim (if
            any), or (b) INR 1,000.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            8. Privacy
          </h2>
          <p className="mt-3">
            Personal data processing is described in the{" "}
            <Link href="/privacy" className="font-semibold text-[#0F172A] underline">
              Privacy Policy
            </Link>
            , including Data Fiduciary contact, retention, processors, and your
            rights under India’s DPDP Act, 2023.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            9. Suspension and changes
          </h2>
          <p className="mt-3">
            We may suspend access for security, abuse, or operational reasons.
            We may update these Terms; the “Last updated” date will change when
            we do. Continued use after posting constitutes acceptance of the
            updated Terms for future use.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            10. Contact
          </h2>
          <p className="mt-3">
            Questions about these Terms:{" "}
            <a
              className="font-semibold text-[#0F172A] underline"
              href="mailto:privacy@premiumutility.app"
            >
              privacy@premiumutility.app
            </a>{" "}
            or{" "}
            <Link href="/contact" className="font-semibold text-[#0F172A] underline">
              Contact
            </Link>
            .
          </p>
        </section>

        <p className="rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] px-4 py-3 text-sm text-[#64748B]">
          These Terms are product terms for Convert My File. They are not a
          substitute for advice from qualified legal counsel.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex rounded-full bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to workspace
        </Link>
        <Link
          href="/privacy"
          className="inline-flex rounded-full border border-[#E8E2D6] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A]"
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}
