"use client";

import { useState, useTransition } from "react";
import {
  createIssueTypeAction,
  deleteIssueTypeAction,
  toggleIssueTypeActiveAction,
  updateIssueTypeAction,
} from "@/app/actions/issue-types";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface IssueTypeWithCount {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date | string;
  _count: {
    bugs: number;
  };
}

export function AdminIssueTypesManager({
  types,
}: {
  types: IssueTypeWithCount[];
}) {
  const [editingType, setEditingType] = useState<IssueTypeWithCount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startCreate() {
    setName("");
    setDescription("");
    setIsActive(true);
    setError(null);
    setEditingType(null);
    setIsCreating(true);
  }

  function startEdit(type: IssueTypeWithCount) {
    setName(type.name);
    setDescription(type.description ?? "");
    setIsActive(type.isActive);
    setError(null);
    setIsCreating(false);
    setEditingType(type);
  }

  function cancel() {
    setIsCreating(false);
    setEditingType(null);
    setError(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("isActive", String(isActive));

    startTransition(async () => {
      try {
        let result;
        if (editingType) {
          result = await updateIssueTypeAction(editingType.id, formData);
        } else {
          result = await createIssueTypeAction(formData);
        }

        if (result.error) {
          setError(result.error);
        } else {
          cancel();
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  function handleToggle(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await toggleIssueTypeActiveAction(id);
        if (result.error) setError(result.error);
      } catch {
        setError("Failed to update status.");
      }
    });
  }

  function handleDelete(type: IssueTypeWithCount) {
    if (type._count.bugs > 0) {
      setError(
        `Cannot delete "${type.name}" because it is in use by ${type._count.bugs} issue(s). Deactivate it instead.`,
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete the issue type "${type.name}"?`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteIssueTypeAction(type.id);
        if (result.error) setError(result.error);
      } catch {
        setError("Failed to delete type.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Issue Types Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage issue types (Marketing, Design, Fix, Feat, etc.) available during issue creation.
          </p>
        </div>
        {!isCreating && !editingType && (
          <Button onClick={startCreate}>Add new type</Button>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {(isCreating || editingType) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            {editingType ? `Edit "${editingType.name}"` : "Create new issue type"}
          </h2>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="typeName" className="text-sm font-medium text-slate-700">
                Name
              </label>
              <Input
                id="typeName"
                required
                minLength={2}
                maxLength={50}
                placeholder="e.g. Documentation"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="typeDescription" className="text-sm font-medium text-slate-700">
                Description (optional)
              </label>
              <Textarea
                id="typeDescription"
                rows={2}
                maxLength={300}
                placeholder="Brief description of when to select this type"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="typeActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="typeActive" className="text-sm font-medium text-slate-700">
                Active (available for selection on issue creation form)
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editingType ? "Update type" : "Create type"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={cancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((type) => (
              <tr key={type.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getIssueTypeBadgeClass(
                      type.name,
                    )}`}
                  >
                    {type.name}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-600">
                  {type.description || <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      type.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }
                  >
                    {type.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {type._count.bugs} issue{type._count.bugs === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startEdit(type)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Edit
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleToggle(type.id)}
                      className="text-xs font-medium text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      {type.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(type)}
                      className={`text-xs font-medium ${
                        type._count.bugs > 0
                          ? "cursor-not-allowed text-slate-500"
                          : "text-red-600 hover:text-red-800 hover:underline"
                      }`}
                      title={
                        type._count.bugs > 0
                          ? "Cannot delete type in use by existing issues"
                          : "Delete type"
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {types.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No issue types defined.
          </p>
        ) : null}
      </div>
    </div>
  );
}

