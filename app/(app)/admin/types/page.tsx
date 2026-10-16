import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ensureDefaultIssueTypes } from "@/lib/issue-types";
import { AdminIssueTypesManager } from "@/components/admin-issue-types-manager";

export default async function AdminTypesPage() {
  await requireAdmin();
  await ensureDefaultIssueTypes();

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

