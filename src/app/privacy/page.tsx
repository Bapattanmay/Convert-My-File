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
      <p className="mt-2 text-sm text-[#64748B]">Last updated: September 29, 2026</p>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-[#334155]">
        <p>
          Convert My File processes file contents ephemerally in your browser
          session, while separately collecting limited usage analytics after
          Login so the platform owner can understand how the tools are used.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          What we collect after Login
        </h2>
        <p>When you log in and use the workspace, we collect and store:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-[#0F172A]">Name</strong> —
            the display name you enter at Login (not verified identity).
          </li>
          <li>
            <strong className="font-semibold text-[#0F172A]">Time spent</strong>{" "}
            — approximate active time on the site while signed in (heartbeat
            tracking).
          </li>
          <li>
            <strong className="font-semibold text-[#0F172A]">Features used</strong>{" "}
            — which tools you open (Converter, Translator, Merger, Compressor).
          </li>
          <li>
            <strong className="font-semibold text-[#0F172A]">Location</strong> —
            if you grant browser geolocation, we store latitude/longitude and
            may enrich with city/region/country from your IP. If geolocation is
            denied or unavailable, we store an IP-based approximate location
            (city, region, country, and IP) via a public geo lookup. Location is
            approximate and may be inaccurate.
          </li>
          <li>
            <strong className="font-semibold text-[#0F172A]">Technical</strong> —
            browser user-agent string and session timestamps.
          </li>
        </ul>
        <p>
          We do <em>not</em> permanently archive the contents of files you
          convert, translate, merge, or compress. File bytes stay in your
          session and are discarded on download or when the wipe timer
          completes.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Why we collect it
        </h2>
        <p>
          Analytics support platform operation, product improvement, abuse
          prevention, and an owner-only admin dashboard that shows aggregated
          and per-session usage (name, location, features, time spent).
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Storage and retention
        </h2>
        <p>
          Usage records are stored on the application server filesystem (JSON
          store under a configurable data directory). On hosting without a
          persistent disk (for example some free Render plans), data may be
          lost on redeploy. With a persistent disk attached, records survive
          restarts. We retain sessions for operational needs and may purge
          older records.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Cookies
        </h2>
        <p>
          We set an HTTP-only session cookie after Login to keep you signed in.
          Admin authentication uses a separate HTTP-only cookie.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0F172A]">
          Your choices
        </h2>
        <p>
          You may decline Login and browse informational pages, but tools will
          remain locked. You may deny browser geolocation; we then rely on
          IP-based approximation only. You may log out at any time.
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
