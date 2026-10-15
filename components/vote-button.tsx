"use client";

import { useState, useTransition } from "react";
import { toggleVoteAction } from "@/app/actions/bugs";
import { calculateVoteChange } from "@/lib/voting";

type VoteButtonProps = {
  bugId: string;
  voteCount: number;
  userVote?: number;
  voted?: boolean;
  size?: "sm" | "md";
};

export function VoteButton({
  bugId,
  voteCount: initialCount,
  userVote,
  voted,
  size = "sm",
}: VoteButtonProps) {
  const initialVote =
    typeof userVote === "number" ? userVote : voted ? 1 : 0;
  const [voteCount, setVoteCount] = useState(initialCount);
  const [currentVote, setCurrentVote] = useState(initialVote);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleVote = (event: React.MouseEvent, direction: 1 | -1) => {
    event.preventDefault();
    event.stopPropagation();
    setError(null);

    const { nextVote, countDelta } = calculateVoteChange(currentVote, direction);
    const prevVote = currentVote;
    const prevCount = voteCount;

    setCurrentVote(nextVote);
    setVoteCount(prevCount + countDelta);

    startTransition(async () => {
      const result = await toggleVoteAction(bugId, direction);
      if (result.error) {
        setError(result.error);
        setCurrentVote(prevVote);
        setVoteCount(prevCount);
        return;
      }
      if (typeof result.voteCount === "number") {
        setVoteCount(result.voteCount);
      }
      if (typeof result.userVote === "number") {
        setCurrentVote(result.userVote);
      } else if (typeof result.voted === "boolean") {
        setCurrentVote(result.voted ? 1 : 0);
      }
    });
  };

  const isUpvoted = currentVote === 1;
  const isDownvoted = currentVote === -1;
  const isMd = size === "md";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`inline-flex min-w-[2.75rem] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white shadow-xs ${
          isMd ? "p-1.5" : "p-1"
        }`}
      >
        <button
          type="button"
          disabled={pending}
          aria-pressed={isUpvoted}
          aria-label={isUpvoted ? "Remove upvote" : "Upvote"}
          title={isUpvoted ? "Remove upvote" : "Upvote"}
          onClick={(e) => handleVote(e, 1)}
          className={`flex items-center justify-center rounded transition disabled:opacity-50 ${
            isMd ? "h-6 w-6" : "h-5 w-5"
          } ${
            isUpvoted
              ? "bg-teal-50 text-teal-700"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          <svg
            className={isMd ? "h-4 w-4" : "h-3.5 w-3.5"}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 4.5l6 7.5H4l6-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <span
          className={`my-0.5 tabular-nums font-semibold leading-tight ${
            isMd ? "text-sm" : "text-xs"
          } ${
            isUpvoted
              ? "text-teal-700"
              : isDownvoted
                ? "text-rose-600"
                : "text-slate-700"
          }`}
        >
          {voteCount}
        </span>

        <button
          type="button"
          disabled={pending}
          aria-pressed={isDownvoted}
          aria-label={isDownvoted ? "Remove downvote" : "Downvote"}
          title={isDownvoted ? "Remove downvote" : "Downvote"}
          onClick={(e) => handleVote(e, -1)}
          className={`flex items-center justify-center rounded transition disabled:opacity-50 ${
            isMd ? "h-6 w-6" : "h-5 w-5"
          } ${
            isDownvoted
              ? "bg-rose-50 text-rose-600"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          <svg
            className={isMd ? "h-4 w-4" : "h-3.5 w-3.5"}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 15.5l-6-7.5h12l-6 7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {error ? (
        <p
          className="max-w-[5.5rem] text-center text-[10px] text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
