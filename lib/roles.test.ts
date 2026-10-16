import { describe, expect, it } from "vitest";
import {
  isAdmin,
  isSuperAdmin,
  roleLabels,
  resolveEffectiveRole,
  ACTIVE_ROLE_COOKIE_NAME,
} from "./roles";

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

describe("resolveEffectiveRole", () => {
  it("has the expected cookie name constant", () => {
    expect(ACTIVE_ROLE_COOKIE_NAME).toBe("zedu_active_role");
  });

  it("allows real super admin to switch to user", () => {
    const role = resolveEffectiveRole({
      isRealSuperAdmin: true,
      baseRole: "super_admin",
      activeRoleOverride: "user",
    });
    expect(role).toBe("user");
  });

  it("allows real super admin to switch to admin", () => {
    const role = resolveEffectiveRole({
      isRealSuperAdmin: true,
      baseRole: "super_admin",
      activeRoleOverride: "admin",
    });
    expect(role).toBe("admin");
  });

  it("returns baseRole if override is super_admin", () => {
    const role = resolveEffectiveRole({
      isRealSuperAdmin: true,
      baseRole: "super_admin",
      activeRoleOverride: "super_admin",
    });
    expect(role).toBe("super_admin");
  });

  it("ignores cookie override if user is not a real super admin", () => {
    const role = resolveEffectiveRole({
      isRealSuperAdmin: false,
      baseRole: "user",
      activeRoleOverride: "super_admin",
    });
    expect(role).toBe("user");
  });

  it("ignores invalid cookie override values", () => {
    const role = resolveEffectiveRole({
      isRealSuperAdmin: true,
      baseRole: "super_admin",
      activeRoleOverride: "hacker_role",
    });
    expect(role).toBe("super_admin");
  });

  it("defaults to baseRole when no override is set", () => {
    const role = resolveEffectiveRole({
      isRealSuperAdmin: true,
      baseRole: "super_admin",
      activeRoleOverride: undefined,
    });
    expect(role).toBe("super_admin");
  });
});

