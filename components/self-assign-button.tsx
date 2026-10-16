"use client";

import { useState, useTransition } from "react";
import { selfAssignBugAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";

type SelfAssignButtonProps = {
  bugId: string;
  isAssignedToMe: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "default";
  className?: string;
};

export function SelfAssignButton({
  bugId,
  isAssignedToMe,
  variant = "secondary",
  size = "sm",
  className = "",
}: SelfAssignButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (assign: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await selfAssignBugAction(bugId, assign);
      if (result.error) {
        setError(result.error);
      }
    });
  };

  if (variant === "ghost" || size === "xs") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => handleToggle(!isAssignedToMe)}
          className={`text-xs font-medium transition-colors disabled:opacity-50 ${
            isAssignedToMe
              ? "text-slate-500 hover:text-red-600 hover:underline"
              : "text-teal-700 hover:text-teal-800 hover:underline"
          } ${className}`}
          title={isAssignedToMe ? "Unassign yourself from this issue" : "Assign this issue to yourself"}
        >
          {pending
            ? isAssignedToMe
              ? "Unassigning…"
              : "Assigning…"
            : isAssignedToMe
              ? "Unassign"
              : "Assign to me"}
        </button>
        {error ? (
          <span className="text-xs text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={isAssignedToMe ? "secondary" : variant}
        disabled={pending}
        onClick={() => handleToggle(!isAssignedToMe)}
        className={`${size === "sm" ? "px-3 py-1.5 text-xs" : ""} ${className}`}
        title={
          isAssignedToMe
            ? "Unassign yourself from this issue"
            : "Assign this issue to yourself"
        }
      >
        {pending ? (
          isAssignedToMe ? "Unassigning…" : "Assigning…"
        ) : isAssignedToMe ? (
          <>
            <span aria-hidden="true">✓</span> Assigned to you · Unassign
          </>
        ) : (
          <>
            <span aria-hidden="true">👤</span> Assign to me
          </>
        )}
      </Button>
      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
