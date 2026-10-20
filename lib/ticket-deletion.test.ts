import { describe, expect, it } from "vitest";
import {
  canDeleteTicket,
  canRestoreTicket,
  TICKET_DELETION_ERRORS,
} from "./ticket-deletion";

describe("canDeleteTicket", () => {
  it("allows the site super admin and an owner or admin of the organization", () => {
    expect(canDeleteTicket("super_admin")).toBe(true);
    expect(canDeleteTicket("user", "owner")).toBe(true);
    expect(canDeleteTicket("user", "admin")).toBe(true);
  });

  it("denies a site-wide admin who is only a member", () => {
    expect(canDeleteTicket("admin")).toBe(false);
    expect(canDeleteTicket("admin", "member")).toBe(false);
  });

  it("denies regular users from deleting tickets", () => {
    expect(canDeleteTicket("user")).toBe(false);
    expect(canDeleteTicket("user", "member")).toBe(false);
  });

  it("denies unauthenticated or invalid roles", () => {
    expect(canDeleteTicket(null)).toBe(false);
    expect(canDeleteTicket(undefined)).toBe(false);
  });
});

describe("canRestoreTicket", () => {
  it("allows the site super admin and an owner or admin of the organization", () => {
    expect(canRestoreTicket("super_admin")).toBe(true);
    expect(canRestoreTicket("user", "admin")).toBe(true);
  });

  it("denies a site-wide admin who is only a member", () => {
    expect(canRestoreTicket("admin", "member")).toBe(false);
  });

  it("denies regular users from restoring deleted tickets", () => {
    expect(canRestoreTicket("user")).toBe(false);
  });

  it("denies unauthenticated or invalid roles", () => {
    expect(canRestoreTicket(null)).toBe(false);
    expect(canRestoreTicket(undefined)).toBe(false);
  });
});

describe("TICKET_DELETION_ERRORS", () => {
  it("has clear and descriptive messages for all failure states", () => {
    expect(TICKET_DELETION_ERRORS.unauthorized).toBe(
      "Only an owner or admin of this organization can delete issues",
    );
    expect(TICKET_DELETION_ERRORS.unauthorizedRestore).toBe(
      "Only an owner or admin of this organization can restore issues",
    );
    expect(TICKET_DELETION_ERRORS.invalidId).toBe("Invalid issue ID");
    expect(TICKET_DELETION_ERRORS.notFound).toBe("Issue not found");
    expect(TICKET_DELETION_ERRORS.alreadyDeleted).toBe("Issue is already deleted");
    expect(TICKET_DELETION_ERRORS.notDeleted).toBe("Issue is not deleted");
    expect(TICKET_DELETION_ERRORS.failed).toBe(
      "Could not delete issue. Please try again.",
    );
    expect(TICKET_DELETION_ERRORS.failedRestore).toBe(
      "Could not restore issue. Please try again.",
    );
  });
});
