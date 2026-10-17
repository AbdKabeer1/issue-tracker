"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        if (password.length < 8) {
          setError("Password must be at least 8 characters");
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        const formData = new FormData();
        formData.set("token", token);
        formData.set("password", password);
        formData.set("confirmPassword", confirmPassword);
        startTransition(async () => {
          try {
            const result = await resetPasswordAction(undefined, formData);
            if (result?.error) {
              setError(result.error);
            }
          } catch (error) {
            unstable_rethrow(error);
            setError("Something went wrong. Please try again.");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-slate-700"
        >
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError(null);
          }}
        />
        {password.length > 0 && password.length < 8 && !error ? (
          <p className="text-xs text-amber-600" aria-live="polite">
            Must be at least 8 characters
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-slate-700"
        >
          Confirm new password
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          visibilityLabel="confirm password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            if (error) setError(null);
          }}
        />
        {confirmPassword.length > 0 && password !== confirmPassword && !error ? (
          <p className="text-xs text-red-600" aria-live="polite">
            Passwords do not match
          </p>
        ) : confirmPassword.length > 0 && password === confirmPassword ? (
          <p className="text-xs text-emerald-600" aria-live="polite">
            Passwords match
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
