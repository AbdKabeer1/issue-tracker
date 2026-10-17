import type { MilestoneProgress } from "@/lib/milestones";

/** Closed / total as a bar plus the numbers, so it isn't colour-only (#289). */
export function MilestoneProgressBar({
  progress,
  label,
}: {
  progress: MilestoneProgress;
  /** Names the bar for screen readers, e.g. the milestone title. */
  label: string;
}) {
  return (
    <div>
      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.done} of ${progress.total} issues done`}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-teal-600 transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-600 tabular-nums">
        {progress.total === 0
          ? "No issues yet"
          : `${progress.done} of ${progress.total} done · ${progress.percent}%`}
      </p>
    </div>
  );
}
