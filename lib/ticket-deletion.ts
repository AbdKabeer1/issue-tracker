import { isSuperAdmin, type AppRole } from "@/lib/roles";

export const TICKET_DELETION_ERRORS = {
  unauthorized: "Only super admins can delete tickets",
  invalidId: "Invalid ticket ID",
  notFound: "Ticket not found",
  failed: "Could not delete ticket. Please try again.",
} as const;

export type TicketDeletionError = keyof typeof TICKET_DELETION_ERRORS;

/**
 * Checks whether a user with the given role has permission to delete tickets.
 * Only super admins are permitted.
 */
export function canDeleteTicket(role?: AppRole | null): boolean {
  return isSuperAdmin(role);
}
