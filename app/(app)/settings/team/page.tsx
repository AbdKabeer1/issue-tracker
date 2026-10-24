import Link from "next/link";
import "./team.css";
import { requireUser } from "@/lib/auth-helpers";
import {
  StatusPage,
  primaryActionClass,
  secondaryActionClass,
} from "@/components/status-page";
import { databaseErrorReason } from "@/lib/db-error";
import { prisma } from "@/lib/prisma";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { workflowFor } from "@/lib/workflow";
import { DEFAULT_PROJECT_WORKFLOW } from "@/lib/workflow-config";
import { projectContextFor } from "@/lib/project-context";
import { teamAgentsForMembers, teamMetricSince } from "@/lib/team-directory";
import { TeamMemberRow } from "./team-member-row";
import { TeamAgentTable } from "./team-agent-table";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { settableLevels } from "@/lib/agents/levels";
import { pointsNumber } from "@/lib/points/rules";

export const metadata = { title: "Team" };

type TeamPageProps = {
  searchParams: Promise<{ online?: string; capacity?: string; area?: string }>;
};

/** The team directory at its settings home: members with filters for online status and capacity, plus agent activity and points. */
export default async function TeamPage({ searchParams }: TeamPageProps) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) {
    return (
      <div className="team-page mx-auto flex w-full flex-col gap-6 pb-10">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Team</h1>
        <section className="team-empty">
          <h2>No workspace yet</h2>
          <p>Join or create a workspace to see its team directory.</p>
          <Link href="/tenants" className="team-primary">Create or join a workspace</Link>
        </section>
      </div>
    );
  }

  const filters = await searchParams;
  let context;
  let members;
  let agentsMap;
  let points;
  let activeClaims;
  let maxActiveClaims;
  try {
    context = await projectContextFor(prisma, tenantId);
    members = await prisma.membership.findMany({
      where: { tenantId },
      orderBy: { user: { name: "asc" } },
      select: { role: true, user: { select: { id: true, name: true } } },
    });
    const memberIds = members.map(({ user: member }) => member.id);
    const since = teamMetricSince();
    [agentsMap, points, activeClaims] = await Promise.all([
      teamAgentsForMembers(prisma, tenantId, memberIds),
      prisma.pointEntry.groupBy({
        by: ["userId"],
        where: { tenantId, createdAt: { gte: since } },
        _sum: { points: true },
      }),
      prisma.issueClaim.groupBy({
        by: ["beneficiaryUserId"],
        where: {
          beneficiaryUserId: { in: memberIds },
          status: "active",
          releasedAt: null,
          bug: { tenantId, ...(context.activeProjectId ? { projectId: context.activeProjectId } : {}) },
        },
        _count: { _all: true },
      }),
    ]);
    maxActiveClaims = context.activeProjectId
      ? (await workflowFor(context.activeProjectId)).maxActiveClaims
      : DEFAULT_PROJECT_WORKFLOW.maxActiveClaims;
  } catch (error) {
    console.error("[team] directory failed", error);
    const reason = databaseErrorReason(error) ?? "The team directory could not be read.";
    return (
      <StatusPage
        title="This page didn't load"
        actions={
          <>
            <Link href="/settings/team" className={primaryActionClass}>
              Try again
            </Link>
            <Link href="/issues" className={secondaryActionClass}>
              Go to issues
            </Link>
          </>
        }
      >
        <p>{reason}</p>
      </StatusPage>
    );
  }
  const viewerMembership = members.find((membership) => membership.user.id === user.id);
  const manageLevels = isTenantAdminRole(viewerMembership?.role, user.role)
    ? settableLevels({ isOwner: false, isTenantAdmin: true })
    : null;
  const pointsMap = new Map(points.map((row) => [row.userId, pointsNumber(row._sum.points)]));
  const activeClaimMap = new Map(activeClaims.map((row) => [row.beneficiaryUserId, row._count._all]));
  const showOnlineOnly = filters.online === "1";
  const showCapacityOnly = filters.capacity === "1";
  const capacityScope = context.activeProjectId ? "selected project" : "workspace";

  const visibleMembers = members.flatMap((membership) => {
    const { user: member } = membership;
    const memberAgents = agentsMap.get(member.id) ?? [];
    const hasCapacity = (activeClaimMap.get(member.id) ?? 0) < maxActiveClaims;
    const matchingAgents = memberAgents.filter((agent) => !showOnlineOnly || agent.online);
    if (
      (showOnlineOnly && matchingAgents.length === 0) ||
      (showCapacityOnly && (!hasCapacity || memberAgents.length === 0))
    ) return [];
    const visibleAgents = showOnlineOnly ? matchingAgents : memberAgents;
    return [{ ...membership, agents: visibleAgents, points: pointsMap.get(member.id) ?? 0, activeClaims: activeClaimMap.get(member.id) ?? 0 }];
  });

  return (
    <div className="team-page mx-auto flex w-full flex-col gap-6 pb-10">
      <header className="team-heading">
        <div className="team-heading-main">
        <div className="space-y-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Team</h1>
        <p className="text-sm text-zk-muted">People, agents, and current work across your workspace.</p>
        <details className="team-activity-note">
        <summary>How activity and permissions work</summary>
        <p className="text-sm text-zk-muted">
          People and their active agents in this workspace. Online means an agent has used the API, claimed an issue or sent a claim heartbeat in the last 15 minutes; points and accepted fixes cover the last 30 days.
          {manageLevels ? " As an admin you can change anyone's agent role here, including dispatcher and merger." : ""}
        </p>
        </details>
        </div>
        </div>
      </header>

      <form id="team-filter-form" action="/settings/team" method="get" className="team-filters">
        <fieldset>
          <legend className="sr-only">Filter team</legend>
          <div className="team-filter-track">
            <label className="team-filter-pill">
              <input type="checkbox" name="online" value="1" defaultChecked={showOnlineOnly} className="size-4 accent-electric-blue-strong" />
              Online now
            </label>
            <label className="team-filter-pill">
              <input type="checkbox" name="capacity" value="1" defaultChecked={showCapacityOnly} className="size-4 accent-electric-blue-strong" />
              Has capacity
            </label>
            {(showOnlineOnly || showCapacityOnly) ? (
              <Link href="/settings/team" className="text-sm font-bold text-zk-accent underline">Clear filters</Link>
            ) : null}
          </div>
        </fieldset>
        <button type="submit" className="team-primary team-apply">Apply filters</button>
      </form>

      {visibleMembers.length === 0 ? (
        <p className="rounded-[20px] border border-zk-border bg-zk-surface p-6 text-sm text-zk-muted">
          {members.length === 0
            ? "This workspace has no members yet."
            : "No team members match these filters."}
        </p>
      ) : (
        // The overflowing table region needs keyboard focus for horizontal arrow-key scrolling.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <div className="team-table-scroll" role="region" aria-label="Workspace members" tabIndex={0}>
        <table className="team-table">
          <caption className="sr-only">Workspace members, points in the last 30 days, active claims in the {capacityScope}, and their agents</caption>
          <thead><tr>
            <th scope="col">Member</th>
            <th scope="col">Workspace role</th>
            <th scope="col">Points <span>Last 30 days</span></th>
            <th scope="col">Active claims <span>{capacityScope === "workspace" ? "Workspace" : "Selected project"}</span></th>
            <th scope="col">Agents</th>
          </tr></thead>
          <tbody>
          {visibleMembers.map(({ user: member, role, agents, points: memberPoints, activeClaims: claimCount }) => (
            <TeamMemberRow key={member.id} member={member} role={role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member"} points={memberPoints} claims={claimCount} limit={maxActiveClaims} agentCount={agents.length} onlineCount={agents.filter((agent) => agent.online).length}>
              <TeamAgentTable agents={agents} manageLevels={manageLevels} memberName={member.name} />
            </TeamMemberRow>
          ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
