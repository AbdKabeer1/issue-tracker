"use client";

import { useState, useTransition } from "react";
import { restoreBugAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";

type RestoreBugButtonProps = {
  bugId: string;
  bugTitle: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

export function RestoreBugButton({
  bugId,
  bugTitle,
  variant = "primary",
  size = "md",
  label = "Restore issue",
  className = "",
}: RestoreBugButtonProps) {
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
            `Are you sure you want to restore "${bugTitle}"?\n\nThe issue will become visible again to all users.`,
          );
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            try {
              const result = await restoreBugAction(bugId);
              if (result?.error) {
                setError(result.error);
              }
            } catch {
              setError("Could not restore issue. Please try again.");
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
              d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.451a.75.75 0 0 0 0-1.5H4.5a.75.75 0 0 0-.75.75v3.75a.75.75 0 0 0 1.5 0v-2.19l.418.418a7 7 0 1 0 1.39-8.497.75.75 0 0 0-1.06 1.06 5.5 5.5 0 0 1 9.314 4.124Z"
              clipRule="evenodd"
            />
          </svg>
          <span>{pending ? "Restoring…" : label}</span>
        </span>
      </Button>
      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
