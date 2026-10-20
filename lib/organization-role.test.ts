import { describe, expect, it } from "vitest";
import { isOrganizationAdmin } from "./organization-role";

describe("isOrganizationAdmin", () => {
  it("treats owners and admins of the organization as admins", () => {
    expect(isOrganizationAdmin("owner", "user")).toBe(true);
    expect(isOrganizationAdmin("admin", "user")).toBe(true);
  });

  it("does not treat a site-wide admin as an admin of an organization they only belong to", () => {
    expect(isOrganizationAdmin("member", "admin")).toBe(false);
    expect(isOrganizationAdmin(null, "admin")).toBe(false);
  });

  it("lets the site super admin administer every organization", () => {
    expect(isOrganizationAdmin("member", "super_admin")).toBe(true);
    expect(isOrganizationAdmin(null, "super_admin")).toBe(true);
  });

  it("denies a plain member", () => {
    expect(isOrganizationAdmin("member", "user")).toBe(false);
    expect(isOrganizationAdmin(null, "user")).toBe(false);
    expect(isOrganizationAdmin(undefined, null)).toBe(false);
  });
});
