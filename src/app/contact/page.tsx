"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
        SUPPORT
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold text-[#0F172A]">
        Contact
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-[#64748B]">
        Reach the Convert My File desk for privacy questions, wipe-timer
        clarification, or Premium identity onboarding. We never ask you to
        re-upload wiped files.
      </p>

      <form
        className="mt-10 space-y-5 rounded-[28px] border border-[#E8E2D6] bg-white p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            className="mt-2 h-11 rounded-2xl"
            placeholder="Your name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
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
            required
            className="mt-2 min-h-32 rounded-2xl"
            placeholder="How can we help?"
          />
        </div>
        {sent ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            Message queued locally. In this demo build nothing is transmitted.
          </p>
        ) : null}
        <Button
          type="submit"
          className="rounded-full bg-[#0F172A] px-6 text-white hover:bg-[#1E293B]"
        >
          Send message
        </Button>
      </form>

      <p className="mt-6 text-sm text-[#64748B]">
        Or email{" "}
        <a
          className="font-semibold text-[#0F172A] underline"
          href="mailto:privacy@premiumutility.app"
        >
          privacy@premiumutility.app
        </a>
        .
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
