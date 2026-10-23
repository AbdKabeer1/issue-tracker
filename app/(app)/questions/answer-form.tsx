"use client";

import { useActionState } from "react";
import { answerQuestionAction, type AnswerActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The owner's one-shot answer to an agent's question (#446). */
export function AnswerForm({
  questionId,
  labelledBy,
}: {
  questionId: string;
  labelledBy?: string;
}) {
  const [result, action, pending] = useActionState<AnswerActionResult | undefined, FormData>(
    answerQuestionAction,
    undefined,
  );
  const error = result && !result.ok ? result.error : null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="questionId" value={questionId} />
      <div className="space-y-1">
        {!labelledBy ? (
          <label htmlFor="answer" className="block text-sm font-semibold text-zk-text">
            Your answer
          </label>
        ) : null}
        <Textarea
          id="answer"
          name="answer"
          rows={4}
          required
          maxLength={2000}
          aria-labelledby={labelledBy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "answer-error" : undefined}
        />
      </div>
      {error ? (
        <p id="answer-error" role="alert" className="text-sm text-zk-bad-fg">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="rounded-full bg-electric-blue-strong px-4 py-2 font-semibold text-white hover:opacity-90 focus-visible:ring-electric-blue"
      >
        {pending ? "Sending…" : "Send answer"}
      </Button>
      <p className="text-xs text-zk-muted">The answer can&apos;t be changed once it&apos;s sent.</p>
    </form>
  );
}
