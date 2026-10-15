import type { ActivityType, Prisma, Severity, Status } from "@prisma/client";
import { severityLabel, statusLabel } from "@/lib/labels";

export type ActivityMetadata = {
  field?: string;
  from?: string | null;
  to?: string | null;
  commentPreview?: string;
};

type ActivityInput = {
  bugId: string;
  actorId: string;
  type: ActivityType;
  summary: string;
  metadata?: ActivityMetadata;
};

/** Build Prisma create payloads for one or more activity rows. */
export function activityCreateData(
  entries: ActivityInput[],
): Prisma.BugActivityCreateManyInput[] {
  return entries.map((entry) => ({
    bugId: entry.bugId,
    actorId: entry.actorId,
    type: entry.type,
    summary: entry.summary,
    metadata:
      entry.metadata === undefined
        ? undefined
        : (entry.metadata as Prisma.InputJsonValue),
  }));
}

export function createdSummary(title: string): string {
  return `created this ticket (“${truncate(title, 80)}”)`;
}

export function statusChangedSummary(from: Status, to: Status): string {
  return `changed status from ${statusLabel[from]} to ${statusLabel[to]}`;
}

export function severityChangedSummary(from: Severity, to: Severity): string {
  return `changed severity from ${severityLabel[from]} to ${severityLabel[to]}`;
}

export function assigneeChangedSummary(
  fromName: string | null,
  toName: string | null,
): string {
  const from = fromName ?? "Unassigned";
  const to = toName ?? "Unassigned";
  return `changed assignee from ${from} to ${to}`;
}

export function commentedSummary(body: string): string {
  return `added a comment: “${truncate(body, 120)}”`;
}

export function editedSummary(fields: string[]): string {
  if (fields.length === 0) return "edited this ticket";
  if (fields.length === 1) return `edited ${fields[0]}`;
  if (fields.length === 2) return `edited ${fields[0]} and ${fields[1]}`;
  return `edited ${fields.slice(0, -1).join(", ")}, and ${fields.at(-1)}`;
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}
