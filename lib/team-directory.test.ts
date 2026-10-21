import { describe, expect, it, vi } from "vitest";
import {
  TEAM_ONLINE_WINDOW_MS,
  isTeamAgentOnline,
  teamAgentsForMembers,
  teamMetricSince,
} from "./team-directory";

describe("team directory metrics", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  it("uses the 15-minute heartbeat window and a rolling 30-day metric period", () => {
    expect(isTeamAgentOnline(new Date(now.getTime() - TEAM_ONLINE_WINDOW_MS + 1), now)).toBe(true);
    expect(isTeamAgentOnline(new Date(now.getTime() - TEAM_ONLINE_WINDOW_MS), now)).toBe(false);
    expect(isTeamAgentOnline(null, now)).toBe(false);
    expect(teamMetricSince(now)).toEqual(new Date("2026-09-20T12:00:00Z"));
  });

  it("loads only active agents and tenant-scoped work and counts accepted fixes once per issue", async () => {
    const agentFindMany = vi.fn().mockResolvedValue([
      {
        id: "agent-1",
        ownerUserId: "person-1",
        name: "Ada's agent",
        model: "Claude",
        level: "reviewer",
        claims: [
          {
            claimedAt: new Date(now.getTime() - 5 * 60 * 1000),
            lastHeartbeatAt: null,
            bug: { id: "issue-current", title: "Current work", categoryId: "area-1", category: { name: "Web" } },
          },
        ],
      },
      {
        id: "agent-2",
        ownerUserId: "person-1",
        name: "Ada's second agent",
        model: null,
        level: "observer",
        claims: [],
      },
    ]);
    const fixedClaimFindMany = vi.fn().mockResolvedValue([
      { agentId: "agent-1", bugId: "issue-fixed" },
      { agentId: "agent-1", bugId: "issue-fixed" },
    ]);
    const db = {
      agent: { findMany: agentFindMany },
      issueClaim: { findMany: fixedClaimFindMany },
    };

    const result = await teamAgentsForMembers(db as never, "tenant-1", ["person-1"], now);

    expect(agentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-1", ownerUserId: { in: ["person-1"] }, revokedAt: null },
      select: expect.objectContaining({
        claims: expect.objectContaining({
          where: expect.objectContaining({
            status: "active",
            releasedAt: null,
            bug: { tenantId: "tenant-1", isDeleted: false, status: "in_progress" },
          }),
        }),
      }),
    }));
    expect(fixedClaimFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        agentId: { in: ["agent-1", "agent-2"] },
        status: "released",
        releasedAt: { not: null },
        releaseReason: "resolved",
        bug: expect.objectContaining({
          tenantId: "tenant-1",
          pointEntries: {
            some: expect.objectContaining({
              tenantId: "tenant-1",
              role: "solver",
              points: { gt: 0 },
              correctedAt: null,
              createdAt: { gte: teamMetricSince(now) },
            }),
          },
        }),
      }),
    }));
    expect(result.get("person-1")).toEqual([
      {
        id: "agent-1",
        name: "Ada's agent",
        model: "Claude",
        level: "reviewer",
        online: true,
        acceptedFixes: 1,
        currentWork: [{ id: "issue-current", title: "Current work", categoryId: "area-1", categoryName: "Web" }],
      },
      {
        id: "agent-2",
        name: "Ada's second agent",
        model: null,
        level: "observer",
        online: false,
        acceptedFixes: 0,
        currentWork: [],
      },
    ]);
  });

  it("does not query claims when a member has no active agents", async () => {
    const issueClaimFindMany = vi.fn();
    const db = {
      agent: { findMany: vi.fn().mockResolvedValue([]) },
      issueClaim: { findMany: issueClaimFindMany },
    };

    await expect(teamAgentsForMembers(db as never, "tenant-1", ["person-1"], now)).resolves.toEqual(
      new Map([["person-1", []]]),
    );
    expect(issueClaimFindMany).not.toHaveBeenCalled();
  });

  it("skips database reads when there are no member ids", async () => {
    const agentFindMany = vi.fn();
    const db = { agent: { findMany: agentFindMany }, issueClaim: { findMany: vi.fn() } };

    await expect(teamAgentsForMembers(db as never, "tenant-1", [], now)).resolves.toEqual(new Map());
    expect(agentFindMany).not.toHaveBeenCalled();
  });
});
