import Link from "next/link";
import type { Metadata } from "next";
import type { Severity } from "@prisma/client";
import { requireUser } from "@/lib/auth-helpers";
import { currentTenantIdFor } from "@/lib/tenant-context";
import {
  EMPTY_OVERVIEW,
  loadOwnAgents,
  loadWorkspaceOverview,
  type OverviewIssue,
  type WorkspaceOverview,
} from "@/lib/dashboard-overview";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
  DashboardAgents,
  type DashboardAgentView,
} from "@/components/dashboard-agents";
import { RelativeTime } from "@/components/relative-time";
import { formatIssueNumber } from "@/lib/issue-number";
import { Badge } from "@/components/ui/badge";
import { severityClass, severityLabel, statusClass, statusLabels } from "@/lib/labels";

export const metadata: Metadata = { title: "Dashboard" };

const severityOf = (value: string | null): Severity | null => {
  if (!value) return null;
  return value in severityLabel ? (value as Severity) : null;
};

/** One preview row under a summary card. */
function PreviewRow({
  issue,
  showResolvedAt = false,
}: {
  issue: OverviewIssue;
  showResolvedAt?: boolean;
}) {
  const severity = severityOf(issue.severity);
  return (
    <li>
      <Link
        href={`/issues/${issue.id}`}
        className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2 transition hover:border-slate-200 hover:bg-slate-100/70"
      >
        <span className="line-clamp-1 text-xs font-medium leading-snug text-slate-900">
          <span className="mr-1.5 font-mono font-semibold text-teal-700">
            {formatIssueNumber(issue.number)}
          </span>
          {issue.title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <Badge className={statusClass[issue.status]}>{statusLabels[issue.status]}</Badge>
          {severity ? (
            <Badge className={severityClass[severity]}>{severityLabel[severity]}</Badge>
          ) : null}
          {showResolvedAt && issue.resolvedAt ? (
            <span className="ml-auto text-slate-500">
              <RelativeTime date={issue.resolvedAt} />
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function SummaryCard({
  title,
  value,
  children,
  href,
  linkLabel,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300">
      <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
        <h2 className="text-xs font-medium text-slate-600 sm:text-sm">{title}</h2>
        <p className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {value}
        </p>
      </div>
      <div className="mt-3 flex-1 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Recent {linkLabel.toLowerCase()}
        </p>
        {children}
      </div>
      <Link
        href={href}
        className="mt-3 text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
      >
        View all {linkLabel.toLowerCase()} →
      </Link>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  let tenantId: string | null = null;
  try {
    tenantId = await currentTenantIdFor(user.id);
  } catch (error) {
    console.error("[dashboard] tenant resolution failed", error);
  }

  let overview: WorkspaceOverview = EMPTY_OVERVIEW;
  try {
    overview = await loadWorkspaceOverview({ userId: user.id, tenantId });
  } catch (error) {
    console.error("[dashboard] overview queries failed", error);
  }

  let agentRows: Awaited<ReturnType<typeof loadOwnAgents>> = [];
  try {
    agentRows = await loadOwnAgents({ userId: user.id, tenantId });
  } catch (error) {
    console.error("[dashboard] agents query failed", error);
  }

  const agents: DashboardAgentView[] = agentRows.map((agent) => ({
    ...agent,
    lastSeenAt: agent.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
  }));

  const pointsLabel = `${overview.points.points}`;
  const unresolvedEmpty = overview.recentUnresolved.length === 0;
  const resolvedEmpty = overview.recentResolved.length === 0;

  return (
    <div className="flex items-start gap-6">
      <DashboardSidebar
        counts={{
          unresolved: overview.unresolvedCount,
          assigned: overview.assignedToMe,
          reported: overview.reportedByMe,
        }}
        userName={user.name ?? user.email}
        userImage={user.image}
        userEmail={user.email}
      />

      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your workspace at a glance — issues, resolutions, and your agents.
          </p>
        </div>

        <section
          aria-label="Workspace summary"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <SummaryCard
            title="Issues"
            value={String(overview.unresolvedCount)}
            href="/issues?project=all"
            linkLabel="issues"
          >
            {unresolvedEmpty ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                No unresolved issues in this workspace.
              </p>
            ) : (
              <ul className="space-y-2">
                {overview.recentUnresolved.map((issue) => (
                  <PreviewRow key={issue.id} issue={issue} />
                ))}
              </ul>
            )}
          </SummaryCard>

          <SummaryCard
            title="Resolved"
            value={String(overview.resolvedCount)}
            href="/issues?project=all&status=resolved"
            linkLabel="resolved issues"
          >
            {resolvedEmpty ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                Nothing resolved yet — finished work will show up here.
              </p>
            ) : (
              <ul className="space-y-2">
                {overview.recentResolved.map((issue) => (
                  <PreviewRow key={issue.id} issue={issue} showResolvedAt />
                ))}
              </ul>
            )}
          </SummaryCard>

          <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300">
            <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-medium text-slate-600 sm:text-sm">Points</h2>
              <p className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {pointsLabel}
                <span className="ml-1 text-sm font-semibold text-slate-500">pts</span>
              </p>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Rank</dt>
                <dd className="font-semibold text-slate-900">
                  {overview.rank ? `#${overview.rank.rank} of ${overview.rank.total}` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Solved tasks</dt>
                <dd className="font-semibold text-slate-900">{overview.points.solvedTasks}</dd>
              </div>
            </dl>
            <Link
              href="/leaderboard"
              className="mt-3 text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              View leaderboard →
            </Link>
          </section>
        </section>

        <DashboardAgents initial={agents} />
      </div>
    </div>
  );
}
