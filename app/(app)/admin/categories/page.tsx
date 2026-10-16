import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/category-manager";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  // Ensure default categories exist if not already seeded
  const count = await prisma.category.count();
  if (count === 0) {
    const defaults = ["Mobile", "Desktop", "Web"];
    for (const name of defaults) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name, isActive: true },
      });
    }
  }

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
          ← Back to issues
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          Category management
        </h1>
        <p className="text-sm text-slate-600">
          Manage issue categories (Mobile, Desktop, Web). Only active categories
          are available when reporting issues.
        </p>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
