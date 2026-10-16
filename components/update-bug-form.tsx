"use client";

import { useState, useTransition } from "react";
import type { Severity, Status } from "@prisma/client";
import { updateBugAction } from "@/app/actions/bugs";
import { severities, statuses } from "@/lib/validations/bug";
import { severityLabel, statusLabel } from "@/lib/labels";
import { formatUserLabel, type AppRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";

type UserOption = { id: string; name: string; role: AppRole };
type CategoryOption = { id: string; name: string };
type TypeOption = { id: string; name: string };

export function UpdateBugForm({
  bugId,
  status,
  severity,
  typeId,
  assigneeId,
  categoryId,
  users,
  categories = [],
  types = [],
  canEditTriage = true,
}: {
  bugId: string;
  status: Status;
  severity: Severity;
  typeId?: string | null;
  assigneeId: string | null;
  categoryId?: string | null;
  users: UserOption[];
  categories?: CategoryOption[];
  types?: TypeOption[];
  /** Admins can edit severity/type/category/assignee; assignees only change status. */
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
            ? "grid gap-3 sm:grid-cols-4"
            : "grid gap-3 sm:grid-cols-2 sm:max-w-md"
        }
      >
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
              <label htmlFor="typeId" className="mb-1 block text-xs font-medium">
                Type
              </label>
              <select
                id="typeId"
                name="typeId"
                defaultValue={typeId ?? ""}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">No type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="severity"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Severity
              </label>
              <select
                id="severity"
                name="severity"
                defaultValue={severity}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                htmlFor="categoryId"
                className="mb-1 block text-xs font-medium"
              >
                Platform
              </label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={categoryId ?? ""}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="assigneeId"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Assignee
              </label>
              <select
                id="assigneeId"
                name="assigneeId"
                defaultValue={assigneeId ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
        ) : assigneeId ? (
          <div>
            <label
              htmlFor="assigneeId"
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              Assignee
            </label>
            <select
              id="assigneeId"
              name="assigneeId"
              defaultValue={assigneeId}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value={assigneeId}>Assigned to you</option>
              <option value="">Unassign myself</option>
            </select>
          </div>
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
