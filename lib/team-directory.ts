import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const TEAM_ONLINE_WINDOW_MS = 15 * 60 * 1000;
export const TEAM_METRIC_WINDOW_DAYS = 30;

export type TeamAgentWork = {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
};

export type TeamAgent = {
  id: string;
  name: string;
  model: string | null;
  level: "observer" | "contributor" | "reviewer" | "merger";
  online: boolean;
  acceptedFixes: number;
  currentWork: TeamAgentWork[];
};

export function teamMetricSince(now = new Date()): Date {
  return new Date(now.getTime() - TEAM_METRIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function isTeamAgentOnline(lastSeen: Date | null, now = new Date()): boolean {
  return lastSeen !== null && now.getTime() - lastSeen.getTime() < TEAM_ONLINE_WINDOW_MS;
}

export async function teamAgentsForMembers(
  db: Db,
  tenantId: string,
  ownerUserIds: string[],
  now = new Date(),
): Promise<Map<string, TeamAgent[]>> {
  const result = new Map(ownerUserIds.map((ownerUserId) => [ownerUserId, [] as TeamAgent[]]));
  if (ownerUserIds.length === 0) return result;

  const agents = await db.agent.findMany({
    where: { tenantId, ownerUserId: { in: ownerUserIds }, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ownerUserId: true,
      name: true,
      model: true,
      level: true,
      claims: {
        where: {
          status: "active",
          releasedAt: null,
          bug: { tenantId, isDeleted: false, status: "in_progress" },
        },
        select: {
          claimedAt: true,
          lastHeartbeatAt: true,
          bug: {
            select: {
              id: true,
              title: true,
              categoryId: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (agents.length === 0) return result;

  const fixedClaims = await db.issueClaim.findMany({
    where: {
      agentId: { in: agents.map((agent) => agent.id) },
      status: "released",
      releasedAt: { not: null },
      releaseReason: "resolved",
      bug: {
        tenantId,
        pointEntries: {
          some: {
            tenantId,
            role: "solver",
            points: { gt: 0 },
            correctedAt: null,
            createdAt: { gte: teamMetricSince(now) },
          },
        },
      },
    },
    select: { agentId: true, bugId: true },
  });
  const fixesByAgent = new Map<string, Set<string>>();
  for (const claim of fixedClaims) {
    const issues = fixesByAgent.get(claim.agentId) ?? new Set<string>();
    issues.add(claim.bugId);
    fixesByAgent.set(claim.agentId, issues);
  }

  for (const agent of agents) {
    const currentWork = agent.claims.map(({ bug }) => ({
      id: bug.id,
      title: bug.title,
      categoryId: bug.categoryId,
      categoryName: bug.category?.name ?? null,
    }));
    const lastSeen = agent.claims.reduce<Date | null>((latest, claim) => {
      const seen = claim.lastHeartbeatAt ?? claim.claimedAt;
      return seen && (!latest || seen > latest) ? seen : latest;
    }, null);
    const memberAgents = result.get(agent.ownerUserId);
    memberAgents?.push({
      id: agent.id,
      name: agent.name,
      model: agent.model,
      level: agent.level,
      online: isTeamAgentOnline(lastSeen, now),
      acceptedFixes: fixesByAgent.get(agent.id)?.size ?? 0,
      currentWork,
    });
  }
  return result;
}

export async function teamAgentsForMember(
  db: Db,
  tenantId: string,
  ownerUserId: string,
  now = new Date(),
): Promise<TeamAgent[]> {
  const agents = await teamAgentsForMembers(db, tenantId, [ownerUserId], now);
  return agents.get(ownerUserId) ?? [];
}
