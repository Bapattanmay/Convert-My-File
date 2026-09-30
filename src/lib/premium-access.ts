/**
 * Premium entitlement — server allowlist only (PREMIUM_EMAILS).
 * No client-side mock unlock. Paid checkout is coming soon
 * (India: Razorpay or Cashfree recommended next).
 */

import { isProductionRuntime } from "@/lib/runtime-secrets";

export function premiumEmails(): string[] {
  const raw = process.env.PREMIUM_EMAILS || "";
  if (!raw.trim()) {
    // Dev convenience only — never invent allowlist in production
    if (!isProductionRuntime()) {
      return ["bapattanmay@gmail.com"];
    }
    return [];
  }
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isPremiumEmail(email?: string | null): boolean {
  if (!email) return false;
  return premiumEmails().includes(email.trim().toLowerCase());
}

export type PremiumStatus = {
  isPremium: boolean;
  source: "allowlist" | "none";
  email?: string;
  /** Present when client asked to purchase — payments not live yet. */
  payments?: "coming_soon";
  paymentProvidersIndia?: string[];
};
