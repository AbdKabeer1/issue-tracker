"use client";

import { useRef, useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";

export function CommentForm({ bugId }: { bugId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await addCommentAction(bugId, formData);
          if (result.error) {
            setError(result.error);
          } else {
            formRef.current?.reset();
          }
        });
      }}
    >
      <label htmlFor="body" className="block text-sm font-medium text-slate-700">
        Add a comment
      </label>
      <textarea
        id="body"
        name="body"
        required
        rows={3}
        placeholder="Share triage notes or reproduction steps…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}
