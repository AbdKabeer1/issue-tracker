"use client";

import { useTransition } from "react";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton({ allWorkspaces = false }: { allWorkspaces?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(async () => void (await markAllNotificationsReadAction(allWorkspaces)))}
    >
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
