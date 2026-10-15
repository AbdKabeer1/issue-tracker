import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/bug";
import authConfig from "@/auth.config";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

          const dbUser = await prisma.user.upsert({
            where: { email },
            create: {
              email,
              name,
              image,
              emailVerified: new Date(),
            },
            update: {
              name,
              ...(image ? { image } : {}),
              emailVerified: new Date(),
            },
          });
          token.id = dbUser.id;
          token.sub = dbUser.id;
          token.role = dbUser.role;
          return token;
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
