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

  const handleDelete = (category: CategoryWithCount) => {
    if (category._count.bugs > 0) {
      setError(
        `Cannot delete "${category.name}": it is currently in use by ${category._count.bugs} issue${category._count.bugs === 1 ? "" : "s"}. Reassign or deactivate it instead.`,
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete category "${category.name}"?`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction(category.id);
      if (res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Add new category
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Create platforms or issue categories (e.g., Mobile, Desktop, Web).
        </p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name (e.g. Cloud)"
            className="max-w-xs"
            disabled={pending}
            minLength={2}
            maxLength={50}
            required
          />
          <Button type="submit" disabled={pending || !newName.trim()}>
            {pending ? "Adding…" : "Add category"}
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
            Existing categories
          </h2>
          <p className="text-xs text-slate-500">
            Active categories appear on the issue creation form. Inactive
            categories remain on existing tickets but cannot be selected for new
            ones.
          </p>
        </div>

        {initialCategories.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No categories defined yet.
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
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 w-48 text-sm"
                          disabled={pending}
                          autoFocus
                          minLength={2}
                          maxLength={50}
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
                              : "border border-slate-200 bg-slate-100 text-slate-500"
                          }
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
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
                          ? "Cannot delete: category has existing issues"
                          : "Delete category"
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
