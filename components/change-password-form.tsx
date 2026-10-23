"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction, type ChangePasswordResult } from "@/app/actions/settings";
import { FieldError, useFieldErrors } from "@/components/ui/field-errors";
import { PasswordInput } from "@/components/ui/password-input";

const FORM_ID = "change-password";

const labelClass = "text-[13px] font-bold text-zk-text";
const inputWrap = "[&_input]:h-[46px] [&_input]:rounded-xl [&_input]:border-zk-border";

/** Lets a credentials user rotate their password without relying on SMTP (#570). */
export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { fieldErrors, show, clear, attrs } = useFieldErrors(FORM_ID, formRef);
  const [result, action, pending] = useActionState<ChangePasswordResult | undefined, FormData>(
    changePasswordAction,
    undefined,
  );

  useEffect(() => {
    if (!result) return;
    if (!result.ok) show(result);
    else clear();
  }, [result, show, clear]);

  return (
    <form ref={formRef} action={action} className={`space-y-4 ${inputWrap}`} noValidate>
      <div className="space-y-1.5">
        <label htmlFor="currentPassword" className={labelClass}>Current password</label>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required {...attrs("currentPassword")} />
        <FieldError formId={FORM_ID} field="currentPassword" errors={fieldErrors} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className={labelClass}>New password</label>
        <PasswordInput id="newPassword" name="password" autoComplete="new-password" minLength={8} required {...attrs("password")} />
        <FieldError formId={FORM_ID} field="password" errors={fieldErrors} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className={labelClass}>Confirm new password</label>
        <PasswordInput id="confirmPassword" name="confirmPassword" visibilityLabel="confirm new password" autoComplete="new-password" minLength={8} required {...attrs("confirmPassword")} />
        <FieldError formId={FORM_ID} field="confirmPassword" errors={fieldErrors} />
      </div>
      {result?.error && !result.field ? <p className="text-sm text-zk-bad-fg" role="alert">{result.error}</p> : null}
      {result?.ok ? <p className="text-sm text-zk-ok-fg" role="status">Password updated. Sign in again to continue.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-[46px] items-center justify-center rounded-full bg-electric-blue-strong px-5 text-sm font-bold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zk-chip disabled:text-zk-muted"
      >
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
