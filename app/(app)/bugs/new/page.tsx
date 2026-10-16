import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/auth-helpers";
import { CreateBugForm } from "@/components/create-bug-form";

export default async function NewBugPage() {
  const user = await requireUser();
  const admin = isAdmin(user.role);

  const [users, categories] = await Promise.all([
    admin
      ? prisma.user.findMany({
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/bugs" className="text-sm text-teal-700 hover:underline">
          ← Back to bugs
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Report a bug</h1>
        <p className="text-sm text-slate-600">
          Include a clear description and optional proof links (screenshots or
          videos) so the team can triage quickly.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CreateBugForm
          users={users}
          categories={categories}
          isAdmin={admin}
        />
      </div>
    </div>
  );
}
