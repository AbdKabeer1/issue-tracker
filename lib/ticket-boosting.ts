import { isAdmin, type AppRole } from "@/lib/roles";

export const TICKET_BOOST_ERRORS = {
  unauthorized: "Only admins can boost issues",
  invalidId: "Invalid issue ID",
  notFound: "Issue not found",
  failed: "Could not update issue boost status. Please try again.",
} as const;

export type TicketBoostError = keyof typeof TICKET_BOOST_ERRORS;

/**
 * Checks whether a user with the given role has permission to boost or unboost tickets.
 * Admins and super admins are permitted.
 */
export function canBoostTicket(role?: AppRole | null): boolean {
  return isAdmin(role);
}
