import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentContext } from "@/lib/agents/require-agent";

export const MISSION_ROLES = ["admin", "member", "signed_out"] as const;
export const MISSION_VIEWPORTS = ["desktop", "mobile_375"] as const;
export const MISSION_LEASE_MS = 30 * 60 * 1000;

const routePatternSchema = z.string().trim().min(1).max(240)
  .regex(/^\/[A-Za-z0-9_.*:/-]*$/, "Use a route path such as /settings/**.")
  .refine((value) => !value.includes(".."), "Route patterns cannot contain '..'.");

export const createMissionSchema = z.object({
  routePattern: routePatternSchema,
  brief: z.string().trim().min(1).max(500),
  roles: z.array(z.enum(MISSION_ROLES)).min(1).max(MISSION_ROLES.length),
  viewports: z.array(z.enum(MISSION_VIEWPORTS)).min(1).max(MISSION_VIEWPORTS.length),
}).strict();

export const nextMissionSchema = z.object({ projectId: z.string().trim().min(1).max(191) }).strict();
export const missionCoverageSchema = z.object({
  issuesFiled: z.number().int().min(0).max(1000),
}).strict();

export type MissionRoleValue = (typeof MISSION_ROLES)[number];
export type MissionViewportValue = (typeof MISSION_VIEWPORTS)[number];

export type CreateMissionInput = {
  routePattern: string;
  brief: string;
  roles: readonly MissionRoleValue[];
  viewports: readonly MissionViewportValue[];
};

export async function createTestMissions(projectId: string, input: CreateMissionInput) {
  const routePattern = routePatternSchema.parse(input.routePattern);
  const brief = z.string().trim().min(1).max(500).parse(input.brief);
  const data = input.roles.flatMap((role) => input.viewports.map((viewport) => ({
    projectId, routePattern, brief, role, viewport,
  })));
  return prisma.testMission.createMany({ data, skipDuplicates: true });
}

/**
 * Assign the least recently covered available mission. A project row lock
 * serializes competing agents so a mission cannot be handed out twice at once.
 * Owners who did not receive the previous mission get first preference.
 */
export async function nextTestMission(agent: AgentContext, projectId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
    const now = new Date();
    const include = { project: { select: { name: true, stagingUrl: true } } } as const;
    const current = await tx.testMission.findFirst({
      where: { projectId, leaseAgentId: agent.agentId, leaseOwnerId: agent.ownerId, leaseExpiresAt: { gt: now } },
      include,
    });
    if (current) return current;

    const available = { OR: [{ leaseAgentId: null }, { leaseExpiresAt: { lte: now } }] };
    const orderBy = [
      { lastCoveredAt: { sort: "asc" as const, nulls: "first" as const } },
      { lastAssignedAt: { sort: "asc" as const, nulls: "first" as const } },
      { id: "asc" as const },
    ];
    const otherOwner = await tx.testMission.findFirst({
      where: {
        projectId,
        ...available,
        AND: [{ OR: [{ lastAssignedOwnerId: null }, { lastAssignedOwnerId: { not: agent.ownerId } }] }],
      },
      orderBy,
      include,
    });
    const mission = otherOwner ?? await tx.testMission.findFirst({
      where: { projectId, ...available }, orderBy, include,
    });
    if (!mission) return null;

    const leaseExpiresAt = new Date(now.getTime() + MISSION_LEASE_MS);
    return tx.testMission.update({
      where: { id: mission.id },
      data: {
        lastAssignedAt: now,
        lastAssignedOwnerId: agent.ownerId,
        leaseAgentId: agent.agentId,
        leaseOwnerId: agent.ownerId,
        leaseExpiresAt,
      },
      include,
    });
  });
}

export async function coverTestMission(
  agent: AgentContext,
  projectId: string,
  missionId: string,
  issuesFiled: number,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "TestMission" WHERE "id" = ${missionId} FOR UPDATE`;
    const mission = await tx.testMission.findFirst({
      where: {
        id: missionId,
        projectId,
        leaseAgentId: agent.agentId,
        leaseOwnerId: agent.ownerId,
        leaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!mission) return false;
    await tx.testMission.update({
      where: { id: mission.id },
      data: {
        lastCoveredAt: new Date(),
        issuesFiled: { increment: issuesFiled },
        leaseAgentId: null,
        leaseOwnerId: null,
        leaseExpiresAt: null,
      },
    });
    return true;
  });
}
