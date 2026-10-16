import { describe, expect, it } from "vitest";
import { canDeleteTicket, TICKET_DELETION_ERRORS } from "./ticket-deletion";

describe("canDeleteTicket", () => {
  it("allows super admins to delete tickets", () => {
    expect(canDeleteTicket("super_admin")).toBe(true);
  });

  it("denies admins from deleting tickets", () => {
    expect(canDeleteTicket("admin")).toBe(false);
  });

  it("denies regular users from deleting tickets", () => {
    expect(canDeleteTicket("user")).toBe(false);
  });

  it("denies unauthenticated or invalid roles", () => {
    expect(canDeleteTicket(null)).toBe(false);
    expect(canDeleteTicket(undefined)).toBe(false);
  });
});

describe("TICKET_DELETION_ERRORS", () => {
  it("has clear and descriptive messages for all failure states", () => {
    expect(TICKET_DELETION_ERRORS.unauthorized).toBe(
      "Only super admins can delete tickets",
    );
    expect(TICKET_DELETION_ERRORS.invalidId).toBe("Invalid ticket ID");
    expect(TICKET_DELETION_ERRORS.notFound).toBe("Ticket not found");
    expect(TICKET_DELETION_ERRORS.failed).toBe(
      "Could not delete ticket. Please try again.",
    );
  });
});
