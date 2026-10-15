"use client";

import { useState, useTransition } from "react";
import { promoteUserToAdminAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function PromoteUserButton({
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
            `Promote ${userName} to admin? They will be able to triage bugs.`,
          );
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            const result = await promoteUserToAdminAction(userId);
            if (result.error) {
              setError(result.error);
            }
          });
        }}
      >
        {pending ? "Promoting…" : "Promote to admin"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
