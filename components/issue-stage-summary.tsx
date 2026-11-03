import { LocalTime } from "@/components/local-time";
import { issueStageLabels } from "@/lib/issue-stage";

/**
 * Stage summary block shown at the top of the Conversation card, replacing
 * the old stage pill + type tabs. Summarises where the issue sits in the
 * intake pipeline and what still needs to happen (#186).
 */
export type StageSummaryProps = {
  intakeStage: import("@/lib/issue-stage").IssueStage | null;
  bug: {
    status: string;
    severity: string;
    title: string;
    number: number;
  };
  agentDecisions: ReadonlyArray<{
    id: string;
    kind: string;
    agentName: string;
    at: Date | string;
    state?: string;
  }>;
};

function stateChip(isComplete: boolean): string {
  return isComplete
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-teal-200 bg-teal-50 text-teal-900";
}

function stateLabel(isComplete: boolean): string {
  return isComplete ? "Complete" : "In progress";
}

function summarySentence(intakeStage: import("@/lib/issue-stage").IssueStage): string {
  if (intakeStage === "ready") {
    return "This is an issue. Reviewers accepted it and it has enough upvotes, so it can be passed on.";
  }
  if (intakeStage === "confirmed") {
    return "This is an idea. Reviewers accepted it. It needs more upvotes before it can be passed on as an issue.";
  }
  return "This is an idea. It becomes an issue when reviewers accept it and three people upvote it. Then it can be passed on.";
}

function pendingText(intakeStage: import("@/lib/issue-stage").IssueStage, isComplete: boolean): string {
  if (isComplete) return "Nothing pending at this stage.";
  if (intakeStage === "reported") {
    return "Waiting for reviewers to accept this idea.";
  }
  return "Waiting for enough upvotes to pass this idea on as an issue.";
}

export function StageSummary({ intakeStage, bug, agentDecisions }: StageSummaryProps) {
  if (!intakeStage) return null;

  const stageLabel = issueStageLabels[intakeStage];
  const isComplete = bug.status !== "open";

  // Tally decisions by kind
  const tally: Record<string, number> = {};
  for (const d of agentDecisions) {
    tally[d.kind] = (tally[d.kind] || 0) + 1;
  }

  // Latest decision
  const latest = agentDecisions.length > 0
    ? [...agentDecisions].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      )[0]
    : null;

  return (
    <section
      aria-label="Stage summary"
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {stageLabel} stage
          </span>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold ${stateChip(
              isComplete,
            )}`}
          >
            {stateLabel(isComplete)}
          </span>
        </div>
      </div>

      <p className="mt-1 text-sm text-slate-800">{summarySentence(intakeStage)}</p>

      {/* Decision type chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(tally).map(([kind, count]) => (
          <span
            key={kind}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
          >
            {count} {kind.charAt(0).toUpperCase() + kind.slice(1)}
          </span>
        ))}
      </div>

      {/* Latest decision */}
      {latest && (
        <p className="mt-3 text-xs text-slate-500">
          Latest ·
          <span className="font-medium">{latest.agentName}</span>{" "}
          {latest.kind} ·
          <LocalTime date={latest.at} />
        </p>
      )}

      {/* Pending */}
      <p className="mt-2 text-xs text-slate-600">{pendingText(intakeStage, isComplete)}</p>
    </section>
  );
}
