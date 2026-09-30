"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TOPICS = [
  "General question",
  "Privacy / DPDP rights (access, correction, erasure)",
  "Withdraw consent / delete my analytics data",
  "Wipe timer / ephemeral files",
  "Premium access",
] as const;

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>(TOPICS[0]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
        SUPPORT
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold text-[#0F172A]">
        Contact
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-[#64748B]">
        Reach Convert My File for product questions, wipe-timer clarification,
        Premium access, or privacy / DPDP rights requests (access, correction,
        erasure, withdraw consent). We never ask you to re-upload wiped files.
      </p>

      <div className="mt-6 rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] px-4 py-3 text-sm text-[#475569]">
        <p className="font-semibold text-[#0F172A]">
          Data Fiduciary / grievance contact
        </p>
        <p className="mt-1">
          Email{" "}
          <a
            className="font-semibold text-[#0F172A] underline"
            href="mailto:privacy@premiumutility.app?subject=Convert%20My%20File%20privacy%20request"
          >
            privacy@premiumutility.app
          </a>
          . For rights requests, use the Google email you signed in with. See
          the{" "}
          <Link href="/privacy" className="font-semibold text-[#0F172A] underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <form
        className="mt-10 space-y-5 rounded-[28px] border border-[#E8E2D6] bg-white p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const name = String(fd.get("name") || "");
          const email = String(fd.get("email") || "");
          const message = String(fd.get("message") || "");
          const subject = encodeURIComponent(
            `[Convert My File] ${topic} — ${name}`
          );
          const body = encodeURIComponent(
            `Topic: ${topic}\nName: ${name}\nEmail: ${email}\n\n${message}`
          );
          setSent(true);
          window.location.href = `mailto:privacy@premiumutility.app?subject=${subject}&body=${body}`;
        }}
      >
        <div>
          <Label htmlFor="topic">Topic</Label>
          <select
            id="topic"
            name="topic"
            value={topic}
            onChange={(e) =>
              setTopic(e.target.value as (typeof TOPICS)[number])
            }
            className="mt-2 flex h-11 w-full rounded-2xl border border-[#E8E2D6] bg-white px-3 text-sm text-[#0F172A]"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            required
            className="mt-2 h-11 rounded-2xl"
            placeholder="Your name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            className="mt-2 h-11 rounded-2xl"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            name="message"
            required
            className="mt-2 min-h-32 rounded-2xl"
            placeholder="How can we help? For erasure, mention the Google email used at login."
          />
        </div>
        {sent ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            Opening your email client to privacy@premiumutility.app…
          </p>
        ) : null}
        <Button
          type="submit"
          className="rounded-full bg-[#0F172A] px-6 text-white hover:bg-[#1E293B]"
        >
          Email privacy desk
        </Button>
      </form>

      <p className="mt-6 text-sm text-[#64748B]">
        Direct:{" "}
        <a
          className="font-semibold text-[#0F172A] underline"
          href="mailto:privacy@premiumutility.app"
        >
          privacy@premiumutility.app
        </a>
        {" · "}
        <Link href="/privacy" className="font-semibold text-[#0F172A] underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="font-semibold text-[#0F172A] underline">
          Terms
        </Link>
      </p>

      <Link
        href="/"
        className="mt-10 inline-flex rounded-full border border-[#E8E2D6] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A]"
      >
        Back to workspace
      </Link>
    </div>
  );
}
