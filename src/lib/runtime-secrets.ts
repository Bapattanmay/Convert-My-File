/**
 * Production fail-closed secret checks.
 * Dev keeps local fallbacks; production refuses missing AUTH / ADMIN config.
 */

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    process.env.RENDER_SERVICE_ID != null
  );
}

export function resolveAuthSecret(): string | null {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "";
  return secret.trim() || null;
}

export function resolveSessionSecret(): string | null {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "";
  return secret.trim() || null;
}

/** Throw (or return errors) when required production secrets are missing. */
export function assertProductionSecrets(): void {
  if (!isProductionRuntime()) return;

  const missing: string[] = [];
  if (!resolveAuthSecret()) {
    missing.push("AUTH_SECRET (or NEXTAUTH_SECRET / SESSION_SECRET)");
  }
  const admin = (process.env.ADMIN_EMAILS || "").trim();
  if (!admin) {
    missing.push("ADMIN_EMAILS");
  }
  if (missing.length) {
    throw new Error(
      `Convert My File refuse-to-start: missing required production secrets: ${missing.join(", ")}`
    );
  }
}
