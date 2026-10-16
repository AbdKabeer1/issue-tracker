import { describe, expect, it } from "vitest";
import { canAssignTicket } from "./ticket-assignment";

describe("canAssignTicket", () => {
  it("allows admins to assign to any user", () => {
    expect(
      canAssignTicket({
        actorId: "admin-1",
        actorRole: "admin",
        currentAssigneeId: null,
        targetAssigneeId: "user-2",
      }),
    ).toBe(true);
  });

  it("allows super admins to assign to any user", () => {
    expect(
      canAssignTicket({
        actorId: "super-1",
        actorRole: "super_admin",
        currentAssigneeId: "user-1",
        targetAssigneeId: "user-2",
      }),
    ).toBe(true);
  });

  it("allows admins to unassign tickets", () => {
    expect(
      canAssignTicket({
        actorId: "admin-1",
        actorRole: "admin",
        currentAssigneeId: "user-2",
        targetAssigneeId: null,
      }),
    ).toBe(true);
  });

  it("allows normal users to assign unassigned tickets to themselves", () => {
    expect(
      canAssignTicket({
        actorId: "user-1",
        actorRole: "user",
        currentAssigneeId: null,
        targetAssigneeId: "user-1",
      }),
    ).toBe(true);
  });

  it("allows normal users to claim tickets assigned to someone else", () => {
    expect(
      canAssignTicket({
        actorId: "user-1",
        actorRole: "user",
        currentAssigneeId: "user-2",
        targetAssigneeId: "user-1",
      }),
    ).toBe(true);
  });

  it("allows normal users to unassign tickets currently assigned to themselves", () => {
    expect(
      canAssignTicket({
        actorId: "user-1",
        actorRole: "user",
        currentAssigneeId: "user-1",
        targetAssigneeId: null,
      }),
    ).toBe(true);
  });

  it("prevents normal users from assigning tickets to other users", () => {
    expect(
      canAssignTicket({
        actorId: "user-1",
        actorRole: "user",
        currentAssigneeId: null,
        targetAssigneeId: "user-2",
      }),
    ).toBe(false);
  });

  it("prevents normal users from unassigning someone else's ticket", () => {
    expect(
      canAssignTicket({
        actorId: "user-1",
        actorRole: "user",
        currentAssigneeId: "user-2",
        targetAssigneeId: null,
      }),
    ).toBe(false);
  });
});
