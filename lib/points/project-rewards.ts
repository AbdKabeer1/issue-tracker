import { z } from "zod";
import type { Severity } from "@prisma/client";
import {
  SOLVER_POINTS,
  REPORTER_POINTS,
  REVIEWER_POINTS,
} from "./rules";

export const projectRewardConfigSchema = z
  .object({
    solver: z
      .object({
        low: z.coerce.number().int().min(0).max(10000).default(SOLVER_POINTS.low),
        medium: z.coerce.number().int().min(0).max(10000).default(SOLVER_POINTS.medium),
        high: z.coerce.number().int().min(0).max(10000).default(SOLVER_POINTS.high),
        critical: z.coerce.number().int().min(0).max(10000).default(SOLVER_POINTS.critical),
      })
      .default({
        low: SOLVER_POINTS.low,
        medium: SOLVER_POINTS.medium,
        high: SOLVER_POINTS.high,
        critical: SOLVER_POINTS.critical,
      }),
    reporter: z.coerce.number().int().min(0).max(10000).default(REPORTER_POINTS),
    reviewer: z.coerce.number().int().min(0).max(10000).default(REVIEWER_POINTS),
    guidelines: z.string().trim().max(2000).optional().nullable().default(null),
  })
  .default({
    solver: {
      low: SOLVER_POINTS.low,
      medium: SOLVER_POINTS.medium,
      high: SOLVER_POINTS.high,
      critical: SOLVER_POINTS.critical,
    },
    reporter: REPORTER_POINTS,
    reviewer: REVIEWER_POINTS,
    guidelines: null,
  });

export type ProjectRewardConfig = z.infer<typeof projectRewardConfigSchema>;

/** Parse a project override. Pass `base` so missing fields inherit platform defaults. */
export function parseProjectRewardConfig(
  raw: unknown,
  base?: ProjectRewardConfig | null,
): ProjectRewardConfig {
  const fallback = base ?? projectRewardConfigSchema.parse({});
  if (!raw || typeof raw !== "object") return fallback;
  const result = projectRewardConfigSchema.safeParse({
    ...fallback,
    ...(raw as object),
    solver: {
      ...fallback.solver,
      ...((raw as { solver?: object }).solver ?? {}),
    },
  });
  return result.success ? result.data : fallback;
}

export function calculateSolverPoints(
  severity: Severity,
  config?: ProjectRewardConfig | null,
): number {
  if (!config) return SOLVER_POINTS[severity];
  return config.solver[severity] ?? SOLVER_POINTS[severity];
}

export function calculateReporterPoints(config?: ProjectRewardConfig | null): number {
  if (!config) return REPORTER_POINTS;
  return config.reporter ?? REPORTER_POINTS;
}

export function calculateReviewerPoints(config?: ProjectRewardConfig | null): number {
  if (!config) return REVIEWER_POINTS;
  return config.reviewer ?? REVIEWER_POINTS;
}
