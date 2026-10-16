import { BrandLockup } from "@/components/brand-lockup";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

/**
 * Authenticated users are redirected to /bugs by middleware (`auth` wrapper).
 * Google OAuth is the primary sign-in mechanism for Zedu Bugs.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    reason?: string;
  }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <BrandLockup size="md" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          Sign in to Zedu Bugs
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Sign in with your Google account to report, vote, and track bugs.
        </p>

        {params.error ? (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">
              {params.error === "OAuthCallbackError" ||
              params.error === "Configuration"
                ? "Unable to complete Google sign-in. Please try again."
                : "Authentication failed. Please try again."}
            </p>
            {params.reason ? (
              <p className="mt-1.5 font-mono text-xs text-red-800 break-words">
                Diagnostic: {params.reason}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <GoogleSignInButton callbackUrl={callbackUrl} />
        </div>
      </div>
    </main>
  );
}
