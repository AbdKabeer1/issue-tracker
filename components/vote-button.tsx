"use client";

import { useState, useTransition } from "react";
import { toggleVoteAction } from "@/app/actions/bugs";
import { calculateVoteChange } from "@/lib/voting";
import { updateVoteCounts, type VoterInfo } from "@/lib/voters";
import { VoterAvatars } from "@/components/voter-avatars";

type VoteButtonProps = {
  bugId: string;
  voteCount: number;
  userVote?: number;
  voted?: boolean;
  likeCount?: number;
  dislikeCount?: number;
  likeVoters?: VoterInfo[];
  dislikeVoters?: VoterInfo[];
  size?: "sm" | "md";
  showAvatars?: boolean;
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

function FacebookThumbsDown({
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
        <path d="M22 4h-3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1ZM2.62 13.3a2 2 0 0 0 1.68.7H9v3a3 3 0 0 0 3 3c1.38 0 2-1 2-2.5V15l3.3-4.2A2 2 0 0 0 18 9.5V5a2 2 0 0 0-2-2H7.5a2 2 0 0 0-1.96 1.6l-1.62 7.5a2 2 0 0 0 .7 1.2Z" />
      ) : (
        <>
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
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
  likeCount: initialLikeCount,
  dislikeCount: initialDislikeCount,
  likeVoters = [],
  dislikeVoters = [],
  size = "sm",
  showAvatars = false,
}: VoteButtonProps) {
  const initialVote =
    typeof userVote === "number" ? userVote : voted ? 1 : 0;
  const [currentVote, setCurrentVote] = useState(initialVote);
  const [likeCount, setLikeCount] = useState(
    typeof initialLikeCount === "number"
      ? initialLikeCount
      : initialVote === 1
        ? Math.max(1, initialCount)
        : Math.max(0, initialCount),
  );
  const [dislikeCount, setDislikeCount] = useState(
    typeof initialDislikeCount === "number"
      ? initialDislikeCount
      : initialVote === -1
        ? 1
        : 0,
  );
  const [voteCount, setVoteCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isLiked = currentVote === 1;
  const isDisliked = currentVote === -1;
  const isMd = size === "md";

  const handleVote = (direction: 1 | -1, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setError(null);

    const {
      nextVote,
      likeCount: nextLikes,
      dislikeCount: nextDislikes,
    } = updateVoteCounts({ likeCount, dislikeCount }, currentVote, direction);
    const { countDelta } = calculateVoteChange(currentVote, direction);

    const prevVote = currentVote;
    const prevLikes = likeCount;
    const prevDislikes = dislikeCount;
    const prevVoteCount = voteCount;

    setCurrentVote(nextVote);
    setLikeCount(nextLikes);
    setDislikeCount(nextDislikes);
    setVoteCount(prevVoteCount + countDelta);

    startTransition(async () => {
      const result = await toggleVoteAction(bugId, direction);
      if (result.error) {
        setError(result.error);
        setCurrentVote(prevVote);
        setLikeCount(prevLikes);
        setDislikeCount(prevDislikes);
        setVoteCount(prevVoteCount);
        return;
      }
      if (typeof result.likeCount === "number") {
        setLikeCount(result.likeCount);
      }
      if (typeof result.dislikeCount === "number") {
        setDislikeCount(result.dislikeCount);
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

  if (isMd) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Like button and voter avatars */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              aria-pressed={isLiked}
              aria-label={isLiked ? "Unlike this issue" : "Like this issue"}
              title={isLiked ? "Unlike" : "Like"}
              onClick={(e) => handleVote(1, e)}
              className={`group inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-xs transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                isLiked
                  ? "border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-300 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-blue-600"
              }`}
            >
              <FacebookThumbsUp
                filled={isLiked}
                className="h-4 w-4 transition-transform group-hover:scale-110"
              />
              <span>{isLiked ? "Liked" : "Like"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                  isLiked
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {likeCount}
              </span>
            </button>
            {showAvatars && (
              <VoterAvatars
                voters={likeVoters}
                totalCount={likeCount}
                size="md"
              />
            )}
          </div>

          {/* Dislike button and voter avatars */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              aria-pressed={isDisliked}
              aria-label={isDisliked ? "Remove dislike" : "Dislike this issue"}
              title={isDisliked ? "Remove dislike" : "Dislike"}
              onClick={(e) => handleVote(-1, e)}
              className={`group inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-xs transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                isDisliked
                  ? "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-rose-600"
              }`}
            >
              <FacebookThumbsDown
                filled={isDisliked}
                className="h-4 w-4 transition-transform group-hover:scale-110"
              />
              <span>{isDisliked ? "Disliked" : "Dislike"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                  isDisliked
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {dislikeCount}
              </span>
            </button>
            {showAvatars && (
              <VoterAvatars
                voters={dislikeVoters}
                totalCount={dislikeCount}
                size="md"
              />
            )}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // Compact size for list views
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-1.5">
        <button
          type="button"
          disabled={pending}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike this issue" : "Like this issue"}
          title={isLiked ? "Unlike" : "Like"}
          onClick={(e) => handleVote(1, e)}
          className={`group inline-flex min-w-[2.75rem] flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold shadow-xs transition-all duration-150 active:scale-95 disabled:opacity-50 ${
            isLiked
              ? "border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-300 hover:bg-blue-100"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-blue-600"
          }`}
        >
          <FacebookThumbsUp
            filled={isLiked}
            className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
          />
          <span className="mt-0.5 tabular-nums leading-tight">{likeCount}</span>
        </button>

        <button
          type="button"
          disabled={pending}
          aria-pressed={isDisliked}
          aria-label={isDisliked ? "Remove dislike" : "Dislike this issue"}
          title={isDisliked ? "Remove dislike" : "Dislike"}
          onClick={(e) => handleVote(-1, e)}
          className={`group inline-flex min-w-[2.75rem] flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold shadow-xs transition-all duration-150 active:scale-95 disabled:opacity-50 ${
            isDisliked
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-rose-600"
          }`}
        >
          <FacebookThumbsDown
            filled={isDisliked}
            className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
          />
          <span className="mt-0.5 tabular-nums leading-tight">
            {dislikeCount}
          </span>
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
