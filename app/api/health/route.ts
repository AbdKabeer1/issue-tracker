import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanEnv } from "@/lib/env-clean";

export const dynamic = "force-dynamic";

export async function GET() {
  const googleClientId = cleanEnv(
    process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
  );
  const googleClientSecret = cleanEnv(
    process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
  );

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    console.error("[health] Database ping failed:", error);
  }

  return NextResponse.json({
    status: dbOk ? "healthy" : "degraded",
    uptime: process.uptime(),
    db: dbOk,
    auth: {
      googleConfigured: Boolean(googleClientId) && Boolean(googleClientSecret),
      clientIdPrefix: googleClientId ? `${googleClientId.slice(0, 10)}…` : null,
      authSecretSet: Boolean(
        cleanEnv(process.env.AUTH_SECRET) || cleanEnv(process.env.NEXTAUTH_SECRET),
      ),
    },
  });
}
