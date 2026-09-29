import { auth } from "@/auth";

/** Comma/space-separated allowlist. Default includes owner email. */
export function adminEmails(): string[] {
  // Prefer ADMIN_EMAILS only — do not fall back to legacy ADMIN_USERNAME
  // (which may be a non-email login id and would block real admins).
  const raw = process.env.ADMIN_EMAILS || "bapattanmay@gmail.com";
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export type AdminActor = {
  email: string;
  name?: string | null;
  image?: string | null;
};

/**
 * Returns allowlisted Google user, or null.
 * Callers must respond with 404 (not 403) when null.
 */
export async function requireAdmin(): Promise<AdminActor | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!isAdminEmail(email)) return null;
  return {
    email: email!,
    name: session?.user?.name,
    image: session?.user?.image,
  };
}
