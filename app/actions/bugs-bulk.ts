"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  activityCreateData,
  assigneeChangedSummary,
  categoryChangedSummary,
  severityChangedSummary,
  statusChangedSummary,
  typeChangedSummary,
} from "@/lib/activity-log";
import { validateBulk } from "@/lib/bulk-actions";
import type { Severity, Status } from "@prisma/client";

export type BulkResult = {
  error?: string;
  ok?: boolean;
  /** How many issues were actually changed. */
  updated?: number;
  /** Ids that were asked for but not changed, with why. */
  skipped?: { id: string; reason: string }[];
};

/**
 * Apply one triage change to several issues at once.
 *
 * Everything happens in a single transaction: a bulk change that half
 * applied would leave a backlog in a state nobody asked for and no obvious
 * way back. Anything the caller may not touch is reported rather than
 * silently dropped.
 */
export async function bulkUpdateBugsAction(
  rawIds: unknown,
  rawChange: unknown,
): Promise<BulkResult> {
  const user = await requireAdmin();

  const parsed = validateBulk(rawIds, rawChange);
  if (!parsed.ok) return { error: parsed.error };
  const { ids, change } = parsed;

  // Referenced rows are checked once for the whole batch rather than once
  // per issue, and before the transaction opens.
  if (typeof change.typeId === "string") {
    const type = await prisma.issueType.findUnique({
      where: { id: change.typeId },
      select: { id: true },
    });
    if (!type) return { error: "Issue type not found" };
  }
  if (typeof change.categoryId === "string") {
    const category = await prisma.category.findUnique({
      where: { id: change.categoryId },
      select: { id: true },
    });
    if (!category) return { error: "Platform not found" };
  }
  if (typeof change.assigneeId === "string") {
    const assignee = await prisma.user.findUnique({
      where: { id: change.assigneeId },
      select: { id: true },
    });
    if (!assignee) return { error: "Assignee not found" };
  }

  // The current values come back too, so each issue's activity entry can say
  // what actually changed on it — the same entries a single edit produces,
  // rather than an opaque "bulk update" line nobody can read later.
  const found = await prisma.bug.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      isDeleted: true,
      status: true,
      severity: true,
      assigneeId: true,
      typeId: true,
      categoryId: true,
      type: { select: { name: true } },
      category: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  const byId = new Map(found.map((bug) => [bug.id, bug]));
  const skipped: { id: string; reason: string }[] = [];
  const target: string[] = [];
  type Found = (typeof found)[number];
  const changing: Found[] = [];

  for (const id of ids) {
    const bug = byId.get(id);
    if (!bug) {
      // Someone else deleted it, or the selection outlived the page.
      skipped.push({ id, reason: "No longer exists" });
    } else if (bug.isDeleted) {
      skipped.push({ id, reason: "Deleted — restore it first" });
    } else {
      target.push(id);
      changing.push(bug);
    }
  }

  if (target.length === 0) {
    return { error: "None of the selected issues can be changed.", skipped };
  }

  // Names for whatever the fields are being set to, looked up once.
  const toNames = await resolveNames(change);

  const entries = changing.flatMap((bug) => buildEntries(bug, change, toNames, user.id));

  if (entries.length === 0) {
    // Everything selected already had these values; saying so beats a
    // success message for a change that did nothing.
    return { ok: true, updated: 0, skipped };
  }

  // Only the issues that actually differ. Writing to the rest would bump
  // their updatedAt for no reason, which is visible: it reorders them under
  // the "Recently Updated" sort and overstates what the change did.
  const changedIds = [...new Set(entries.map((entry) => entry.bugId))];

  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.bug.updateMany({
        // isDeleted is re-checked here, not just in the read above: a
        // concurrent soft delete can commit in between, and filtering on id
        // alone would then edit a deleted issue and log activity for it.
        where: { id: { in: changedIds }, isDeleted: false },
        data: change,
      });
      if (result.count !== changedIds.length) {
        // Something moved underneath us. Throwing rolls the whole thing
        // back rather than logging activity for rows that were not updated.
        throw new BulkRaceError(result.count, changedIds.length);
      }
      await tx.bugActivity.createMany({ data: activityCreateData(entries) });
    });
  } catch (error) {
    if (error instanceof BulkRaceError) {
      return {
        error:
          "Some of those issues changed while you were selecting them. Nothing was modified — refresh and try again.",
        skipped,
      };
    }
    console.error("[bulk] update failed", error);
    // The transaction rolled back, so nothing changed — say so plainly
    // rather than leaving the caller to guess what landed.
    return { error: "Could not apply the change. Nothing was modified." };
  }

  revalidatePath("/bugs");
  for (const id of changedIds) revalidatePath(`/bugs/${id}`);

  return { ok: true, updated: changedIds.length, skipped };
}

/** Raised inside the transaction when a row moved between read and write. */
class BulkRaceError extends Error {
  constructor(updated: number, expected: number) {
    super(`bulk update touched ${updated} of ${expected} rows`);
    this.name = "BulkRaceError";
  }
}

type ToNames = { typeId?: string | null; categoryId?: string | null; assigneeId?: string | null };

/** Display names for the ids being assigned, so summaries read properly. */
async function resolveNames(change: Record<string, string | null>): Promise<ToNames> {
  const [type, category, assignee] = await Promise.all([
    typeof change.typeId === "string"
      ? prisma.issueType.findUnique({ where: { id: change.typeId }, select: { name: true } })
      : null,
    typeof change.categoryId === "string"
      ? prisma.category.findUnique({ where: { id: change.categoryId }, select: { name: true } })
      : null,
    typeof change.assigneeId === "string"
      ? prisma.user.findUnique({ where: { id: change.assigneeId }, select: { name: true } })
      : null,
  ]);
  return {
    typeId: type?.name ?? null,
    categoryId: category?.name ?? null,
    assigneeId: assignee?.name ?? null,
  };
}

type BugRow = {
  id: string;
  status: Status;
  severity: Severity;
  typeId: string | null;
  categoryId: string | null;
  assigneeId: string | null;
  type: { name: string } | null;
  category: { name: string } | null;
  assignee: { name: string } | null;
};

/**
 * One activity entry per field that actually differs on this issue. A field
 * already holding the requested value produces nothing, so the log does not
 * fill with "changed status from Open to Open".
 */
function buildEntries(
  bug: BugRow,
  change: Record<string, string | null>,
  toNames: ToNames,
  actorId: string,
): Parameters<typeof activityCreateData>[0] {
  const entries: Parameters<typeof activityCreateData>[0] = [];
  const base = { bugId: bug.id, actorId };

  if (typeof change.status === "string" && change.status !== bug.status) {
    const to = change.status as Status;
    entries.push({
      ...base,
      type: "status_changed",
      summary: statusChangedSummary(bug.status, to),
      metadata: { field: "status", from: bug.status, to },
    });
  }
  if (typeof change.severity === "string" && change.severity !== bug.severity) {
    const to = change.severity as Severity;
    entries.push({
      ...base,
      type: "severity_changed",
      summary: severityChangedSummary(bug.severity, to),
      metadata: { field: "severity", from: bug.severity, to },
    });
  }
  if (change.typeId !== undefined && change.typeId !== bug.typeId) {
    entries.push({
      ...base,
      type: "type_changed",
      summary: typeChangedSummary(bug.type?.name ?? null, toNames.typeId ?? null),
      metadata: { field: "type", from: bug.type?.name ?? null, to: toNames.typeId ?? null },
    });
  }
  if (change.categoryId !== undefined && change.categoryId !== bug.categoryId) {
    entries.push({
      ...base,
      type: "category_changed",
      summary: categoryChangedSummary(bug.category?.name ?? null, toNames.categoryId ?? null),
      metadata: { field: "category", from: bug.category?.name ?? null, to: toNames.categoryId ?? null },
    });
  }
  if (change.assigneeId !== undefined && change.assigneeId !== bug.assigneeId) {
    entries.push({
      ...base,
      type: "assignee_changed",
      summary: assigneeChangedSummary(bug.assignee?.name ?? null, toNames.assigneeId ?? null),
      metadata: { field: "assignee", from: bug.assignee?.name ?? null, to: toNames.assigneeId ?? null },
    });
  }
  return entries;
}
