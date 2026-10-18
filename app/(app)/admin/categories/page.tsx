import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPlatforms } from "@/lib/categories";
import { CategoryManager } from "@/components/category-manager";

/* Distinct browser-tab title; the root layout appends "· Zedu Issues". */
export const metadata = { title: "Platforms" };

export default async function AdminCategoriesPage() {
  await requireAdmin();

  await ensureDefaultPlatforms();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { bugs: true },
      },
    },
  });

  // Soft-deleted issues still hold the platform, so they block deletion, but
  // the list hides them. Counted apart so the "in use" link matches (#314).
  const deletedRows = await prisma.bug.groupBy({
    by: ["categoryId"],
    where: { isDeleted: true, categoryId: { not: null } },
    _count: { _all: true },
  });
  const deletedCounts = Object.fromEntries(
    deletedRows.map((row) => [row.categoryId as string, row._count._all]),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/issues" className="text-sm text-teal-700 hover:underline">
          ← Back to issues
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          Platform management
        </h1>
        <p className="text-sm text-slate-600">
          Manage platforms (Desktop, Web, Mobile). Only active
          platforms are available when reporting issues.
        </p>
      </div>

      <CategoryManager initialCategories={categories} deletedCounts={deletedCounts} />
    </div>
  );
}
