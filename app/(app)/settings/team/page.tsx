import Link from "next/link";
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
import { TeamAgentList } from "@/components/team-agent-list";
import { Badge } from "@/components/ui/badge";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { settableLevels } from "@/lib/agents/levels";

export const metadata = { title: "Team" };

type TeamPageProps = {
  searchParams: Promise<{ online?: string; capacity?: string; area?: string }>;
};

/** The team directory at its settings home: members with filters for online status, capacity and area, plus agent activity and points. */
export default async function TeamPage({ searchParams }: TeamPageProps) {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-3 pb-10">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Team</h1>
        <p className="text-sm text-zk-muted">Join or create a workspace to see its team directory.</p>
        <Link href="/tenants" className="text-sm font-bold text-zk-accent underline">Create or join a workspace</Link>
      </div>
    );
  }

  const filters = await searchParams;
  let context;
  let members;
  let areas;
  let agentsMap;
  let points;
  let activeClaims;
  let maxActiveClaims;
  try {
    context = await projectContextFor(prisma, tenantId);
    [members, areas] = await Promise.all([
      prisma.membership.findMany({
        where: { tenantId },
        orderBy: { user: { name: "asc" } },
        select: {
          role: true,
          user: { select: { id: true, name: true } },
        },
      }),
      // The active project's areas (#609), the ones issues are filed under,
      // not its platforms.
      context.activeProjectId
        ? prisma.projectArea.findMany({
            where: { projectId: context.activeProjectId },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
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
  const pointsMap = new Map(points.map((row) => [row.userId, row._sum.points ?? 0]));
  const activeClaimMap = new Map(activeClaims.map((row) => [row.beneficiaryUserId, row._count._all]));
  const selectedArea = areas.some((area) => area.id === filters.area) ? filters.area : "";
  const showOnlineOnly = filters.online === "1";
  const showCapacityOnly = filters.capacity === "1";
  const capacityScope = context.activeProjectId ? "selected project" : "workspace";

  const visibleMembers = members.flatMap((membership) => {
    const { user: member } = membership;
    const memberAgents = agentsMap.get(member.id) ?? [];
    const hasCapacity = (activeClaimMap.get(member.id) ?? 0) < maxActiveClaims;
    const matchingAgents = memberAgents.filter((agent) =>
      (!showOnlineOnly || agent.online) &&
      (!selectedArea || agent.currentWork.some((issue) => issue.areaId === selectedArea)),
    );
    if (
      ((showOnlineOnly || selectedArea) && matchingAgents.length === 0) ||
      (showCapacityOnly && (!hasCapacity || memberAgents.length === 0))
    ) return [];
    const visibleAgents = showOnlineOnly || selectedArea ? matchingAgents : memberAgents;
    return [{ ...membership, agents: visibleAgents, points: pointsMap.get(member.id) ?? 0, activeClaims: activeClaimMap.get(member.id) ?? 0 }];
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 pb-10">
      <div className="space-y-1">
        <Link href="/settings?section=agents" className="inline-flex min-h-8 items-center gap-1.5 self-start text-sm font-semibold text-zk-accent hover:underline">
          Back to settings
        </Link>
      </div>
      <header className="space-y-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-zk-text">Team</h1>
        <p className="text-sm text-zk-muted">
          People and their active agents in this workspace. Online means an agent has used the API, claimed an issue or sent a claim heartbeat in the last 15 minutes; points and accepted fixes cover the last 30 days.
          {manageLevels ? " As an admin you can change anyone's agent role here, including dispatcher and merger." : ""}
        </p>
      </header>

      <form action="/settings/team" method="get" className="rounded-[20px] border border-zk-border bg-zk-surface p-4">
        <fieldset>
          <legend className="text-sm font-bold text-zk-text">Filter team</legend>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex items-center gap-2 text-sm text-zk-text2">
              <input type="checkbox" name="online" value="1" defaultChecked={showOnlineOnly} className="size-4 accent-electric-blue-strong" />
              Online now
            </label>
            <label className="flex items-center gap-2 text-sm text-zk-text2">
              <input type="checkbox" name="capacity" value="1" defaultChecked={showCapacityOnly} className="size-4 accent-electric-blue-strong" />
              Has capacity
            </label>
            {areas.length > 0 ? (
              <label className="flex flex-col gap-1 text-sm text-zk-text2">
                Area
                <select name="area" defaultValue={selectedArea} className="min-h-11 rounded-xl border border-zk-border bg-zk-surface px-3 text-zk-text">
                  <option value="">All areas</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
              </label>
            ) : null}
            <button type="submit" className="min-h-11 rounded-full bg-electric-blue-strong px-5 text-sm font-bold text-white hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2">
              Apply filters
            </button>
            {(showOnlineOnly || showCapacityOnly || selectedArea) ? (
              <Link href="/settings/team" className="text-sm font-bold text-zk-accent underline">Clear filters</Link>
            ) : null}
          </div>
        </fieldset>
      </form>

      {visibleMembers.length === 0 ? (
        <p className="rounded-[20px] border border-zk-border bg-zk-surface p-6 text-sm text-zk-muted">
          {members.length === 0
            ? "This workspace has no members yet."
            : "No team members match these filters."}
        </p>
      ) : (
        <ul aria-label="Workspace members" className="grid gap-4 md:grid-cols-2">
          {visibleMembers.map(({ user: member, role, agents, points: memberPoints, activeClaims: claimCount }) => (
            <li key={member.id} className="min-w-0 rounded-[20px] border border-zk-border bg-zk-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 break-words text-lg font-bold text-zk-text">
                  <Link href={`/users/${member.id}`} className="hover:text-zk-accent hover:underline">{member.name}</Link>
                </h2>
                <Badge className="rounded-full bg-zk-chip text-zk-text2">{role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member"}</Badge>
              </div>
              <p className="mt-1 text-sm text-zk-muted">
                {memberPoints} points in the last 30 days · {claimCount}/{maxActiveClaims} active claims in the {capacityScope}
              </p>
              <TeamAgentList agents={agents} manageLevels={manageLevels} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
