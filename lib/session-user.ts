import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const SESSION_EXPIRED_MESSAGE =
  "Session expired, sign in again";

/**
 * A session is current only while its stamped version matches the user's
 * (#208). Sessions issued before versions existed carry none and count as 0,
 * so nobody is signed out by the deploy itself, only by a password reset.
 */
export function isSessionVersionCurrent(
  sessionVersion: number | null | undefined,
  userVersion: number,
): boolean {
  return (sessionVersion ?? 0) === userVersion;
}

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
  const sessionVersion = session?.user?.sessionVersion;

  if (!sessionId && !email) {
    return { error: SESSION_EXPIRED_MESSAGE };
  }

  if (sessionId) {
    const byId = await prisma.user.findUnique({
      where: { id: sessionId },
      select: { id: true, sessionVersion: true },
    });
    if (byId) {
      if (!isSessionVersionCurrent(sessionVersion, byId.sessionVersion)) {
        return { error: SESSION_EXPIRED_MESSAGE };
      }
      return { userId: byId.id };
    }
  }

  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, sessionVersion: true },
    });
    if (byEmail) {
      if (!isSessionVersionCurrent(sessionVersion, byEmail.sessionVersion)) {
        return { error: SESSION_EXPIRED_MESSAGE };
      }
      return { userId: byEmail.id };
    }
  }

  return { error: SESSION_EXPIRED_MESSAGE };
}
