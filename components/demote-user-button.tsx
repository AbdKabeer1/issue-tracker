"use client";

import { useState, useTransition } from "react";
import { demoteUserToUserAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function DemoteUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          const confirmed = await confirm({
            title: `Remove admin from ${userName}?`,
            body: "They will no longer be able to triage issues.",
            confirmLabel: "Remove admin",
            tone: "danger",
          });
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            try {
              const result = await demoteUserToUserAction(userId);
              if (result.error) {
                setError(result.error);
                toast(result.error, "error");
              } else {
                toast(`${userName} is no longer an admin.`);
              }
            } catch {
              setError("Could not remove admin access. Please try again.");
              toast("Could not remove admin access. Please try again.", "error");
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