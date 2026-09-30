import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  isProductionRuntime,
  resolveSessionSecret,
} from "@/lib/runtime-secrets";

const USER_COOKIE = "cmf_session";
const ADMIN_COOKIE = "cmf_admin";

function secretKey() {
  const secret = resolveSessionSecret();
  if (!secret) {
    const building =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build";
    if (isProductionRuntime() && !building) {
      throw new Error(
        "SESSION_SECRET (or AUTH_SECRET / NEXTAUTH_SECRET) is required in production."
      );
    }
    return new TextEncoder().encode("convert-my-file-dev-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export type UserToken = {
  sid: string;
  name: string;
  role: "user";
  email?: string;
  picture?: string;
};
export type AdminToken = { role: "admin"; sub: string };

export async function signAdminToken(sub: string): Promise<string> {
  return new SignJWT({ role: "admin", sub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminToken | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "admin") return null;
    return { role: "admin", sub: String(payload.sub || "admin") };
  } catch {
    return null;
  }
}

/** Prefer Google / Auth.js session; legacy name cookie is no longer issued. */
export async function readUserSession(): Promise<UserToken | null> {
  const session = await auth();
  if (session?.usageSessionId) {
    return {
      sid: session.usageSessionId,
      name: session.user?.name || "",
      email: session.user?.email || undefined,
      picture: session.user?.image || undefined,
      role: "user",
    };
  }
  return null;
}

export async function readAdminSession(): Promise<AdminToken | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export { USER_COOKIE, ADMIN_COOKIE };
