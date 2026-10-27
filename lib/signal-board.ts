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
