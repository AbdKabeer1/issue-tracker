"use client";

import { useState, useTransition } from "react";
import { promoteUserToAdminAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function PromoteUserButton({
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
            title: `Promote ${userName} to admin?`,
            body: "They will be able to triage every issue.",
            confirmLabel: "Promote to admin",
          });
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            const result = await promoteUserToAdminAction(userId);
            if (result.error) {
              setError(result.error);
              toast(result.error, "error");
            } else {
              toast(`${userName} is now an admin.`);
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
