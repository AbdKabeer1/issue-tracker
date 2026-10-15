import { describe, expect, it } from "vitest";
import { refuseRoleChange, ROLE_CHANGE_ERRORS } from "./role-changes";

const admin = { id: "admin-1", role: "admin" as const };
const plain = { id: "user-1", role: "user" as const };
const root = { id: "root-1", role: "super_admin" as const };

describe("refuseRoleChange", () => {
  it("allows promoting a plain user to admin", () => {
    expect(refuseRoleChange("root-1", plain, "admin")).toBeNull();
  });

  it("allows demoting an admin back to user", () => {
    expect(refuseRoleChange("root-1", admin, "user")).toBeNull();
  });

  it("refuses to change the caller's own role", () => {
    expect(refuseRoleChange("admin-1", admin, "user")).toBe("self");
    expect(refuseRoleChange("root-1", root, "admin")).toBe("self");
  });

  it("refuses to change another super admin's role", () => {
    expect(refuseRoleChange("root-1", { id: "root-2", role: "super_admin" }, "user")).toBe(
      "super-admin",
    );
  });

  it("refuses a no-op promote", () => {
    expect(refuseRoleChange("root-1", admin, "admin")).toBe("already-admin");
  });

  it("refuses a no-op demote", () => {
    expect(refuseRoleChange("root-1", plain, "user")).toBe("already-user");
  });

  it("reports a missing target", () => {
    expect(refuseRoleChange("root-1", null, "admin")).toBe("not-found");
  });
});

describe("ROLE_CHANGE_ERRORS", () => {
  it("has a message for every refusal reason", () => {
    for (const reason of Object.keys(ROLE_CHANGE_ERRORS)) {
      expect(ROLE_CHANGE_ERRORS[reason as keyof typeof ROLE_CHANGE_ERRORS]).toBeTruthy();
    }
  });
});