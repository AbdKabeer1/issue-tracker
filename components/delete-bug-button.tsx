"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { deleteBugAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";

type DeleteBugButtonProps = {
  bugId: string;
  bugTitle: string;
  variant?: "danger" | "danger-secondary" | "ghost";
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

export function DeleteBugButton({
  bugId,
  bugTitle,
  variant = "danger-secondary",
  size = "md",
  label = "Delete ticket",
  className = "",
}: DeleteBugButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sizeClasses =
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        className={`${sizeClasses} ${className}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const confirmed = window.confirm(
            `Are you sure you want to permanently delete "${bugTitle}"?\n\nThis cannot be undone and will delete all associated comments, votes, and activity history.`,
          );
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            try {
              const result = await deleteBugAction(bugId);
              if (result?.error) {
                setError(result.error);
              }
            } catch (err) {
              unstable_rethrow(err);
              setError("Could not delete ticket. Please try again.");
            }
          });
        }}
      >
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span>{pending ? "Deleting…" : label}</span>
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
