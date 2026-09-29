"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminSignInGate() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F0E8] px-5 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37]">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="mt-6 font-[family-name:var(--font-admin-sans)] text-2xl font-bold tracking-tight text-[#0F172A]">
        Admin sign-in required
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#64748B]">
        Sign in with an allowlisted Google account to open the usage dashboard.
        Only emails listed in <code className="text-[#0F172A]">ADMIN_EMAILS</code>{" "}
        can access this page.
      </p>
      <Button
        type="button"
        className="mt-8 rounded-full bg-[#0F172A] px-6 text-white hover:bg-[#1E293B]"
        onClick={() => void signIn("google", { callbackUrl: "/admin" })}
      >
        Sign in with Google
      </Button>
      <Link
        href="/"
        className="mt-6 text-xs font-medium text-[#94A3B8] underline hover:text-[#0F172A]"
      >
        ← Back to Convert My File
      </Link>
    </div>
  );
}
