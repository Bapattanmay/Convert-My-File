import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Convert My File",
  description:
    "How Convert My File collects and uses personal data under India’s Digital Personal Data Protection Act, 2023 (DPDP).",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
        LEGAL
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold text-[#0F172A]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#64748B]">
        Last updated: September 30, 2026 · Aligned with India’s Digital Personal
        Data Protection Act, 2023 (DPDP)
      </p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[#334155]">
        <p>
          This notice explains how <strong className="text-[#0F172A]">Convert My File</strong>{" "}
          (“we”, “us”) processes personal data when you use{" "}
          <a
            href="https://convert-my-file-oo3r.onrender.com"
            className="font-semibold text-[#0F172A] underline"
          >
            convert-my-file-oo3r.onrender.com
          </a>{" "}
          and related pages. File contents are processed ephemerally in your
          session. Separately, we process limited account and usage data so you
          can sign in and so the operator can run and improve the service.
        </p>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            1. Data Fiduciary and grievance contact
          </h2>
          <p className="mt-3">
            <strong className="text-[#0F172A]">Convert My File</strong> is the
            Data Fiduciary for personal data described in this notice.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[#0F172A]">Grievance / privacy contact:</strong>{" "}
              <a
                className="font-semibold text-[#0F172A] underline"
                href="mailto:privacy@premiumutility.app"
              >
                privacy@premiumutility.app
              </a>
            </li>
            <li>
              Or use the{" "}
              <Link
                href="/contact"
                className="font-semibold text-[#0F172A] underline"
              >
                Contact
              </Link>{" "}
              form (select a privacy / rights request topic).
            </li>
          </ul>
          <p className="mt-3">
            We aim to acknowledge privacy requests within a few business days and
            to complete them within a reasonable period consistent with DPDP.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            2. Personal data we collect
          </h2>
          <p className="mt-3">Depending on how you use the product, we may process:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[#0F172A]">Google account data</strong> —
              name, email address, profile picture URL (when Google provides
              them), and a stable Google account subject identifier, obtained
              via Google OAuth (Auth.js / NextAuth). We do not receive your
              Google password.
            </li>
            <li>
              <strong className="text-[#0F172A]">Usage analytics</strong> —
              approximate time spent while signed in, features/tools used
              (Converter, Translator, Merger, Compressor, Premium workflows),
              session timestamps, and browser user-agent.
            </li>
            <li>
              <strong className="text-[#0F172A]">Location</strong> — if you
              allow browser geolocation: latitude and longitude, which we may
              reverse-geocode to city / region / country. If geolocation is
              denied or unavailable: approximate city / region / country and
              coordinates derived from your IP address via public geo/IP
              providers, plus a truncated IP used for that lookup.
            </li>
            <li>
              <strong className="text-[#0F172A]">Admin analytics views</strong> —
              the above fields may be shown to allowlisted operator accounts on
              the admin dashboard (visitors table, detail, exports).
            </li>
            <li>
              <strong className="text-[#0F172A]">Contact messages</strong> — if
              you email or submit the Contact form, the name, email, and message
              you choose to send.
            </li>
          </ul>
          <p className="mt-3">
            <strong className="text-[#0F172A]">File contents</strong> (documents,
            images, media you convert, merge, compress, translate, or edit) are{" "}
            <em>not</em> permanently archived by Convert My File. They are held
            in your browser/session for the active job and discarded on download
            or when the wipe timer completes (about three minutes if not
            retrieved).
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            3. Purpose of processing
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[#0F172A]">Service delivery</strong> —
              authenticate you with Google, unlock workspace tools, apply
              Premium allowlist / mock Upgrade where configured.
            </li>
            <li>
              <strong className="text-[#0F172A]">Security and abuse prevention</strong>{" "}
              — session integrity, rate-limiting context, and investigating
              misuse.
            </li>
            <li>
              <strong className="text-[#0F172A]">Operator analytics</strong> —
              understand which features are used, session duration, and
              approximate visitor location so the Data Fiduciary can operate and
              improve the platform.
            </li>
            <li>
              <strong className="text-[#0F172A]">Support</strong> — respond to
              privacy, rights, and product questions you send us.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            4. Notice and consent
          </h2>
          <p className="mt-3">
            Before Google Login, we show a notice that we receive your Google
            identity and record usage time, features used, and approximate
            location. You must accept the{" "}
            <Link href="/terms" className="font-semibold text-[#0F172A] underline">
              Terms of Service
            </Link>{" "}
            and this Privacy Policy (checkbox) to continue. Signing in and
            continued use of the tools after that acceptance constitutes your
            consent to the processing described here for those purposes.
          </p>
          <p className="mt-3">
            Browser geolocation is optional: your browser will ask separately.
            If you deny it, we fall back to IP-based approximation only.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            5. Your rights (Data Principal)
          </h2>
          <p className="mt-3">
            Under DPDP, you may request, as applicable:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[#0F172A]">Access</strong> — a summary of
              personal data we hold about you in our analytics store.
            </li>
            <li>
              <strong className="text-[#0F172A]">Correction</strong> — correction
              of inaccurate account or contact details we control (Google
              profile fields are corrected in your Google Account).
            </li>
            <li>
              <strong className="text-[#0F172A]">Erasure</strong> — deletion of
              your visitor/analytics record from our store, subject to limited
              retention needed for security or legal compliance.
            </li>
            <li>
              <strong className="text-[#0F172A]">Withdraw consent</strong> — stop
              using the tools, log out, revoke Convert My File access in your
              Google Account permissions, and/or email us to erase analytics
              data. Withdrawal does not affect processing already completed
              lawfully before withdrawal.
            </li>
          </ul>
          <p className="mt-3">
            Exercise rights by emailing{" "}
            <a
              className="font-semibold text-[#0F172A] underline"
              href="mailto:privacy@premiumutility.app"
            >
              privacy@premiumutility.app
            </a>{" "}
            from the Google email you used to sign in, or via{" "}
            <Link href="/contact" className="font-semibold text-[#0F172A] underline">
              Contact
            </Link>
            . Include enough detail for us to locate your record (email used at
            login).
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            6. Retention
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[#0F172A]">Files / job outputs</strong> —
              ephemeral; wiped after download or within about three minutes if
              not retrieved. Not stored as a lasting archive.
            </li>
            <li>
              <strong className="text-[#0F172A]">Account &amp; usage analytics</strong>{" "}
              — retained in the application analytics store. When{" "}
              <code className="text-xs">DATABASE_URL</code> is configured
              (typical production on Render), this is Postgres and survives
              redeploys. Otherwise a local JSON/file store may be used and can
              be lost on redeploy. We keep records for operation and improvement
              and may purge older sessions periodically.
            </li>
            <li>
              <strong className="text-[#0F172A]">Auth cookies</strong> — session
              cookies last for the Auth.js / NextAuth session lifetime; admin
              cookies for allowlisted operators are separate and time-limited.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            7. Sharing and processors
          </h2>
          <p className="mt-3">
            We do not sell your personal data. We use service providers that
            process data on our behalf or as independent controllers for their
            own auth products:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[#0F172A]">Google</strong> — OAuth sign-in
              and identity (Google’s own privacy terms apply to Google’s
              processing).
            </li>
            <li>
              <strong className="text-[#0F172A]">Render</strong> — application
              hosting and, when configured, managed Postgres for analytics.
            </li>
            <li>
              <strong className="text-[#0F172A]">Geo / IP providers</strong> —
              reverse-geocoding and IP location lookups (for example OpenStreetMap
              Nominatim, BigDataCloud, ip-api, ipwho.is, or similar) to resolve
              city and coordinates.
            </li>
            <li>
              <strong className="text-[#0F172A]">Translation APIs</strong> —
              when you use Translator or Premium multi-language batch, text you
              submit for translation may be sent to third-party translation
              services (for example MyMemory or configured fallbacks) to return
              a translation. Avoid submitting secrets or sensitive personal data
              in translate fields.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            8. Cross-border transfer
          </h2>
          <p className="mt-3">
            Convert My File is operated with infrastructure that may be located
            outside India (including Google authentication systems and Render
            hosting / databases). By using the service you understand that
            personal data described above may be transferred to and processed in
            other countries where those providers operate, subject to their
            safeguards and applicable law.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            9. Children
          </h2>
          <p className="mt-3">
            Convert My File is not directed at children under 18. We do not
            knowingly offer the workspace tools to persons under 18. If you
            believe a child’s data was provided, contact us for erasure.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            10. Security
          </h2>
          <p className="mt-3">
            We use HTTPS in production, HTTP-only session cookies where
            applicable, allowlisted admin access, truncated IP storage for
            approximate location, and ephemeral handling of file bytes in
            session. No method is perfectly secure; you remain responsible for
            the sensitivity of content you choose to process.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
            11. Changes
          </h2>
          <p className="mt-3">
            We may update this notice as the product or law changes. The “Last
            updated” date at the top will change when we do. Material changes
            may also be highlighted at login.
          </p>
        </section>

        <p className="rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] px-4 py-3 text-sm text-[#64748B]">
          This page is product notice copy describing Convert My File’s actual
          processing in DPDP-oriented language. It is not a substitute for
          advice from qualified legal counsel.
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
          href="/terms"
          className="inline-flex rounded-full border border-[#E8E2D6] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A]"
        >
          Terms of Service
        </Link>
        <Link
          href="/contact"
          className="inline-flex rounded-full border border-[#E8E2D6] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A]"
        >
          Contact / grievances
        </Link>
      </div>
    </div>
  );
}
