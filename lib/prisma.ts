import "server-only";
import { PrismaClient } from "@prisma/client";
import { cleanEnv } from "@/lib/env-clean";

const cleanDbUrl = cleanEnv(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(cleanDbUrl ? { datasources: { db: { url: cleanDbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
