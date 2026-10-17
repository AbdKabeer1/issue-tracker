import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/auth-helpers";
import { getActiveIssueTypesCached, getActivePlatforms } from "@/lib/lookups";
import { CreateBugForm } from "@/components/create-bug-form";

/* Distinct browser-tab title; the root layout appends "· Zedu Issues". */
export const metadata = { title: "Report an issue" };

export default async function NewBugPage() {
  const user = await requireUser();
  const admin = isAdmin(user.role);
  // Every signed-in user is needed for @mentions; admins additionally get
  // the assignee picker.
  const [users, categories, types] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    // Cached (#297). getActivePlatforms also seeds the default platforms,
    // but only when they're actually missing — it used to upsert all three
    // on every render of this form.
    getActivePlatforms(),
    getActiveIssueTypesCached(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/bugs" className="text-sm text-teal-700 hover:underline">
          ← Back to issues
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Report an issue</h1>
        <p className="text-sm text-slate-600">
          Include a type, clear description, and optional GitHub proof links so the team
          can triage quickly.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <CreateBugForm
          users={users}
          categories={categories}
          types={types}
          isAdmin={admin}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
