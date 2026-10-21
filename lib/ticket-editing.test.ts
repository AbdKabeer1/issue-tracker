import { describe, expect, it } from "vitest";
import {
  canEditTicket,
  formatEditSummary,
  formatProofLinkSummary,
  getChangedEditFields,
  getProofLinkChanges,
  TICKET_EDIT_ERRORS,
} from "./ticket-editing";

describe("canEditTicket", () => {
  it("allows the issue reporter to edit their own issue", () => {
    expect(
      canEditTicket({
        actorId: "user_123",
        actorRole: "user",
        reporterId: "user_123",
      }),
    ).toBe(true);
  });

  it("allows an owner or admin of the organization to edit any issue", () => {
    expect(
      canEditTicket({
        actorId: "admin_456",
        actorRole: "user",
        membershipRole: "owner",
        reporterId: "user_123",
      }),
    ).toBe(true);
  });

  it("denies a site-wide admin who is only a member and not the reporter", () => {
    expect(
      canEditTicket({
        actorId: "admin_456",
        actorRole: "admin",
        membershipRole: "member",
        reporterId: "user_123",
      }),
    ).toBe(false);
  });

  it("allows super admins to edit any issue", () => {
    expect(
      canEditTicket({
        actorId: "super_admin_789",
        actorRole: "super_admin",
        reporterId: "user_123",
      }),
    ).toBe(true);
  });

  it("denies other users who are neither the reporter nor an admin", () => {
    expect(
      canEditTicket({
        actorId: "user_other",
        actorRole: "user",
        reporterId: "user_123",
      }),
    ).toBe(false);
  });

  it("denies unauthenticated users (null or undefined actorId)", () => {
    expect(
      canEditTicket({
        actorId: null,
        actorRole: null,
        reporterId: "user_123",
      }),
    ).toBe(false);

    expect(
      canEditTicket({
        actorId: undefined,
        actorRole: undefined,
        reporterId: "user_123",
      }),
    ).toBe(false);
  });
});

describe("getChangedEditFields", () => {
  it("detects when both title and description changed", () => {
    const existing = { title: "Old title", description: "Old description text" };
    const updated = { title: "New title", description: "New description text" };
    expect(getChangedEditFields(existing, updated)).toEqual([
      "title",
      "description",
    ]);
  });

  it("detects when only title changed", () => {
    const existing = { title: "Old title", description: "Same description" };
    const updated = { title: "New title", description: "Same description" };
    expect(getChangedEditFields(existing, updated)).toEqual(["title"]);
  });

  it("detects when only description changed", () => {
    const existing = { title: "Same title", description: "Old description" };
    const updated = { title: "Same title", description: "New description" };
    expect(getChangedEditFields(existing, updated)).toEqual(["description"]);
  });

  it("returns empty array when neither changed", () => {
    const existing = { title: "Same title", description: "Same description" };
    const updated = { title: "Same title ", description: " Same description" };
    expect(getChangedEditFields(existing, updated)).toEqual([]);
  });
});

describe("formatEditSummary", () => {
  it("formats summary when both title and description changed", () => {
    expect(formatEditSummary(["title", "description"])).toBe(
      "edited the title and description",
    );
  });

  it("formats summary when only title changed", () => {
    expect(formatEditSummary(["title"])).toBe("edited the title");
  });

  it("formats summary when only description changed", () => {
    expect(formatEditSummary(["description"])).toBe("edited the description");
  });

  it("formats fallback when no fields specified", () => {
    expect(formatEditSummary([])).toBe("edited this ticket");
  });
});

describe("TICKET_EDIT_ERRORS", () => {
  it("contains clear error messages", () => {
    expect(TICKET_EDIT_ERRORS.unauthorized).toBe(
      "Only the reporter, or an owner or admin of this organization, can edit this issue",
    );
  });
});

describe("getProofLinkChanges (#737)", () => {
  it("lists links added and removed, ignoring order", () => {
    expect(getProofLinkChanges(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
    expect(getProofLinkChanges(["a", "b"], ["b", "a"])).toEqual({ added: [], removed: [] });
  });
});

describe("formatProofLinkSummary (#737)", () => {
  it("describes what changed", () => {
    expect(formatProofLinkSummary({ added: ["a"], removed: [] })).toBe("added a proof link");
    expect(formatProofLinkSummary({ added: [], removed: ["a", "b"] })).toBe("removed 2 proof links");
    expect(formatProofLinkSummary({ added: ["a"], removed: ["b"] })).toBe(
      "added a proof link and removed a proof link",
    );
  });
});
