import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/bug";
import authConfig from "@/auth.config";
import { cleanEnv } from "@/lib/env-clean";

const googleClientId = cleanEnv(
  process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
);
const googleClientSecret = cleanEnv(
  process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
);
const googleConfigured = Boolean(googleClientId) && Boolean(googleClientSecret);

if (process.env.NODE_ENV !== "test") {
  console.log("[auth:config] Initializing NextAuth with Google OAuth status:", {
    googleConfigured,
    clientIdPresent: Boolean(googleClientId),
    clientSecretPresent: Boolean(googleClientSecret),
    clientIdPrefix: googleClientId ? `${googleClientId.slice(0, 12)}…` : "none",
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),

    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        const email =
          typeof profile?.email === "string"
            ? profile.email.toLowerCase()
            : typeof user?.email === "string"
              ? user.email.toLowerCase()
              : null;
        if (email) {
          const name =
            (typeof profile?.name === "string" && profile.name) ||
            user?.name ||
            email.split("@")[0];
          const image =
            (typeof profile?.picture === "string" && profile.picture) ||
            (typeof user?.image === "string" ? user.image : undefined);

          const rawSuperAdmin =
            cleanEnv(process.env.SUPER_ADMIN_EMAIL) ||
            cleanEnv(process.env.SUPER_ADMIN_EMAILS) ||
            "";
          const superAdminEmails = rawSuperAdmin
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const isSuperAdmin = superAdminEmails.includes(email);

          let dbUser = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              dbUser = await prisma.user.upsert({
                where: { email },
                create: {
                  email,
                  name,
                  image,
                  emailVerified: new Date(),
                  ...(isSuperAdmin ? { role: "super_admin" } : {}),
                },
                update: {
                  name,
                  ...(image ? { image } : {}),
                  emailVerified: new Date(),
                  ...(isSuperAdmin ? { role: "super_admin" } : {}),
                },
              });
              break;
            } catch (dbError) {
              console.error(
                `[auth] Google user upsert attempt ${attempt} failed:`,
                dbError,
              );
              if (attempt === 3) throw dbError;
              await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
            }
          }

          if (dbUser) {
            token.id = dbUser.id;
            token.sub = dbUser.id;
            token.role = dbUser.role;
            return token;
          }
        }
      }

      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }
      if (user?.role) {
        token.role = user.role;
      }
      return token;
    },
  },
});
