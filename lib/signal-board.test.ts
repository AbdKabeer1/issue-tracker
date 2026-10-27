import { describe, expect, it } from "vitest";
import { chainStageFor, parseSignalView, signalStageFor, workerStateFor } from "./signal-board";

describe("signalStageFor", () => {
  it("maps open intake stages", () => {
    expect(signalStageFor({ status: "open", intakeStage: "reported", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("report");
    expect(signalStageFor({ status: "open", intakeStage: "confirmed", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("confirm");
    expect(signalStageFor({ status: "open", intakeStage: "ready", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("plan");
  });
  it("maps build and verify", () => {
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("build");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: true, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("verify");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: true, hasPendingMergeApproval: false })).toBe("verify");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: true })).toBe("verify");
  });
  it("maps ship and collapses the chain", () => {
    expect(signalStageFor({ status: "resolved", intakeStage: null, hasActiveClaim: false, hasAssignee: false, hasPullRequest: true, hasTestVerdict: true, hasPendingMergeApproval: false })).toBe("ship");
    expect(chainStageFor("report")).toBe("plan");
    expect(chainStageFor("confirm")).toBe("plan");
    expect(chainStageFor("plan")).toBe("plan");
    expect(chainStageFor("build")).toBe("build");
    expect(chainStageFor("verify")).toBe("verify");
    expect(chainStageFor("ship")).toBe("verify");
  });
  it("maps worker states and view params", () => {
    expect(workerStateFor({ online: true, waiting: false, activeClaim: true })).toBe("working");
    expect(workerStateFor({ online: true, waiting: true, activeClaim: false })).toBe("waiting");
    expect(workerStateFor({ online: true, waiting: false, activeClaim: false })).toBe("idle");
    expect(workerStateFor({ online: false, waiting: false, activeClaim: false })).toBe("offline");
    expect(parseSignalView("mine")).toBe("mine");
    expect(parseSignalView("nope")).toBe("all");
  });
});

import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bugFindMany: vi.fn(),
  bugCount: vi.fn(),
  approvalFindMany: vi.fn(),
  approvalCount: vi.fn(),
  claimCount: vi.fn(),
  agentFindMany: vi.fn(),
  openIssueStages: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bug: { findMany: mocks.bugFindMany, count: mocks.bugCount },
    issueApproval: { findMany: mocks.approvalFindMany, count: mocks.approvalCount },
    issueClaim: { count: mocks.claimCount },
    agent: { findMany: mocks.agentFindMany },
  },
}));

vi.mock("@/lib/issue-stage", () => ({
  openIssueStages: mocks.openIssueStages,
}));

import {
  loadSignalBrief,
  loadSignalChannels,
  loadSignalDecisions,
  loadSignalWorkforce,
} from "./signal-board";

describe("signal board loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openIssueStages.mockResolvedValue(new Map([["b1", "ready"]]));
    mocks.bugFindMany.mockResolvedValue([
      {
        id: "b1", number: 1, title: "Login button unresponsive", status: "open", severity: "high",
        voteCount: 3, pullRequestUrl: null, assigneeId: null, assignee: null, type: { name: "Bug" },
        _count: { comments: 1 }, claims: [], approvals: [], testVerdicts: [],
        activities: [{ summary: "Reported", createdAt: new Date("2026-10-27T12:00:00Z") }],
      },
      {
        id: "b2", number: 2, title: "Feature: invite links", status: "in_progress", severity: "medium",
        voteCount: 1, pullRequestUrl: "https://github.com/org/repo/pull/2", assigneeId: "u1",
        assignee: { id: "u1", name: "Alice" }, type: { name: "Feature" },
        _count: { comments: 0 }, approvals: [], testVerdicts: [{ id: "v1" }],
        claims: [{ id: "c1", lastHeartbeatAt: new Date(), agent: { id: "a1", name: "planner-02", level: "contributor", apiKeys: [{ lastUsedAt: new Date() }] } }],
        activities: [],
      },
    ]);
    mocks.approvalFindMany.mockResolvedValue([
      {
        id: "ap1", stage: "before_merge", createdAt: new Date("2026-10-27T12:00:00Z"),
        bug: { number: 2, title: "Feature: invite links" },
        rule: { issueType: { name: "Feature" }, severity: "medium", fileGlob: "app/**" },
      },
    ]);
    mocks.agentFindMany.mockResolvedValue([
      {
        id: "a1", name: "planner-02", level: "contributor", ownerUserId: "u1",
        apiKeys: [{ lastUsedAt: new Date() }],
        questions: [], claims: [{ id: "c1", lastHeartbeatAt: new Date(), claimedAt: new Date(), bug: { number: 2, title: "Feature: invite links" } }],
      },
    ]);
    mocks.bugCount.mockResolvedValue(8);
    mocks.approvalCount.mockResolvedValue(1);
    mocks.claimCount.mockResolvedValue(2);
  });

  it("maps channels from issue data", async () => {
    const { channels, total } = await loadSignalChannels({ tenantId: "t1", userId: "u1", view: "all" });
    expect(total).toBe(8);
    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({ number: 1, stage: "plan", chainStage: "plan", state: "idle" });
    expect(channels[1]).toMatchObject({ number: 2, stage: "verify", chainStage: "verify", state: "working" });
    expect(channels[1].worker).toMatchObject({ name: "planner-02", kind: "bot" });
  });

  it("maps pending approvals to decisions", async () => {
    const decisions = await loadSignalDecisions("t1");
    expect(decisions).toEqual([
      { id: "ap1", issueNumber: 2, issueTitle: "Feature: invite links", stage: "before_merge", ruleReason: "type: Feature · severity: medium · files: app/**", createdAt: "2026-10-27T12:00:00.000Z" },
    ]);
  });

  it("maps agents to the workforce", async () => {
    const workers = await loadSignalWorkforce("t1");
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatchObject({ name: "planner-02", kind: "bot", state: "working", currentWork: "#2 Feature: invite links" });
  });

  it("builds the operations brief without points", async () => {
    const brief = await loadSignalBrief("t1");
    expect(brief).toEqual({ openIssues: 8, autoResolved: 2, pendingDecisions: 1, automationPct: 25, highPriority: 8 });
    expect("points" in brief).toBe(false);
  });
});
