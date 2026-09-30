import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { upsertGoogleSession } from "@/lib/usage-store";
import {
  isProductionRuntime,
  resolveAuthSecret,
} from "@/lib/runtime-secrets";

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function authSecret(): string {
  const secret = resolveAuthSecret();
  if (secret) return secret;
  // Fail-closed at runtime in production; allow build phase without secrets.
  if (isProductionRuntime() && !isBuildPhase()) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET / SESSION_SECRET) is required in production."
    );
  }
  return "convert-my-file-dev-secret-change-me";
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export const authConfig = {
  providers: [
    Google({
      // Placeholders keep the provider registered when secrets are missing;
      // sign-in fails until real GOOGLE_CLIENT_* values are set.
      clientId: process.env.GOOGLE_CLIENT_ID || "not-configured",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "not-configured",
    }),
  ],
  secret: authSecret(),
  trustHost: true,
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "google") {
        const googleSub = String(
          (profile as { sub?: string } | undefined)?.sub ||
            account.providerAccountId ||
            user?.id ||
            ""
        );
        const name = String(profile?.name || user?.name || "Google User").slice(
          0,
          120
        );
        const email = String(profile?.email || user?.email || "").slice(0, 200);
        const picture =
          (typeof (profile as { picture?: string } | undefined)?.picture ===
          "string"
            ? (profile as { picture: string }).picture
            : user?.image) || undefined;

        const usage = await upsertGoogleSession({
          googleSub,
          name,
          email,
          picture,
        });
        token.usageSessionId = usage.id;
        token.name = usage.name;
        token.email = usage.email;
        token.picture = usage.picture;
        token.googleSub = googleSub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string) || session.user.name;
        session.user.email = (token.email as string) || session.user.email;
        session.user.image =
          (token.picture as string | undefined) || session.user.image;
      }
      session.usageSessionId = token.usageSessionId as string | undefined;
      session.googleSub = token.googleSub as string | undefined;
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
