import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    usageSessionId?: string;
    googleSub?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usageSessionId?: string;
    googleSub?: string;
    picture?: string;
  }
}
