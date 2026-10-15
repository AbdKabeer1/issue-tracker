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

function FacebookThumbsUp({
  filled,
  className = "h-4 w-4",
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {filled ? (
        <path d="M2 20h3a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1Zm19.38-9.3a2 2 0 0 0-1.68-.7H15V6a3 3 0 0 0-3-3c-1.38 0-2 1-2 2.5V9l-3.3 4.2A2 2 0 0 0 6 14.5V19a2 2 0 0 0 2 2h8.5a2 2 0 0 0 1.96-1.6l1.62-7.5a2 2 0 0 0-.7-1.2Z" />
      ) : (
        <>
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </>
      )}
    </svg>
  );
}

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

  const isLiked = currentVote === 1;
  const displayCount = Math.max(0, voteCount);
  const isMd = size === "md";

  const handleLike = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setError(null);

    // Direction is always 1 for Facebook-style toggle like/unlike
    const { nextVote, countDelta } = calculateVoteChange(currentVote, 1);
    const prevVote = currentVote;
    const prevCount = voteCount;

    setCurrentVote(nextVote);
    setVoteCount(prevCount + countDelta);

    startTransition(async () => {
      const result = await toggleVoteAction(bugId, 1);
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

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={isLiked}
        aria-label={isLiked ? "Unlike this bug" : "Like this bug"}
        title={isLiked ? "Unlike" : "Like"}
        onClick={handleLike}
        className={`group inline-flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50 ${
          isMd
            ? "gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-xs"
            : "min-w-[3rem] flex-col rounded-lg border px-2 py-1.5 text-xs font-semibold shadow-xs"
        } ${
          isLiked
            ? "border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-300 hover:bg-blue-100"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-blue-600"
        }`}
      >
        <FacebookThumbsUp
          filled={isLiked}
          className={`${
            isMd ? "h-4 w-4" : "h-3.5 w-3.5"
          } transition-transform group-hover:scale-110`}
        />
        {isMd ? (
          <>
            <span>{isLiked ? "Liked" : "Like"}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                isLiked
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {displayCount}
            </span>
          </>
        ) : (
          <span className="mt-0.5 tabular-nums leading-tight">
            {displayCount}
          </span>
        )}
      </button>

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
