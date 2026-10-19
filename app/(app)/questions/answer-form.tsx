"use client";

import { useActionState } from "react";
import { answerQuestionAction, type AnswerActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The owner's one-shot answer to an agent's question (#446). */
export function AnswerForm({ questionId }: { questionId: string }) {
  const [result, action, pending] = useActionState<AnswerActionResult | undefined, FormData>(
    answerQuestionAction,
    undefined,
  );
  const error = result && !result.ok ? result.error : null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="questionId" value={questionId} />
      <div className="space-y-1">
        <label htmlFor="answer" className="block text-sm font-medium text-slate-800">
          Your answer
        </label>
        <Textarea
          id="answer"
          name="answer"
          rows={4}
          required
          maxLength={2000}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "answer-error" : undefined}
        />
      </div>
      {error ? (
        <p id="answer-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send answer"}
      </Button>
      <p className="text-xs text-slate-500">The answer can&apos;t be changed once it&apos;s sent.</p>
    </form>
  );
}
