"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setWalletAddressAction, type WalletResult } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, useFieldErrors } from "@/components/ui/field-errors";
import { useToast } from "@/components/ui/toast";

const FORM_ID = "wallet-address";

/**
 * Set the EVM address points could later be sent to (#618).
 *
 * Saving an empty field clears it. Only you can change yours: the server takes
 * the account from the session, not from this form.
 */
export function WalletAddressForm({ initialAddress }: { initialAddress: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const { fieldErrors, show, clear, attrs } = useFieldErrors(FORM_ID, formRef);
  // Controlled, so a finished action doesn't reset the field to its initial
  // value and throw away what the person typed after a failed save.
  const [address, setAddress] = useState(initialAddress);
  const [result, action, pending] = useActionState<WalletResult | undefined, FormData>(
    async (previous, formData) => {
      const next = await setWalletAddressAction(previous, formData);
      if (next.ok) setAddress(next.walletAddress ?? "");
      return next;
    },
    undefined,
  );

  // Show the outcome of each submit exactly once.
  useEffect(() => {
    if (!result) return;
    if (result.ok) {
      clear();
      toast(result.walletAddress ? "Wallet address saved." : "Wallet address cleared.", "success");
    } else {
      show({
        error: result.error ?? "Enter a valid EVM address.",
        field: result.field,
        fieldErrors: result.fieldErrors,
      });
      document.getElementById("walletAddress")?.focus();
    }
  }, [result, show, clear, toast]);

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-2" noValidate>
      <label htmlFor="walletAddress" className="block text-sm font-medium text-slate-800">
        Wallet address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="walletAddress"
          name="walletAddress"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          className="sm:max-w-sm font-mono"
          {...attrs("walletAddress")}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
        </Button>
      </div>
      <FieldError formId={FORM_ID} field="walletAddress" errors={fieldErrors} />
      <p className="text-xs text-slate-500">
        An EVM address (0x followed by 40 hex characters) where your points could
        be sent one day. Leave it empty and save to clear it. Only you and
        workspace admins can see it.
      </p>
    </form>
  );
}
