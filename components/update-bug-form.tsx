"use client";

import { useEffect, useState, useTransition } from "react";
import type { Severity, Status } from "@prisma/client";
import { updateBugAction } from "@/app/actions/bugs";
import { severities, statuses } from "@/lib/validations/bug";
import { severityLabel, statusLabel } from "@/lib/labels";
import type { AppRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { AssigneeCombobox } from "@/components/assignee-combobox";
import { triageFieldsKey } from "@/lib/triage-options";

type UserOption = { id: string; name: string; role: AppRole };
type CategoryOption = { id: string; name: string };
type TypeOption = { id: string; name: string };

/** The editable triage fields, as strings so they compare cleanly. */
type Draft = {
  status: string;
  typeId: string;
  severity: string;
  categoryId: string;
  assigneeId: string;
};

const sameDraft = (a: Draft, b: Draft) =>
  (Object.keys(a) as (keyof Draft)[]).every((k) => a[k] === b[k]);

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

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

  // What the server currently holds.
  const serverDraft: Draft = {
    status,
    typeId: typeId ?? "",
    severity,
    categoryId: categoryId ?? "",
    assigneeId: assigneeId ?? "",
  };

  // The selects are controlled: `defaultValue` is only read when the node
  // mounts, so after a save + revalidate React kept the pre-save value on
  // screen while the badge above showed the new one (#TRIAGE-REVERT).
  const [draft, setDraft] = useState<Draft>(serverDraft);
  const [lastServer, setLastServer] = useState<Draft>(serverDraft);

  // Adopt a change made elsewhere (another admin, or our own save) without
  // throwing away edits in progress. Adjusted during render, not in an effect.
  if (!sameDraft(lastServer, serverDraft)) {
    const wasUnedited = sameDraft(draft, lastServer);
    setLastServer(serverDraft);
    if (wasUnedited) setDraft(serverDraft);
  }

  const dirty = !sameDraft(draft, serverDraft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  // Unsaved triage edits used to disappear silently: everything else on this
  // page saves on its own, so only this panel needs an explicit Save.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      /* Submitted by hand rather than through the `action` prop: React 19
         resets a form after an action runs, which wiped the selects back to
         their pre-save value even though state held the new one. The fields
         are controlled, so the payload is built from state. */
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const formData = new FormData();
        formData.set("status", draft.status);
        if (canEditTriage) {
          formData.set("typeId", draft.typeId);
          formData.set("severity", draft.severity);
          formData.set("categoryId", draft.categoryId);
          formData.set("assigneeId", draft.assigneeId);
        } else if (assigneeId) {
          formData.set("assigneeId", draft.assigneeId);
        }
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
      {/* Remount the fields when the saved values change so they never show
          (and re-submit) stale values after a save (#261). */}
      <div
        key={triageFieldsKey({ status, severity, typeId, categoryId, assigneeId })}
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
            value={draft.status}
            onChange={(event) => set("status", event.target.value)}
            className={selectClass}
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
              <label htmlFor="typeId" className="mb-1 block text-xs font-medium text-slate-700">
                Type
              </label>
              <select
                id="typeId"
                name="typeId"
                value={draft.typeId}
                onChange={(event) => set("typeId", event.target.value)}
                className={selectClass}
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
                value={draft.severity}
                onChange={(event) => set("severity", event.target.value)}
                className={selectClass}
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
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Platform
              </label>
              <select
                id="categoryId"
                name="categoryId"
                value={draft.categoryId}
                onChange={(event) => set("categoryId", event.target.value)}
                className={selectClass}
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
              <AssigneeCombobox
                id="assigneeId"
                name="assigneeId"
                people={users}
                value={draft.assigneeId}
                onChange={(next) => set("assigneeId", next)}
              />
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
              value={draft.assigneeId}
              onChange={(event) => set("assigneeId", event.target.value)}
              className={selectClass}
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

      {/* Announced, so the result of a save isn't visual-only. */}
      <p role="status" aria-live="polite" className="text-sm text-emerald-700 empty:hidden">
        {saved ? "Saved." : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {dirty && !pending ? (
          <span className="text-xs text-amber-700">Unsaved changes</span>
        ) : null}
      </div>
    </form>
  );
}
