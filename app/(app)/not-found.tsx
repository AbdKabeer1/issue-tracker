import Link from "next/link";
import { auth } from "@/auth";
import {
  StatusPage,
  primaryActionClass,
  secondaryActionClass,
} from "@/components/status-page";

/**
 * Shown when a signed-in page calls notFound(), e.g. an issue id that doesn't
 * exist or was deleted (#214). Anonymous visitors (link-preview fallbacks) get
 * a sign-in link, because the issue may simply need a session to view.
 */
export default async function AppNotFound() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <StatusPage
      code="404"
      title="We couldn't find that issue"
      actions={
        <>
          <Link href="/bugs" className={primaryActionClass}>
            Go to issues
          </Link>
          {signedIn ? null : (
            <Link href="/login" className={secondaryActionClass}>
              Sign in
            </Link>
          )}
        </>
      }
    >
      <p>
        The link may be wrong, or the issue may have been deleted.
        {signedIn ? null : " Some issues are only visible after you sign in."}
      </p>
    </StatusPage>
  );
}
