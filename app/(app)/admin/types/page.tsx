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

  return <AdminIssueTypesManager types={types} />;
}

