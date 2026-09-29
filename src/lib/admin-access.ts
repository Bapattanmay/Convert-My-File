import { auth } from "@/auth";
import { isAdminEmail, type AdminActor } from "@/lib/admin-auth";

export type AdminAccess =
  | { status: "ok"; admin: AdminActor }
  | { status: "unauthenticated" }
  | { status: "forbidden"; email: string };

/**
 * Resolve /admin access without collapsing "not signed in" into a bare 404.
 * - ok → allowlisted Google session
 * - unauthenticated → show sign-in gate
 * - forbidden → signed-in but not allowlisted (keep 404)
 */
export async function resolveAdminAccess(): Promise<AdminAccess> {
  const session = await auth();
  const email = session?.user?.email?.trim() || "";
  if (!email) return { status: "unauthenticated" };
  if (!isAdminEmail(email)) {
    return { status: "forbidden", email };
  }
  return {
    status: "ok",
    admin: {
      email,
      name: session?.user?.name,
      image: session?.user?.image,
    },
  };
}
