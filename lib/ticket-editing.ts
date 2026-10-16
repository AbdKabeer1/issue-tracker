import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_EDIT_ERRORS = {
  unauthorized: "Only the reporter or an admin can edit this issue",
  notFound: "Issue not found",
  invalidTitle: "Title must be between 3 and 200 characters",
  invalidDescription: "Description must be between 10 and 5000 characters",
  failed: "Could not update issue. Please try again.",
} as const;

export type CanEditTicketParams = {
  actorId?: string | null;
  actorRole?: AppRole | null;
  reporterId?: string | null;
};

/**
 * Checks whether a user can edit an issue's title and description.
 * Allowed: The reporter of the issue or an admin / super_admin.
 */
export function canEditTicket({
  actorId,
  actorRole,
  reporterId,
}: CanEditTicketParams): boolean {
  if (!actorId) return false;
  if (isAdmin(actorRole)) return true;
  return Boolean(reporterId && actorId === reporterId);
}

/**
 * Calculates which content fields changed between the existing ticket and the submitted edits.
 */
export function getChangedEditFields(
  existing: { title: string; description: string },
  updated: { title: string; description: string },
): ("title" | "description")[] {
  const fields: ("title" | "description")[] = [];
  if (existing.title.trim() !== updated.title.trim()) {
    fields.push("title");
  }
  if (existing.description.trim() !== updated.description.trim()) {
    fields.push("description");
  }
  return fields;
}

/**
 * Returns formatted human-readable summary for activity log.
 * e.g. "edited the title and description", "edited the title", "edited the description"
 */
export function formatEditSummary(fields: ("title" | "description")[]): string {
  if (fields.length === 0) return "edited this ticket";
  if (fields.includes("title") && fields.includes("description")) {
    return "edited the title and description";
  }
  if (fields.includes("title")) {
    return "edited the title";
  }
  return "edited the description";
}
