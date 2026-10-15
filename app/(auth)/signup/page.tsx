import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { SignupForm } from "@/components/signup-form";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

/** Authenticated redirect is handled solely by middleware (`auth` wrapper). */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BrandLockup size="md" />
        <h1 className="mt-3 text-lg font-medium text-slate-900">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign up with email and password to report and vote on bugs.
        </p>
        <div className="mt-6">
          <SignupForm callbackUrl={callbackUrl} />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-teal-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
