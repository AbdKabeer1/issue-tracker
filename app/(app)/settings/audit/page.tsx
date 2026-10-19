import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isTenantAdminRole, tenantForOwner } from "@/lib/agents/membership";
import { auditAccess, auditWhere } from "@/lib/agent-audit/visibility";
import { AuditLog, type AuditLogRow } from "@/components/audit-log";

export const metadata = { title: "Agent audit log" };

/** The newest events shown; filter by agent or issue to look further back. */
const LIMIT = 100;

type Props = { searchParams: Promise<{ agent?: string | string[]; issue?: string | string[] }> };

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
  const tenant = await tenantForOwner(user.id);
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
  const issueId = single(params.issue);

  const [events, agents] = await Promise.all([
    prisma.agentAuditEvent.findMany({
      where: auditWhere(access, { agentId, issueId }),
      orderBy: { createdAt: "desc" },
      take: LIMIT,
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

  const rows: AuditLogRow[] = events.map((event) => ({
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
  const filtered = Boolean(agentId || issueId);

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

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Agent</span>
          <select
            name="agent"
            defaultValue={agentId ?? ""}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Issue id</span>
          <input
            name="issue"
            defaultValue={issueId ?? ""}
            placeholder="Any issue"
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

      <section className="rounded-xl border border-slate-200 bg-white px-4">
        <AuditLog rows={rows} />
      </section>
      {rows.length === LIMIT ? (
        <p className="text-xs text-slate-500">Showing the newest {LIMIT}. Filter by agent or issue to see older events.</p>
      ) : null}
    </div>
  );
}
