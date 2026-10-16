import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { resolveSessionUserId } from "@/lib/session-user";
import { getActiveIssueTypes } from "@/lib/issue-types";
import { CreateBugForm } from "@/components/create-bug-form";

export default async function NewBugPage() {
  const resolved = await resolveSessionUserId();
  const userId = "userId" in resolved ? resolved.userId : undefined;
  const sessionUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
    : null;
  const admin = isAdmin(sessionUser?.role);

  const [users, types] = await Promise.all([
    admin
      ? prisma.user.findMany({
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    getActiveIssueTypes(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/bugs" className="text-sm text-teal-700 hover:underline">
          ← Back to bugs
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Report an issue</h1>
        <p className="text-sm text-slate-600">
          Include a type, clear description, and optional proof links so the team
          can triage quickly.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CreateBugForm users={users} types={types} isAdmin={admin} />
      </div>
    </div>
  );
}
