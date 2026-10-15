"use client";

import { useState, useTransition } from "react";
import type { Severity, Status } from "@prisma/client";
import { updateBugAction } from "@/app/actions/bugs";
import { severities, statuses } from "@/lib/validations/bug";
import { severityLabel, statusLabel } from "@/lib/labels";
import { formatUserLabel, type UserRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";

type UserOption = { id: string; name: string; role: UserRole };

export function UpdateBugForm({
  bugId,
  status,
  severity,
  assigneeId,
  users,
  canEditTriage = true,
}: {
  bugId: string;
  status: Status;
  severity: Severity;
  assigneeId: string | null;
  users: UserOption[];
  /** Admins can edit severity/assignee; assignees only change status. */
  canEditTriage?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await updateBugAction(bugId, formData);
          if (result.error) {
            setError(result.error);
          } else {
            setSaved(true);
          }
        });
      }}
    >
      <h2 className="text-sm font-semibold text-slate-900">
        {canEditTriage ? "Triage" : "Update status"}
      </h2>
      <div
        className={
          canEditTriage
            ? "grid gap-3 sm:grid-cols-3"
            : "grid gap-3 sm:grid-cols-1 sm:max-w-xs"
        }
      >
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel[value]}
              </option>
            ))}
          </select>
        </div>
        {canEditTriage ? (
          <>
            <div>
              <label
                htmlFor="severity"
                className="mb-1 block text-xs font-medium"
              >
                Severity
              </label>
              <select
                id="severity"
                name="severity"
                defaultValue={severity}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {severities.map((value) => (
                  <option key={value} value={value}>
                    {severityLabel[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="assigneeId"
                className="mb-1 block text-xs font-medium"
              >
                Assignee
              </label>
              <select
                id="assigneeId"
                name="assigneeId"
                defaultValue={assigneeId ?? ""}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatUserLabel(user.name, user.role)}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
