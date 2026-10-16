"use client";

import { useState, useTransition } from "react";
import { demoteUserToUserAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function DemoteUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            `Remove admin from ${userName}? They will no longer be able to triage issues.`,
          );
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            try {
              const result = await demoteUserToUserAction(userId);
              if (result.error) {
                setError(result.error);
              }
            } catch {
              setError("Could not remove admin access. Please try again.");
            }
          });
        }}
      >
        {pending ? "Removing…" : "Remove admin"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}