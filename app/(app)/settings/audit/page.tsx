import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { auditAccess, auditWhere } from "@/lib/agent-audit/visibility";
import { AuditLog, type AuditLogRow } from "@/components/audit-log";
import { undoAuditEventAction } from "@/app/actions/audit";
import { parseIssueRef } from "@/lib/duplicates";
import { AUDIT_PAGE_SIZE, auditPageHref, splitAuditPage } from "@/lib/agent-audit/paging";

export const metadata = { title: "Agent audit log" };

type Props = {
  searchParams: Promise<{
    agent?: string | string[];
    issue?: string | string[];
    before?: string | string[];
    show?: string | string[];
  }>;
};

const single = (value: string | string[] | undefined): string | null => {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() ? first.trim() : null;
};

/**
 * Every agent action in the tenant (#447), for its owners and admins, and for
 * an agent's owner limited to their own agents. Optional: nothing links here
 * by force. Rows start collapsed; "Show more" opens one row's details.
 */
export default async function AuditLogPage({ searchParams }: Props) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  const membership = tenantId
    ? await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        select: { role: true },
      })
    : null;
  const tenant = tenantId ? { tenantId, role: membership?.role } : null;
  const owned = tenant
    ? await prisma.agent.findMany({
        where: { ownerUserId: user.id, tenantId: tenant.tenantId },
        select: { id: true },
      })
    : [];

  const access = auditAccess({
    isTenantAdmin: isTenantAdminRole(tenant?.role, user.role),
    tenantId: tenant?.tenantId ?? null,
    ownedAgentIds: owned.map((a) => a.id),
  });
  if (access.kind === "forbidden") forbidden();

  const params = await searchParams;
  const agentId = single(params.agent);
  const issueInput = single(params.issue);
  const before = single(params.before);
  // Request rows are hidden by default so each action reads once (#575).
  const includeRequests = single(params.show) === "requests";

  // #576: the issue filter takes "#123", "123", an issue link or an id.
  const ref = issueInput ? parseIssueRef(issueInput) : null;
  const issueId =
    ref && "number" in ref
      ? ((
          await prisma.bug.findFirst({
            where: { number: ref.number, tenantId: access.tenantId },
            select: { id: true },
          })
        )?.id ?? null)
      : (ref?.id ?? issueInput); // anything else is taken as an internal id, as before
  // A filter that names no issue in this workspace matches nothing, not everything.
  const noSuchIssue = Boolean(issueInput) && !issueId;

  const [events, agents] = await Promise.all([
    noSuchIssue
      ? []
      : prisma.agentAuditEvent.findMany({
          where: auditWhere(access, { agentId, issueId, includeRequests }),
          // id breaks ties so the cursor never skips or repeats a row.
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: AUDIT_PAGE_SIZE + 1,
          ...(before ? { cursor: { id: before }, skip: 1 } : {}),
          select: {
            id: true,
            createdAt: true,
            action: true,
            target: true,
            agentId: true,
            bugId: true,
            payload: true,
            undoneAt: true,
            agent: { select: { name: true } },
            bug: { select: { number: true, title: true } },
          },
        }),
    // Only the agents this viewer may filter by.
    prisma.agent.findMany({
      where:
        access.kind === "all"
          ? { tenantId: access.tenantId }
          : { tenantId: access.tenantId, id: { in: [...access.agentIds] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const { page, olderCursor } = splitAuditPage(events);
  const rows: AuditLogRow[] = page.map((event) => ({
    id: event.id,
    createdAt: event.createdAt,
    agentName: event.agent.name,
    action: event.action,
    target: event.bug ? `#${event.bug.number} ${event.bug.title}` : event.target,
    issueHref: event.bugId ? `/issues/${event.bugId}` : null,
    agentId: event.agentId,
    bugId: event.bugId,
    payload: event.payload,
    undoneAt: event.undoneAt,
  }));
  const filtered = Boolean(agentId || issueInput || includeRequests);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/settings/agents" className="text-sm text-teal-700 hover:underline">
          ← Agents
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Agent audit log</h1>
        <p className="text-sm text-slate-600">
          {access.kind === "all"
            ? "Every agent action in this workspace, newest first."
            : "Your agents' actions, newest first."}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-card p-4">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Agent</span>
          <select
            name="agent"
            defaultValue={agentId ?? ""}
            className="mt-1 rounded-lg border border-slate-300 bg-card px-3 py-2 text-sm"
          >
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="show"
            value="requests"
            defaultChecked={includeRequests}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show request rows
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Issue</span>
          <input
            name="issue"
            defaultValue={issueInput ?? ""}
            placeholder="#123 or any issue"
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Filter
        </button>
        {filtered ? (
          <Link href="/settings/audit" className="py-2 text-sm text-teal-700 hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      <section className="rounded-xl border border-slate-200 bg-card px-4">
        <AuditLog
          rows={rows}
          isTenantAdmin={access.kind === "all"}
          onUndo={undoAuditEventAction}
        />
      </section>
      {noSuchIssue ? (
        <p className="text-sm text-slate-600">No issue matches “{issueInput}” in this workspace.</p>
      ) : null}
      {before || olderCursor ? (
        <nav aria-label="Audit log pages" className="flex items-center justify-between text-sm">
          {before ? (
            <Link
              href={auditPageHref({
                agent: agentId,
                issue: issueInput,
                show: includeRequests ? "requests" : undefined,
              })}
              className="text-teal-700 hover:underline"
            >
              ← Newest
            </Link>
          ) : (
            <span />
          )}
          {olderCursor ? (
            <Link
              href={auditPageHref({
                agent: agentId,
                issue: issueInput,
                before: olderCursor,
                show: includeRequests ? "requests" : undefined,
              })}
              className="font-medium text-teal-700 hover:underline"
            >
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
