import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { LoginForm } from "@/components/login-form";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

/**
 * Authenticated users are redirected to /bugs by middleware (`auth` wrapper).
 * Do not add a page-level session redirect here — mismatched checks caused
 * ERR_TOO_MANY_REDIRECTS with middleware.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BrandLockup size="md" />
        <p className="mt-3 text-sm text-slate-600">
          Sign in to report, vote, triage, and comment on bugs.
        </p>
        <div className="mt-6">
          <LoginForm
            callbackUrl={callbackUrl}
            googleEnabled={googleEnabled}
          />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-teal-700 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Demo: <span className="font-medium">alice@zendor.dev</span> /{" "}
          <span className="font-medium">12345678</span>
        </p>
      </div>
    </main>
  );
}
