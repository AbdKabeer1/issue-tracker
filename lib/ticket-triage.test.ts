import { describe, expect, it } from "vitest";
import { canChangeTicketStatus } from "@/lib/ticket-triage";

describe("canChangeTicketStatus", () => {
  it("allows an organization admin regardless of assignment", () => {
    expect(
      canChangeTicketStatus({
        actorId: "admin-1",
        actorRole: "user",
        membershipRole: "admin",
        currentAssigneeId: null,
      }),
    ).toBe(true);
    expect(
      canChangeTicketStatus({
        actorId: "admin-1",
        actorRole: "super_admin",
        membershipRole: "member",
        currentAssigneeId: "someone-else",
      }),
    ).toBe(true);
  });

  it("denies a site-wide admin who is only a member of this organization", () => {
    expect(
      canChangeTicketStatus({
        actorId: "admin-1",
        actorRole: "admin",
        membershipRole: "member",
        currentAssigneeId: null,
      }),
    ).toBe(false);
  });

  it("allows the current assignee", () => {
    expect(
      canChangeTicketStatus({
        actorId: "assignee-1",
        actorRole: "user",
        currentAssigneeId: "assignee-1",
      }),
    ).toBe(true);
  });

  // Regression test for #202.
  it("denies a non-assignee on an unassigned issue", () => {
    expect(
      canChangeTicketStatus({
        actorId: "random-user",
        actorRole: "user",
        currentAssigneeId: null,
      }),
    ).toBe(false);
  });

  it("denies a non-assignee on someone else's issue", () => {
    expect(
      canChangeTicketStatus({
        actorId: "random-user",
        actorRole: "user",
        currentAssigneeId: "assignee-1",
      }),
    ).toBe(false);
  });

  it("denies an anonymous actor", () => {
    expect(
      canChangeTicketStatus({
        actorId: null,
        actorRole: "user",
        currentAssigneeId: null,
      }),
    ).toBe(false);
  });
});