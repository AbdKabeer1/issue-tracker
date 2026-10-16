import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPlatforms } from "@/lib/categories";
import { CategoryManager } from "@/components/category-manager";

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/bugs" className="text-sm text-teal-700 hover:underline">
          ← Back to bugs
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          Platform management
        </h1>
        <p className="text-sm text-slate-600">
          Manage platforms (Desktop, Web, Mobile). Only active
          platforms are available when reporting issues.
        </p>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
