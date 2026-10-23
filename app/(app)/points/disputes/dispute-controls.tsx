"use client";

import { useActionState, useState } from "react";
import { resolveDisputeAction, type DisputeActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { DisputeView } from "@/lib/points/disputes";

/** Admin resolution for one open dispute (#436): grant, correct, or reject. */
export function DisputeControls({ dispute }: { dispute: DisputeView }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [result, action, pending] = useActionState<DisputeActionResult | undefined, FormData>(
    async (previous, formData) => {
      const next = await resolveDisputeAction(previous, formData);
      if (next.ok) toast(next.message);
      return next;
    },
    undefined,
  );
  const error = result && !result.ok ? result : null;

  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="disputeId" value={dispute.id} />
      <div className="space-y-1">
        <label htmlFor={`note-${dispute.id}`} className="block text-xs font-medium text-zk-text2">
          Note <span className="font-normal text-zk-muted">(optional)</span>
        </label>
        <Textarea
          id={`note-${dispute.id}`}
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Why? The member sees this with the outcome."
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {dispute.kind === "missing" ? (
          <>
            <label htmlFor={`role-${dispute.id}`} className="sr-only">
              Which award to grant
            </label>
            <Select
              id={`role-${dispute.id}`}
              name="role"
              defaultValue={dispute.requestedRole ?? "solver"}
              className="w-auto"
            >
              <option value="solver">Solver award</option>
              <option value="reporter">Reporter award</option>
            </Select>
            <Button type="submit" name="decision" value="grant" disabled={pending}>
              {pending ? "Saving…" : "Grant award"}
            </Button>
          </>
        ) : (
          <Button type="submit" name="decision" value="correct" disabled={pending}>
            {pending ? "Saving…" : "Write correction"}
          </Button>
        )}
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="danger-secondary"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-zk-bad-fg" role="alert">
          {error.error}
        </p>
      ) : null}
    </form>
  );
}
