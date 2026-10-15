import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const SESSION_EXPIRED_MESSAGE =
  "Session expired, sign in again";

/**
 * Resolve the Prisma User.id for the current JWT session.
 * After a DB reseed, the cookie may still hold a stale cuid — re-resolve by
 * email when possible; otherwise the caller should force re-login.
 */
export async function resolveSessionUserId(): Promise<
  { userId: string } | { error: string }
> {
  const session = await auth();
  const sessionId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();

  if (!sessionId && !email) {
    return { error: SESSION_EXPIRED_MESSAGE };
  }

  if (sessionId) {
    const byId = await prisma.user.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (byId) {
      return { userId: byId.id };
    }
  }

  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (byEmail) {
      return { userId: byEmail.id };
    }
  }

  return { error: SESSION_EXPIRED_MESSAGE };
}
