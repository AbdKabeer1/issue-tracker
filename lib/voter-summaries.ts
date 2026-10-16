import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  type BugVoterSummary,
  type RawVoterRow,
  buildVoterSummaries,
  createEmptyVoterSummary,
} from "@/lib/voters";

/**
 * Fetches voter summaries (counts and up to 3 voters for likes and dislikes)
 * for a list of bug IDs using a single SQL query with ROW_NUMBER() and windowed COUNT.
 */
export async function fetchVoterSummaries(
  bugIds: string[],
): Promise<Map<string, BugVoterSummary>> {
  const uniqueIds = Array.from(new Set(bugIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.$queryRaw<RawVoterRow[]>`
    WITH ranked_voters AS (
      SELECT
        v."bugId",
        v."value",
        v."userId",
        u."name",
        u."image",
        v."createdAt",
        ROW_NUMBER() OVER (
          PARTITION BY v."bugId", v."value"
          ORDER BY v."createdAt" ASC
        ) AS rn,
        COUNT(*) OVER (
          PARTITION BY v."bugId", v."value"
        ) AS total_count
      FROM "Vote" v
      JOIN "User" u ON u."id" = v."userId"
      WHERE v."bugId" IN (${Prisma.join(uniqueIds)})
        AND v."value" IN (1, -1)
    )
    SELECT
      "bugId",
      "value",
      "userId",
      "name",
      "image",
      total_count,
      rn
    FROM ranked_voters
    WHERE rn <= 3
    ORDER BY "bugId", "value", rn ASC
  `;

  return buildVoterSummaries(rows, uniqueIds);
}

/**
 * Convenience helper to fetch the voter summary for a single bug.
 */
export async function fetchVoterSummary(
  bugId: string,
): Promise<BugVoterSummary> {
  const map = await fetchVoterSummaries([bugId]);
  return map.get(bugId) ?? createEmptyVoterSummary();
}
