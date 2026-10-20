import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPlatforms, platformScopeFor } from "@/lib/categories";
import { CategoryManager } from "@/components/category-manager";

/* Distinct browser-tab title; the root layout appends "· Ziki Issues". */
export const metadata = { title: "Platforms" };

export default async function AdminCategoriesPage() {
  const scope = await platformScopeFor(await requireUser());
  if (!scope.ok) {
    if (scope.forbidden) redirect("/issues");
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Platform management</h1>
        <p className="max-w-xl text-sm text-slate-600">
          Open an organization first. Platforms belong to one organization, not to every
          account on the site.
        </p>
        <Link href="/tenants" className="text-sm font-medium text-teal-700 hover:underline">
          Choose an organization
        </Link>
      </div>
    );
  }

  await ensureDefaultPlatforms(scope.tenantId);

  const [rows, usage] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: scope.tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.bug.groupBy({
      by: ["categoryId", "isDeleted"],
      where: { tenantId: scope.tenantId, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const totals = new Map<string, number>();
  const deletedCounts: Record<string, number> = {};
  for (const row of usage) {
    if (!row.categoryId) continue;
    totals.set(row.categoryId, (totals.get(row.categoryId) ?? 0) + row._count._all);
    if (row.isDeleted) deletedCounts[row.categoryId] = row._count._all;
  }

  const categories = rows.map((row) => ({
    ...row,
    _count: { bugs: totals.get(row.id) ?? 0 },
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/issues" className="text-sm text-teal-700 hover:underline">
          ← Back to issues
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          Platform management
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Platforms in <span className="font-medium text-slate-800">{scope.tenantName}</span>.
          Adding, renaming, or deactivating one changes this organization only. Issues in
          another organization keep their own platforms.
        </p>
        <p className="text-sm">
          <Link href="/tenants" className="font-medium text-teal-700 hover:underline">
            Switch organization
          </Link>
        </p>
      </div>

      <CategoryManager initialCategories={categories} deletedCounts={deletedCounts} />
    </div>
  );
}
