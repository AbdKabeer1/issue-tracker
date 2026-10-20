import type { Severity } from "@prisma/client";

/**
 * Point rules for the contributor ledger (#428). Every number here comes from
 * the agent-platform epic (#422); change them there first.
 */

/** Solver points by the severity stored on the issue when it is resolved. */
export const SOLVER_POINTS: Record<Severity, number> = {
  low: 15,
  medium: 25,
  high: 40,
  critical: 60,
};

/** Reporter points, once the bug is accepted as real and not a duplicate. */
export const REPORTER_POINTS = 5;

/** Reviewer points, when a "good to merge" verdict is accepted. */
export const REVIEWER_POINTS = 10;

/**
 * Reviewer points for an independent "real" accept that confirms the issue.
 * Separate from the merge verdict so the same person can earn both.
 */
export const CONFIRMATION_REVIEWER_POINTS = 5;

/** At most this many reviewers earn points on one issue. */
export const MAX_REWARDED_REVIEWERS = 2;

/** The goal is this many points. Solved tasks are counted, not required. */
export const TARGET_POINTS = 500;

export type PointRole = "solver" | "reporter" | "reviewer" | "submission";

/** The idempotency key for a job-submission award (#617). */
export function jobSubmissionSourceKey(jobId: string, submissionId: string): string {
  return `job:${jobId}:submission:${submissionId}`;
}

export function solverPoints(severity: Severity): number {
  return SOLVER_POINTS[severity];
}

/**
 * The idempotency key for an award. `PointEntry.sourceKey` is unique, so a
 * second award with the same key adds nothing.
 */
export function pointSourceKey(role: PointRole, bugId: string, userId: string): string {
  return `${role}:${bugId}:${userId}`;
}

/** Idempotency key for paying a reviewer who confirmed the issue as real. */
export function confirmationReviewerSourceKey(bugId: string, userId: string): string {
  return `reviewer-confirm:${bugId}:${userId}`;
}

export type PointsProgress = {
  points: number;
  solvedTasks: number;
  /** 0–100, capped. */
  pointsPercent: number;
  /** True once the points goal is met. */
  targetMet: boolean;
};

function percent(value: number, target: number): number {
  return Math.min(100, Math.max(0, Math.floor((value / target) * 100)));
}

/** Progress toward 500 points. */
export function pointsProgress(points: number, solvedTasks: number): PointsProgress {
  return {
    points,
    solvedTasks,
    pointsPercent: percent(points, TARGET_POINTS),
    targetMet: points >= TARGET_POINTS,
  };
}
