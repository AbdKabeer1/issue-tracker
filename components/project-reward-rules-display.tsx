import { SOLVER_POINTS, REPORTER_POINTS, REVIEWER_POINTS } from "@/lib/points/rules";
import type { ProjectRewardConfig } from "@/lib/points/project-rewards";

interface ProjectRewardRulesDisplayProps {
  rewardConfig?: ProjectRewardConfig | null;
}

export function ProjectRewardRulesDisplay({
  rewardConfig,
}: ProjectRewardRulesDisplayProps) {
  const solver = rewardConfig?.solver ?? SOLVER_POINTS;
  const reporter = rewardConfig?.reporter ?? REPORTER_POINTS;
  const reviewer = rewardConfig?.reviewer ?? REVIEWER_POINTS;
  const guidelines = rewardConfig?.guidelines;

  return (
    <div className="rounded-[20px] border border-zk-border bg-zk-surface p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zk-text2">
          Reward & Points Rules
        </h3>
        {rewardConfig ? (
          <span className="rounded-full bg-zk-tint px-2.5 py-0.5 text-xs font-medium text-zk-accent border border-zk-border">
            Custom Project Scheme
          </span>
        ) : (
          <span className="rounded-full bg-zk-chip px-2.5 py-0.5 text-xs font-medium text-zk-text2">
            Standard Workspace Scheme
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-zk-tint p-2.5 border border-zk-divider">
          <span className="text-xs text-zk-muted">Low Severity</span>
          <p className="text-sm font-bold text-zk-text">{solver.low} pts</p>
        </div>
        <div className="rounded-xl bg-zk-tint p-2.5 border border-zk-divider">
          <span className="text-xs text-zk-muted">Medium Severity</span>
          <p className="text-sm font-bold text-zk-text">{solver.medium} pts</p>
        </div>
        <div className="rounded-xl bg-zk-tint p-2.5 border border-zk-divider">
          <span className="text-xs text-zk-muted">High Severity</span>
          <p className="text-sm font-bold text-zk-text">{solver.high} pts</p>
        </div>
        <div className="rounded-xl bg-zk-tint p-2.5 border border-zk-divider">
          <span className="text-xs text-zk-muted">Critical Severity</span>
          <p className="text-sm font-bold text-zk-text">{solver.critical} pts</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl bg-zk-tint px-3 py-2 border border-zk-divider">
          <span className="text-xs font-medium text-zk-text2">Reporter Bounty</span>
          <span className="text-sm font-bold text-zk-text">{reporter} pts</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-zk-tint px-3 py-2 border border-zk-divider">
          <span className="text-xs font-medium text-zk-text2">Reviewer Reward</span>
          <span className="text-sm font-bold text-zk-text">{reviewer} pts</span>
        </div>
      </div>

      {guidelines ? (
        <div className="mt-3 rounded-xl bg-zk-tint p-3 border border-zk-border">
          <p className="text-xs font-semibold text-zk-info-fg">Earning Guidelines:</p>
          <p className="mt-1 text-xs text-zk-accent whitespace-pre-wrap">{guidelines}</p>
        </div>
      ) : null}
    </div>
  );
}
