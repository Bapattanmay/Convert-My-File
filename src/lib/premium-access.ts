/**
 * Premium entitlement.
 * - Env allowlist PREMIUM_EMAILS (default includes owner for testing)
 * - Mock Upgrade: client stores unlock in localStorage; server also accepts
 *   POST /api/premium/upgrade which sets an httpOnly cookie for the session email
 */

export function premiumEmails(): string[] {
  const raw =
    process.env.PREMIUM_EMAILS ||
    process.env.ADMIN_EMAILS ||
    "bapattanmay@gmail.com";
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isPremiumEmail(email?: string | null): boolean {
  if (!email) return false;
  return premiumEmails().includes(email.trim().toLowerCase());
}

export const PREMIUM_COOKIE = "cmf_premium";
export const PREMIUM_LS_KEY = "cmf_premium_emails";

export type PremiumStatus = {
  isPremium: boolean;
  source: "allowlist" | "upgrade" | "none";
  email?: string;
};

/** Client helper — localStorage mock unlock (also synced via cookie API). */
export function readLocalPremiumEmails(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREMIUM_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((e) => String(e).toLowerCase())
      : [];
  } catch {
    return [];
  }
}

export function writeLocalPremiumEmail(email: string) {
  if (typeof window === "undefined") return;
  const set = new Set(readLocalPremiumEmails());
  set.add(email.trim().toLowerCase());
  localStorage.setItem(PREMIUM_LS_KEY, JSON.stringify([...set]));
}
