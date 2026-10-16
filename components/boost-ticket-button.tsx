"use client";

import { useState, useTransition } from "react";
import { toggleBoostBugAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";

type BoostTicketButtonProps = {
  bugId: string;
  isBoosted: boolean;
  variant?: "secondary" | "ghost";
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

export function BoostTicketButton({
  bugId,
  isBoosted: initialBoosted,
  variant = "secondary",
  size = "sm",
  showLabel = true,
  className = "",
}: BoostTicketButtonProps) {
  const [boosted, setBoosted] = useState(initialBoosted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sizeClasses =
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        title={boosted ? "Remove boost from ticket" : "Boost ticket to top of list"}
        aria-pressed={boosted}
        className={`${sizeClasses} ${
          boosted
            ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-500"
            : "text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-800"
        } ${className}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);

          const previous = boosted;
          const next = !boosted;
          setBoosted(next);

          startTransition(async () => {
            try {
              const result = await toggleBoostBugAction(bugId);
              if (result.error) {
                setBoosted(previous);
                setError(result.error);
              } else if (result.isBoosted !== undefined) {
                setBoosted(result.isBoosted);
              }
            } catch {
              setBoosted(previous);
              setError("Failed to update boost status. Please try again.");
            }
          });
        }}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={
              size === "sm"
                ? "h-3.5 w-3.5 text-amber-600"
                : "h-4 w-4 text-amber-600"
            }
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38Z"
              clipRule="evenodd"
            />
          </svg>
          {showLabel ? (
            <span>
              {pending
                ? boosted
                  ? "Unboosting…"
                  : "Boosting…"
                : boosted
                  ? "Boosted"
                  : "Boost to top"}
            </span>
          ) : null}
        </span>
      </Button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
