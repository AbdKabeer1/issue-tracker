"use client";

import { useState, useTransition } from "react";
import {
  createCategoryAction,
  updateCategoryAction,
  toggleCategoryStatusAction,
  deleteCategoryAction,
} from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export type CategoryWithCount = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  _count: {
    bugs: number;
  };
};

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: CategoryWithCount[];
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", newName.trim());

    startTransition(async () => {
      const res = await createCategoryAction(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setNewName("");
      }
    });
  };

  const handleStartEdit = (category: CategoryWithCount) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setError(null);
  };

  const handleSaveEdit = (categoryId: string) => {
    if (!editingName.trim()) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", editingName.trim());

    startTransition(async () => {
      const res = await updateCategoryAction(categoryId, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setEditingId(null);
        setEditingName("");
      }
    });
  };

  const handleToggle = (categoryId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleCategoryStatusAction(categoryId);
      if (res.error) {
        setError(res.error);
      }
    });
  };

  const handleDelete = async (category: CategoryWithCount) => {
    if (category._count.bugs > 0) {
      setError(
        `Cannot delete "${category.name}": it is currently in use by ${category._count.bugs} issue${category._count.bugs === 1 ? "" : "s"}. Reassign or deactivate it instead.`,
      );
      return;
    }

    const confirmed = await confirm({
      title: `Delete platform "${category.name}"?`,
      body: "This cannot be undone.",
      confirmLabel: "Delete platform",
      tone: "danger",
    });
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction(category.id);
      if (res.error) {
        setError(res.error);
        toast(res.error, "error");
      } else {
        toast(`Platform "${category.name}" deleted.`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Add new platform
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Create platforms such as Desktop, Web, or Mobile.
        </p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-3">
          <Input
            id="newPlatformName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Platform name (e.g. Cloud)"
            className="max-w-xs"
            disabled={pending}
            minLength={2}
            maxLength={50}
            required
            // #213: this field had no accessible name - screen readers only
            // announced the placeholder, which many drop once a value is typed.
            aria-label="New platform name"
          />
          <Button type="submit" disabled={pending || !newName.trim()}>
            {pending ? "Adding…" : "Add platform"}
          </Button>
        </form>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Existing platforms
          </h2>
          <p className="text-xs text-slate-500">
            Active platforms appear on the issue creation form. Inactive
            platforms remain on existing issues but cannot be selected for new
            ones.
          </p>
        </div>

        {initialCategories.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No platforms defined yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {initialCategories.map((cat) => {
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6"
                >
                  <div className="flex flex-1 items-center gap-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id={`rename-platform-${cat.id}`}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 w-48 text-sm"
                          disabled={pending}
                          autoFocus
                          minLength={2}
                          maxLength={50}
                          // #213: the rename field announced only "edit, text".
                          aria-label={`Rename platform ${cat.name}`}
                        />
                        <Button
                          className="px-2.5 py-1 text-xs"
                          onClick={() => handleSaveEdit(cat.id)}
                          disabled={pending || !editingName.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          className="px-2.5 py-1 text-xs"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-slate-900">
                          {cat.name}
                        </span>
                        <Badge
                          className={
                            cat.isActive
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-slate-200 bg-slate-100 text-slate-600"
                          }
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-600">
                      {cat._count.bugs} issue{cat._count.bugs === 1 ? "" : "s"}
                    </span>

                    {!isEditing ? (
                      <Button
                        className="px-2.5 py-1 text-xs"
                        variant="ghost"
                        onClick={() => handleStartEdit(cat)}
                        disabled={pending}
                      >
                        Edit
                      </Button>
                    ) : null}

                    <Button
                      className="px-2.5 py-1 text-xs"
                      variant="secondary"
                      onClick={() => handleToggle(cat.id)}
                      disabled={pending}
                    >
                      {cat.isActive ? "Deactivate" : "Activate"}
                    </Button>

                    <Button
                      className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      variant="ghost"
                      onClick={() => handleDelete(cat)}
                      disabled={pending || cat._count.bugs > 0}
                      title={
                        cat._count.bugs > 0
                          ? "Cannot delete: platform has existing issues"
                          : "Delete platform"
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
