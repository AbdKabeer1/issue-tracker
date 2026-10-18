"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateDisplayNameAction, type DisplayNameResult } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, useFieldErrors } from "@/components/ui/field-errors";
import { useToast } from "@/components/ui/toast";
import { DISPLAY_NAME_MAX } from "@/lib/display-name";

const FORM_ID = "display-name";

/** Change how your name appears on issues and comments (#293). */
export function DisplayNameForm({ initialName }: { initialName: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const { fieldErrors, show, clear, attrs } = useFieldErrors(FORM_ID, formRef);
  // Controlled, because a form action resets uncontrolled fields to their
  // defaults when it finishes, which would throw away what was typed.
  const [name, setName] = useState(initialName);
  const [result, action, pending] = useActionState<DisplayNameResult | undefined, FormData>(
    async (previous, formData) => {
      const next = await updateDisplayNameAction(previous, formData);
      // Show the saved form of the name (trimmed, spaces collapsed).
      if (next.ok && next.name) setName(next.name);
      return next;
    },
    undefined,
  );

  // Show the outcome of each submit exactly once.
  useEffect(() => {
    if (!result) return;
    if (result.ok) {
      clear();
      toast("Display name updated.", "success");
    } else {
      show({ error: result.error ?? "Enter a valid name.", field: result.field, fieldErrors: result.fieldErrors });
      // `show` only moves focus when the failing field changes; a second
      // failure on the same field still has to bring the person back to it.
      document.getElementById("name")?.focus();
    }
  }, [result, show, clear, toast]);

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-2" noValidate>
      <label htmlFor="name" className="block text-sm font-medium text-slate-800">
        Display name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={DISPLAY_NAME_MAX + 20}
          required
          className="sm:max-w-sm"
          {...attrs("name")}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
      <FieldError formId={FORM_ID} field="name" errors={fieldErrors} />
      <p className="text-xs text-slate-500">
        Shown beside your issues and comments, including ones you&apos;ve already
        posted. Your email stays the same.
      </p>
    </form>
  );
}
