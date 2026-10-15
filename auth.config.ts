import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma / bcrypt).
 * Middleware must import this file only — never `@/auth` — or the Edge
 * bundle exceeds Vercel's 1 MB middleware limit.
 */
export default {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const id = token.id ?? token.sub;
        if (typeof id === "string" && id.length > 0) {
          session.user.id = id;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
