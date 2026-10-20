import type { Prisma, PrismaClient, Severity, Status } from "@prisma/client";
import { award, type PointAward } from "./award";
import { pointSourceKey, REPORTER_POINTS, solverPoints } from "./rules";
import { isConfirmed } from "@/lib/agent-api/validation";

/**
 * Points for tickets that existed before the ledger (#435), by the same
 * rules as new work (#428). Operator-run through `scripts/backfill-points.ts`.
 *
 * Every entry uses the key `award()` uses, so running this twice, or after a
 * real award for the same ticket, pays once. There were no test verdicts
 * before the platform, so no reviewer points are invented.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Date the agent platform and contributor ledger were introduced. */
export const PLATFORM_CUTOFF_DATE = new Date("2026-10-21T00:00:00.000Z");

export type HistoricalBug = {
  id: string;
  tenantId: string;
  status: Status;
  severity: Severity;
  assigneeId: string | null;
  reporterId: string;
  beneficiaryUserId?: string | null;
  duplicateOfId: string | null;
  isDeleted: boolean;
  createdByAgentId?: string | null;
  createdAt?: Date;
  isConfirmed?: boolean;
};

const FINISHED: ReadonlySet<Status> = new Set<Status>(["resolved", "closed"]);

export function isModernBug(bug: HistoricalBug, cutoffDate?: Date): boolean {
  if (bug.createdByAgentId) return true;
  if (cutoffDate && bug.createdAt && bug.createdAt >= cutoffDate) return true;
  return false;
}

/** The awards a ticket earns: solver for its assignee once finished, reporter unless it's a duplicate.
 * For modern/agent-platform issues (#715), reporter points require independent confirmation.
 */
export function backfillEntries(
  bug: HistoricalBug,
  options?: { cutoffDate?: Date },
): PointAward[] {
  // A deleted ticket was taken back; it earns nothing.
  if (bug.isDeleted) return [];
  const entries: PointAward[] = [];
  if (FINISHED.has(bug.status) && bug.assigneeId) {
    entries.push({
      tenantId: bug.tenantId,
      userId: bug.assigneeId,
      bugId: bug.id,
      role: "solver",
      points: solverPoints(bug.severity),
      sourceKey: pointSourceKey("solver", bug.id, bug.assigneeId),
    });
  }
  if (!bug.duplicateOfId) {
    const modern = isModernBug(bug, options?.cutoffDate);
    // Modern agent-platform issues require confirmation (#715)
    if (!modern || bug.isConfirmed) {
      const recipientId = (modern ? bug.beneficiaryUserId : null) ?? bug.reporterId;
      entries.push({
        tenantId: bug.tenantId,
        userId: recipientId,
        bugId: bug.id,
        role: "reporter",
        points: REPORTER_POINTS,
        sourceKey: pointSourceKey("reporter", bug.id, recipientId),
      });
    }
  }
  return entries;
}

export type BackfillLine = PointAward & { alreadyAwarded: boolean };

export type BackfillResult = {
  bugs: number;
  /** Entries the rules give, including ones already in the ledger. */
  planned: number;
  /** Rows actually inserted (always 0 for a dry run). */
  written: number;
  /** Planned entries already in the ledger, skipped. */
  existing: number;
};

export type BackfillOptions = {
  /** Print what would be awarded and write nothing. */
  dryRun?: boolean;
  /** Called once per planned entry, e.g. to print it. */
  onLine?: (line: BackfillLine) => void;
  batchSize?: number;
  /** Issues created at or after this date use modern confirmation rules (#715). */
  cutoffDate?: Date;
};

async function checkConfirmed(db: Db, bug: HistoricalBug): Promise<boolean> {
  if (bug.isConfirmed !== undefined) return bug.isConfirmed;
  const anyDb = db as unknown as { issueValidation?: unknown; bug?: { findUnique?: unknown } };
  if (!anyDb.issueValidation || !anyDb.bug?.findUnique) return false;
  return isConfirmed(bug.id, db);
}

/** Walks every ticket in id order and awards what it earns. */
export async function backfillPoints(db: Db, options: BackfillOptions = {}): Promise<BackfillResult> {
  const { dryRun = false, onLine, batchSize = 500, cutoffDate = PLATFORM_CUTOFF_DATE } = options;
  const result: BackfillResult = { bugs: 0, planned: 0, written: 0, existing: 0 };
  let cursor: string | undefined;

  for (;;) {
    const bugs: HistoricalBug[] = await db.bug.findMany({
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        tenantId: true,
        status: true,
        severity: true,
        assigneeId: true,
        reporterId: true,
        beneficiaryUserId: true,
        duplicateOfId: true,
        isDeleted: true,
        createdByAgentId: true,
        createdAt: true,
      },
    });
    if (bugs.length === 0) break;
    result.bugs += bugs.length;
    cursor = bugs[bugs.length - 1].id;

    for (const b of bugs) {
      if (isModernBug(b, cutoffDate) && b.isConfirmed === undefined) {
        b.isConfirmed = await checkConfirmed(db, b);
      }
    }

    const entries = bugs.flatMap((b) => backfillEntries(b, { cutoffDate }));
    if (entries.length > 0) {
      const present = await db.pointEntry.findMany({
        where: { sourceKey: { in: entries.map((e) => e.sourceKey) } },
        select: { sourceKey: true },
      });
      const already = new Set(present.map((p) => p.sourceKey));

      for (const entry of entries) {
        const alreadyAwarded = already.has(entry.sourceKey);
        result.planned++;
        if (alreadyAwarded) result.existing++;
        onLine?.({ ...entry, alreadyAwarded });
        // award() skips an existing key too, so a run racing a real award is still safe.
        if (!dryRun && !alreadyAwarded && (await award(db, entry))) result.written++;
      }
    }
    if (bugs.length < batchSize) break;
  }
  return result;
}
