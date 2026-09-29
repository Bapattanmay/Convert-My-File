import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const USER_COOKIE = "cmf_session";
const ADMIN_COOKIE = "cmf_admin";

function secretKey() {
  const secret =
    process.env.SESSION_SECRET || "convert-my-file-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export type UserToken = { sid: string; name: string; role: "user" };
export type AdminToken = { role: "admin"; sub: string };

export async function signUserToken(payload: UserToken): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function signAdminToken(sub: string): Promise<string> {
  return new SignJWT({ role: "admin", sub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function verifyUserToken(
  token: string
): Promise<UserToken | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "user" || typeof payload.sid !== "string") return null;
    return {
      sid: payload.sid,
      name: String(payload.name || ""),
      role: "user",
    };
  } catch {
    return null;
  }
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

export async function readUserSession(): Promise<UserToken | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  if (!token) return null;
  return verifyUserToken(token);
}

export async function readAdminSession(): Promise<AdminToken | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export { USER_COOKIE, ADMIN_COOKIE };
