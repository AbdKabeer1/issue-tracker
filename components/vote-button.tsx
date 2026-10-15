"use client";

import { useState, useTransition } from "react";
import { toggleVoteAction } from "@/app/actions/bugs";

type VoteButtonProps = {
  bugId: string;
  voteCount: number;
  voted: boolean;
  size?: "sm" | "md";
};

export function VoteButton({
  bugId,
  voteCount: initialCount,
  voted: initialVoted,
  size = "sm",
}: VoteButtonProps) {
  const [voteCount, setVoteCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const padding = size === "md" ? "px-3 py-2" : "px-2.5 py-1.5";
  const label = size === "md" ? "text-sm" : "text-xs";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={voted}
        aria-label={voted ? "Remove vote" : "Upvote bug"}
        title={voted ? "Remove your vote" : "Upvote"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          startTransition(async () => {
            const result = await toggleVoteAction(bugId);
            if (result.error) {
              setError(result.error);
              return;
            }
            if (typeof result.voteCount === "number") {
              setVoteCount(result.voteCount);
            }
            if (typeof result.voted === "boolean") {
              setVoted(result.voted);
            }
          });
        }}
        className={`inline-flex min-w-[3.25rem] flex-col items-center justify-center rounded-lg border text-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50 ${padding} ${label} ${
          voted
            ? "border-teal-700 bg-teal-50 text-teal-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span aria-hidden="true" className="leading-none">
          ▲
        </span>
        <span className="tabular-nums leading-tight">{voteCount}</span>
      </button>
      {error ? (
        <p className="max-w-[6rem] text-center text-[10px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
