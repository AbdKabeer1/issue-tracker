import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { ACTIVE_ROLE_COOKIE_NAME } from "@/lib/roles";

/**
 * Clears an invalid session and sends the user to sign in again.
 *
 * Server Components can't modify cookies, so `requireUser()` redirects here
 * instead of calling `signOut()` itself, which used to crash the page with
 * "Cookies can only be modified in a Server Action or Route Handler". Reached
 * when the session belongs to a deleted user, or was issued before a password
 * reset (#208).
 */
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ROLE_COOKIE_NAME);
  await signOut({ redirectTo: "/login?expired=1" });
}
