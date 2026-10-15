import type { NextAuthConfig } from "next-auth";
import { BASE_PATH } from "@/lib/base-path";

const isProd = process.env.NODE_ENV === "production";

/**
 * Edge-safe Auth.js config (no Prisma / bcrypt).
 * Middleware must import this file only — never `@/auth` — or the Edge
 * bundle exceeds Vercel's 1 MB middleware limit.
 */
export default {
  basePath: `${BASE_PATH}/api/auth`,
  providers: [],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: `${BASE_PATH}/login`,
    error: `${BASE_PATH}/login`,
  },
  trustHost: true,
  useSecureCookies:
    isProd && !process.env.AUTH_URL?.startsWith("http://localhost"),

  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return url.startsWith(BASE_PATH)
          ? `${baseUrl}${url}`
          : `${baseUrl}${BASE_PATH}${url}`;
      }
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) {
          if (!parsed.pathname.startsWith(BASE_PATH)) {
            parsed.pathname = `${BASE_PATH}${parsed.pathname}`;
          }
          return parsed.toString();
        }
      } catch {
        // Fallback to default bugs page below
      }
      return `${baseUrl}${BASE_PATH}/bugs`;
    },

    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }
      if (user?.role) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const id = token.id ?? token.sub;
        if (typeof id === "string" && id.length > 0) {
          session.user.id = id;
        }
        if (
          token.role === "user" ||
          token.role === "admin" ||
          token.role === "super_admin"
        ) {
          session.user.role = token.role;
        } else {
          session.user.role = "user";
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
