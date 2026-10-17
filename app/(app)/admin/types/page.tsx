import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { AdminIssueTypesManager } from "@/components/admin-issue-types-manager";

/* Distinct browser-tab title; the root layout appends "· Zedu Issues". */
export const metadata = { title: "Issue types" };

export default async function AdminTypesPage() {
  await requireAdmin();

  const types = await prisma.issueType.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { bugs: true },
      },
    },
  });

  // As for platforms: deleted issues block deletion but the list hides them.
  const deletedRows = await prisma.bug.groupBy({
    by: ["typeId"],
    where: { isDeleted: true, typeId: { not: null } },
    _count: { _all: true },
  });
  const deletedCounts = Object.fromEntries(
    deletedRows.map((row) => [row.typeId as string, row._count._all]),
  );

  return <AdminIssueTypesManager types={types} deletedCounts={deletedCounts} />;
}

