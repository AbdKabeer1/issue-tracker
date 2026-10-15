import { describe, expect, it } from "vitest";
import { isAdmin, isSuperAdmin, roleLabels } from "./roles";

describe("isAdmin", () => {
  it("returns true for admin and super_admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("super_admin")).toBe(true);
  });

  it("returns false for user and missing roles", () => {
    expect(isAdmin("user")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("isSuperAdmin", () => {
  it("returns true only for super_admin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
    expect(isSuperAdmin("user")).toBe(false);
  });
});

describe("roleLabels", () => {
  it("labels every role", () => {
    expect(roleLabels.user).toBe("User");
    expect(roleLabels.admin).toBe("Admin");
    expect(roleLabels.super_admin).toBe("Super admin");
  });
});
