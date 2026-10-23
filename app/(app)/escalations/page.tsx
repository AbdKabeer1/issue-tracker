import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { listOwnerQuestions, parseEscalationBody, type EscalationType } from "@/lib/agent-questions";
import { LocalTime } from "@/components/local-time";
import { EscalationTypeBadge, QuickResolveButtons } from "./escalation-controls";

export const metadata = { title: "Agent Escalations" };

const ALL_TYPES: Array<EscalationType | "Redesign"> = [
  "Blocker",
  "Work Authorization",
  "Question",
  "Scope Expansion",
  "Human Approval",
  "Redesign",
];

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; type?: string }>;
}) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  const questions = tenantId ? await listOwnerQuestions(user.id, tenantId) : [];
  const proposals = tenantId
    ? await prisma.redesignProposal.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          createdAt: true,
          bug: { select: { id: true, title: true } },
          authorAgent: { select: { name: true } },
        },
      })
    : [];

  const params = searchParams ? await searchParams : {};
  const statusFilter = params.status ?? "waiting";
  const typeFilter = params.type ?? "all";

  const questionRows = questions.map((q) => {
    const parsed = parseEscalationBody(q.body);
    return {
      id: q.id,
      kind: "question" as const,
      escalationType: parsed.type,
      title: q.agent.name,
      body: parsed.cleanBody,
      createdAt: q.createdAt,
      isWaiting: !q.answeredAt,
      agentName: q.agent.name,
      answer: q.answer,
      bug: q.bug,
      href: `/escalations/${q.id}`,
    };
  });
  const redesignRows = proposals.map((proposal) => ({
    id: proposal.id,
    kind: "redesign" as const,
    escalationType: "Redesign" as const,
    title: proposal.title,
    body: proposal.body,
    createdAt: proposal.createdAt,
    isWaiting: proposal.status === "proposed",
    agentName: proposal.authorAgent.name,
    answer: null,
    bug: proposal.bug,
    href: `/redesigns/${proposal.id}`,
  }));
  const rows = [...questionRows, ...redesignRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );

  const pendingCount = rows.filter((row) => row.isWaiting).length;

  const filtered = rows.filter((item) => {
    if (statusFilter === "waiting" && !item.isWaiting) return false;
    if (statusFilter === "answered" && item.isWaiting) return false;
    if (typeFilter !== "all" && item.escalationType !== typeFilter) return false;
    return true;
  });

  const makeQuery = (newStatus: string, newType: string) => {
    const q = new URLSearchParams();
    if (newStatus !== "waiting") q.set("status", newStatus);
    if (newType !== "all") q.set("type", newType);
    const s = q.toString();
    return s ? `/escalations?${s}` : "/escalations";
  };

  const statusPill = (active: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-electric-blue-strong text-white"
        : "bg-zk-chip text-zk-text2 hover:bg-zk-tint"
    }`;

  const typePill = (active: boolean) =>
    `inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition-colors ${
      active
        ? "bg-deep-ocean text-white"
        : "bg-zk-chip text-zk-muted hover:bg-zk-tint hover:text-zk-text"
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">Agent Escalations</h1>
          <p className="mt-1 text-sm text-zk-muted">
            Incoming blockers, authorization requests, and questions requiring human guidance.
          </p>
        </div>
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-zk-warn-bd bg-zk-warn-bg px-3 py-1 text-xs font-semibold text-zk-warn-fg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zk-warn-fg" />
            {pendingCount} waiting for resolution
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-zk-ok-bg px-3 py-1 text-xs font-semibold text-zk-ok-fg">
            <span className="h-2 w-2 rounded-full bg-zk-ok-fg" />
            All escalations unblocked
          </span>
        )}
      </div>

      <div className="space-y-3 rounded-[20px] border border-zk-border bg-zk-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zk-divider pb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-zk-accent">Status</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={makeQuery("waiting", typeFilter)} className={statusPill(statusFilter === "waiting")}>
              Waiting ({pendingCount})
            </Link>
            <Link href={makeQuery("answered", typeFilter)} className={statusPill(statusFilter === "answered")}>
              Resolved ({rows.length - pendingCount})
            </Link>
            <Link href={makeQuery("all", typeFilter)} className={statusPill(statusFilter === "all")}>
              All ({rows.length})
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.06em] text-zk-accent">Type</span>
          <Link href={makeQuery(statusFilter, "all")} className={typePill(typeFilter === "all")}>
            All Types
          </Link>
          {ALL_TYPES.map((t) => (
            <Link key={t} href={makeQuery(statusFilter, t)} className={typePill(typeFilter === t)}>
              {t}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <ul className="divide-y divide-zk-divider overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface">
          {filtered.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <EscalationTypeBadge type={item.escalationType} />
                  <Link href={item.href} className="font-semibold text-zk-accent hover:underline">
                    {item.kind === "redesign" ? item.title : item.agentName}
                  </Link>
                  {item.kind === "redesign" ? (
                    <span className="text-xs text-zk-muted">{item.agentName}</span>
                  ) : null}
                  <span className="text-xs text-zk-muted">•</span>
                  <LocalTime date={item.createdAt} className="text-xs text-zk-muted" />
                </div>
                {item.isWaiting ? (
                  <span className="inline-flex items-center rounded-full border border-zk-warn-bd bg-zk-warn-bg px-2.5 py-0.5 text-xs font-semibold text-zk-warn-fg">
                    Awaiting response
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-zk-ok-bg px-2.5 py-0.5 text-xs font-semibold text-zk-ok-fg">
                    Resolved
                  </span>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm text-zk-text">{item.body}</p>

              {item.bug ? (
                <div className="text-xs">
                  <span className="text-zk-muted">Linked Issue: </span>
                  <Link
                    href={`/issues/${item.bug.id}`}
                    className="font-semibold text-zk-accent hover:underline"
                  >
                    #{item.bug.title}
                  </Link>
                </div>
              ) : null}

              {item.isWaiting && item.kind === "question" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zk-divider pt-2">
                  <QuickResolveButtons escalationId={item.id} />
                  <Link href={item.href} className="text-xs font-semibold text-zk-accent hover:underline">
                    Write custom response →
                  </Link>
                </div>
              ) : item.isWaiting ? (
                <div className="border-t border-zk-divider pt-2">
                  <Link href={item.href} className="text-xs font-semibold text-zk-accent hover:underline">
                    Review proposal →
                  </Link>
                </div>
              ) : item.kind === "question" ? (
                <div className="space-y-1 rounded-[12px] border border-zk-border bg-zk-chip/60 p-3 text-xs text-zk-text2">
                  <span className="font-semibold text-zk-muted">Your resolution:</span>
                  <p className="whitespace-pre-wrap">{item.answer}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[20px] border border-dashed border-zk-border bg-zk-surface p-8 text-center">
          <p className="text-sm font-semibold text-zk-text">No escalations match this filter.</p>
          <p className="mt-1 text-xs text-zk-muted">
            Agents ask for blockers, permissions, and guidance here.
          </p>
        </div>
      )}
    </div>
  );
}
