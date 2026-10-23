import Link from "next/link";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantAccess } from "@/lib/tenant-access";
import { getActiveIssueTypesCached, getActivePlatforms } from "@/lib/lookups";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { tenantMemberWhere } from "@/lib/tenant-mentions";
import { CreateIssueForm } from "@/components/create-issue-form";
import { activeProjectIdFor } from "@/lib/project-context";

/* Distinct browser-tab title; the root layout appends "· Ziki". */
export const metadata = { title: "Report an issue" };

type MentionUser = { id: string; name: string; role: Role; image: string | null };

/** The issues list already survives a lookup failure. This form did not, so one bad read showed "This page didn't load". */
async function loadOrEmpty<T>(label: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`[issues/new] ${label} lookup failed`, error);
    return empty;
  }
}

async function loadMentionUsers(tenantId: string | null): Promise<MentionUser[]> {
  // #502: only members of the tenant the issue goes into can be mentioned.
  if (!tenantId) return [];
  const where = tenantMemberWhere(tenantId);
  try {
    return await prisma.user.findMany({
      where,
      select: { id: true, name: true, role: true, image: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("[issues/new] user lookup failed, retrying without image", error);
    try {
      const rows = await prisma.user.findMany({
        where,
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      });
      return rows.map((row) => ({ ...row, image: null }));
    } catch (fallbackError) {
      console.error("[issues/new] user lookup failed", fallbackError);
      return [];
    }
  }
}

async function loadAssigneeUsers(tenantId: string | null): Promise<MentionUser[]> {
  if (!tenantId) return [];
  return loadOrEmpty("assignees", () =>
    prisma.user.findMany({
      where: { memberships: { some: { tenantId } } },
      select: { id: true, name: true, role: true, image: true },
      orderBy: { name: "asc" },
    }),
  []);
}

export default async function NewBugPage() {
  const user = await requireUser();
  const admin = (await currentTenantAccess(user.id, user.role)).admin;
  const tenantId = await currentTenantIdFor(user.id);
  const [users, assigneeUsers, categories, types] = await Promise.all([
    loadMentionUsers(tenantId),
    loadAssigneeUsers(tenantId),
    loadOrEmpty("platforms", async () => getActivePlatforms(tenantId), []),
    loadOrEmpty("issue types", () => getActiveIssueTypesCached(tenantId), []),
  ]);
  const projectId = await loadOrEmpty("active project", async () => {
    if (!tenantId) return null;
    return activeProjectIdFor(prisma, tenantId);
  }, null);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="space-y-2">
        <Link
          href="/issues"
          className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-zk-accent hover:underline"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to issues
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Report an issue</h1>
        <p className="text-sm text-zk-text2">
          Include a type, clear description, and optional GitHub PR so the team
          can triage quickly.
        </p>
      </div>
      <div className="rounded-[20px] border border-zk-border bg-zk-surface p-5 sm:p-6">
        <CreateIssueForm
          users={users}
          assigneeUsers={assigneeUsers}
          categories={categories}
          types={types}
          isAdmin={admin}
          currentUserId={user.id}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
