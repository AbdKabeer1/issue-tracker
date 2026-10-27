export type SignalStage =
  | "report"
  | "confirm"
  | "plan"
  | "build"
  | "verify"
  | "ship";

export type SignalState = "working" | "waiting" | "idle" | "offline";

export type SignalView = "all" | "mine" | "needs" | "running" | "down";

export type SignalWorkerKind = "agent" | "bot" | "person";

export type SignalWorker = {
  id: string;
  name: string;
  kind: SignalWorkerKind;
};

export type SignalChannel = {
  id: string;
  number: number;
  title: string;
  status: string;
  severity: string | null;
  voteCount: number;
  commentCount: number;
  worker: SignalWorker | null;
  stage: SignalStage;
  chainStage: "plan" | "build" | "verify";
  state: SignalState;
  activity: string | null;
  lastSignalAt: string | null;
  hasPendingApproval: boolean;
};

export type SignalDecision = {
  id: string;
  issueNumber: number;
  issueTitle: string;
  stage: "before_offer" | "before_merge";
  ruleReason: string | null;
  createdAt: string;
};

export type SignalWorkforce = {
  id: string;
  name: string;
  kind: "agent" | "bot";
  level: string;
  state: SignalState;
  currentWork: string | null;
  lastSeenAt: string | null;
};

export type OperationsBrief = {
  openIssues: number;
  autoResolved: number;
  pendingDecisions: number;
  automationPct: number;
  highPriority: number;
};

type SignalStageInput = {
  status: "open" | "in_progress" | "resolved" | "closed";
  intakeStage: "reported" | "confirmed" | "ready" | null;
  hasActiveClaim: boolean;
  hasAssignee: boolean;
  hasPullRequest: boolean;
  hasTestVerdict: boolean;
  hasPendingMergeApproval: boolean;
};

export function signalStageFor(input: SignalStageInput): SignalStage {
  if (input.status === "resolved" || input.status === "closed") return "ship";

  if (input.status === "open") {
    if (input.intakeStage === "reported") return "report";
    if (input.intakeStage === "confirmed") return "confirm";
    if (input.intakeStage === "ready") return "plan";
    return "report";
  }

  if (input.hasPullRequest || input.hasTestVerdict || input.hasPendingMergeApproval) {
    return "verify";
  }

  return "build";
}

export function chainStageFor(stage: SignalStage): "plan" | "build" | "verify" {
  if (stage === "build") return "build";
  if (stage === "verify" || stage === "ship") return "verify";
  return "plan";
}

export function workerStateFor(input: {
  online: boolean;
  waiting: boolean;
  activeClaim: boolean;
}): SignalState {
  if (input.waiting) return "waiting";
  if (input.online && input.activeClaim) return "working";
  if (input.online) return "idle";
  return "offline";
}

export function parseSignalView(raw: string | null | undefined): SignalView {
  if (raw === "mine" || raw === "needs" || raw === "running" || raw === "down") {
    return raw;
  }
  return "all";
}

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bugInTenant } from "@/lib/tenant-context";
import { openIssueStages } from "@/lib/issue-stage";
import { isTeamAgentOnline } from "@/lib/team-directory";

const SIGNAL_LIMIT = 25;

function levelKind(level: string): "agent" | "bot" {
  return level === "contributor" || level === "observer" ? "bot" : "agent";
}

function latestDate(...dates: (Date | null | undefined)[]): Date | null {
  let newest: Date | null = null;
  for (const date of dates) {
    if (date && (!newest || date > newest)) newest = date;
  }
  return newest;
}

function ruleReason(rule: {
  issueType?: { name: string } | null;
  severity?: string | null;
  fileGlob?: string | null;
} | null): string | null {
  if (!rule) return null;
  const parts: string[] = [];
  if (rule.issueType?.name) parts.push(`type: ${rule.issueType.name}`);
  if (rule.severity) parts.push(`severity: ${rule.severity}`);
  if (rule.fileGlob) parts.push(`files: ${rule.fileGlob}`);
  return parts.length ? parts.join(" · ") : null;
}

function viewWhere(tenantId: string, userId: string, view: SignalView): Prisma.BugWhereInput {
  const base: Prisma.BugWhereInput = { ...bugInTenant(tenantId), isDeleted: false };
  if (view === "mine") {
    return { ...base, OR: [{ assigneeId: userId }, { reporterId: userId }] };
  }
  if (view === "needs") {
    return {
      ...base,
      OR: [
        { approvals: { some: { status: "pending" } } },
        { agentQuestions: { some: { answeredAt: null } } },
      ],
    };
  }
  if (view === "running") {
    return { ...base, status: "in_progress" };
  }
  return base;
}

export async function loadSignalChannels(input: {
  tenantId: string;
  userId: string;
  view: SignalView;
  limit?: number;
}): Promise<{ channels: SignalChannel[]; total: number }> {
  const limit = input.limit ?? SIGNAL_LIMIT;
  const where = viewWhere(input.tenantId, input.userId, input.view);

  const [bugs, stages] = await Promise.all([
    prisma.bug.findMany({
      where,
      orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
      take: input.view === "down" ? Math.max(limit * 4, 100) : limit,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        severity: true,
        voteCount: true,
        pullRequestUrl: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true } },
        type: { select: { name: true } },
        _count: { select: { comments: true } },
        claims: {
          where: { status: "active", releasedAt: null },
          orderBy: [{ claimedAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            claimedAt: true,
            lastHeartbeatAt: true,
            agent: {
              select: {
                id: true,
                name: true,
                level: true,
                apiKeys: { where: { revokedAt: null }, select: { lastUsedAt: true } },
              },
            },
          },
        },
        approvals: { where: { status: "pending" }, select: { id: true, stage: true } },
        testVerdicts: { select: { id: true }, take: 1 },
        activities: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { summary: true, createdAt: true },
        },
      },
    }),
    openIssueStages(prisma, where),
  ]);

  const now = new Date();
  const channels = bugs.map((bug) => {
    const claim = bug.claims[0] ?? null;
    const agent = claim?.agent ?? null;
    const worker = agent
      ? { id: agent.id, name: agent.name, kind: levelKind(agent.level) }
      : bug.assignee
        ? { id: bug.assignee.id, name: bug.assignee.name, kind: "person" as const }
        : null;

    const lastSeen = agent
      ? latestDate(
          ...agent.apiKeys.map((key) => key.lastUsedAt),
          claim?.lastHeartbeatAt,
          claim?.claimedAt,
        )
      : null;
    const online = agent ? isTeamAgentOnline(lastSeen, now) : false;
    const pending = bug.approvals.length > 0;
    const state = pending
      ? "waiting"
      : worker?.kind === "person"
        ? bug.status === "in_progress" ? "working" : "idle"
        : worker
          ? workerStateFor({ online, waiting: false, activeClaim: Boolean(claim) })
          : "idle";

    const stage = signalStageFor({
      status: bug.status as "open" | "in_progress" | "resolved" | "closed",
      intakeStage: stages.get(bug.id) ?? null,
      hasActiveClaim: Boolean(claim),
      hasAssignee: Boolean(bug.assigneeId),
      hasPullRequest: Boolean(bug.pullRequestUrl),
      hasTestVerdict: bug.testVerdicts.length > 0,
      hasPendingMergeApproval: bug.approvals.some((approval) => approval.stage === "before_merge"),
    });

    return {
      id: bug.id,
      number: bug.number,
      title: bug.title,
      status: bug.status,
      severity: bug.severity,
      voteCount: bug.voteCount,
      commentCount: bug._count.comments,
      worker,
      stage,
      chainStage: chainStageFor(stage),
      state,
      activity: bug.activities[0]?.summary ?? null,
      lastSignalAt: bug.activities[0]?.createdAt.toISOString() ?? null,
      hasPendingApproval: pending,
    } satisfies SignalChannel;
  });

  if (input.view === "down") {
    const down = channels.filter((channel) => channel.state === "offline").slice(0, limit);
    return { channels: down, total: down.length };
  }

  const total = await prisma.bug.count({ where });
  return { channels, total };
}

export async function loadSignalDecisions(tenantId: string): Promise<SignalDecision[]> {
  const approvals = await prisma.issueApproval.findMany({
    where: { status: "pending", bug: { tenantId, isDeleted: false } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
    select: {
      id: true,
      stage: true,
      createdAt: true,
      bug: { select: { number: true, title: true } },
      rule: {
        select: {
          issueType: { select: { name: true } },
          severity: true,
          fileGlob: true,
        },
      },
    },
  });

  return approvals.map((approval) => ({
    id: approval.id,
    issueNumber: approval.bug.number,
    issueTitle: approval.bug.title,
    stage: approval.stage === "before_merge" ? "before_merge" : "before_offer",
    ruleReason: ruleReason(approval.rule),
    createdAt: approval.createdAt.toISOString(),
  }));
}

export async function loadSignalWorkforce(tenantId: string): Promise<SignalWorkforce[]> {
  const agents = await prisma.agent.findMany({
    where: { tenantId, revokedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      level: true,
      apiKeys: { where: { revokedAt: null }, select: { lastUsedAt: true } },
      questions: { where: { answeredAt: null }, take: 1, select: { id: true } },
      claims: {
        where: { status: "active", releasedAt: null },
        orderBy: [{ claimedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true,
          claimedAt: true,
          lastHeartbeatAt: true,
          bug: { select: { number: true, title: true } },
        },
      },
    },
  });

  const now = new Date();
  return agents.map((agent) => {
    const claim = agent.claims[0] ?? null;
    const lastSeen = latestDate(
      ...agent.apiKeys.map((key) => key.lastUsedAt),
      claim?.lastHeartbeatAt,
      claim?.claimedAt,
    );
    const online = isTeamAgentOnline(lastSeen, now);
    return {
      id: agent.id,
      name: agent.name,
      kind: levelKind(agent.level),
      level: agent.level,
      state: workerStateFor({
        online,
        waiting: agent.questions.length > 0,
        activeClaim: Boolean(claim),
      }),
      currentWork: claim ? `#${claim.bug.number} ${claim.bug.title}` : null,
      lastSeenAt: lastSeen?.toISOString() ?? null,
    } satisfies SignalWorkforce;
  });
}

export async function loadSignalBrief(tenantId: string): Promise<OperationsBrief> {
  const base: Prisma.BugWhereInput = {
    ...bugInTenant(tenantId),
    isDeleted: false,
    status: { in: ["open", "in_progress"] },
  };
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [openIssues, highPriority, pendingDecisions, autoResolved, covered] = await Promise.all([
    prisma.bug.count({ where: base }),
    prisma.bug.count({ where: { ...base, severity: { in: ["high", "critical"] } } }),
    prisma.issueApproval.count({
      where: { status: "pending", bug: { tenantId, isDeleted: false } },
    }),
    prisma.issueClaim.count({
      where: {
        status: "released",
        releaseReason: "resolved",
        releasedAt: { gte: since },
        bug: { tenantId, isDeleted: false },
      },
    }),
    prisma.issueClaim.count({
      where: {
        status: "active",
        releasedAt: null,
        bug: { tenantId, isDeleted: false, status: "in_progress" },
      },
    }),
  ]);

  return {
    openIssues,
    autoResolved,
    pendingDecisions,
    automationPct: openIssues === 0 ? 0 : Math.round((covered / openIssues) * 100),
    highPriority,
  };
}
