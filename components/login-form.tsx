"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { googleSignInAction, loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm({
  callbackUrl = "/bugs",
  googleEnabled = false,
}: {
  callbackUrl?: string;
  googleEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData();
        formData.set("email", email);
        formData.set("password", password);
        formData.set("callbackUrl", callbackUrl);
        startTransition(async () => {
          try {
            const result = await loginAction(undefined, formData);
            if (result?.error) {
              setError(result.error);
            }
            // Success uses server redirect() only — no client router.push
            // (avoids navigation storms with middleware redirects).
          } catch (error) {
            // Must rethrow NEXT_REDIRECT so the framework can navigate
            unstable_rethrow(error);
            setError("Something went wrong. Please try again.");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-teal-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {googleEnabled ? (
        <>
          <div className="relative py-1 text-center text-xs text-slate-400">
            <span className="bg-white px-2 relative z-10">or</span>
            <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await googleSignInAction();
                } catch (error) {
                  unstable_rethrow(error);
                  setError("Google sign-in failed. Please try again.");
                }
              });
            }}
          >
            Continue with Google
          </Button>
        </>
      ) : null}
    </form>
  );
}
