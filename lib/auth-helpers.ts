import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { resolveSessionUserId } from "@/lib/session-user";

/**
 * App-layout gate. Uses the same JWT session as edge middleware (auth.config).
 * Missing session → redirect to login.
 * Stale JWT (cookie present, user gone from DB) → signOut to clear cookie,
 * then login — avoids middleware bouncing /login ↔ /bugs.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const resolved = await resolveSessionUserId();
  if ("error" in resolved) {
    // Clears Auth.js cookies, then redirects (does not return).
    await signOut({ redirectTo: "/login" });
    throw new Error("unreachable: signOut redirects");
  }

  return { ...session.user, id: resolved.userId };
}
