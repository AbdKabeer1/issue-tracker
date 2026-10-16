import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SUPER_ADMIN_EMAILS,
  getSuperAdminEmails,
  isSuperAdminEmail,
} from "./super-admin";

describe("super-admin helper", () => {
  const originalSuperAdmin = process.env.SUPER_ADMIN_EMAIL;
  const originalSuperAdmins = process.env.SUPER_ADMIN_EMAILS;

  beforeEach(() => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  afterEach(() => {
    if (originalSuperAdmin !== undefined) {
      process.env.SUPER_ADMIN_EMAIL = originalSuperAdmin;
    } else {
      delete process.env.SUPER_ADMIN_EMAIL;
    }
    if (originalSuperAdmins !== undefined) {
      process.env.SUPER_ADMIN_EMAILS = originalSuperAdmins;
    } else {
      delete process.env.SUPER_ADMIN_EMAILS;
    }
  });

  it("recognizes default super admin amicablembakara50@gmail.com", () => {
    expect(DEFAULT_SUPER_ADMIN_EMAILS).toContain("amicablembakara50@gmail.com");
    expect(getSuperAdminEmails().has("amicablembakara50@gmail.com")).toBe(true);
    expect(isSuperAdminEmail("amicablembakara50@gmail.com")).toBe(true);
    expect(isSuperAdminEmail("AmicableMbakara50@gmail.com")).toBe(true);
    expect(isSuperAdminEmail(" AMICABLEMBAKARA50@GMAIL.COM ")).toBe(true);
  });

  it("rejects non-admin emails", () => {
    expect(isSuperAdminEmail("random@example.com")).toBe(false);
    expect(isSuperAdminEmail("")).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });

  it("merges additional super admin emails from env", () => {
    process.env.SUPER_ADMIN_EMAIL = "custom@zedu.chat";
    expect(isSuperAdminEmail("custom@zedu.chat")).toBe(true);
    expect(isSuperAdminEmail("amicablembakara50@gmail.com")).toBe(true);
  });

  it("handles comma-separated SUPER_ADMIN_EMAILS", () => {
    process.env.SUPER_ADMIN_EMAILS = "admin1@test.com, admin2@test.com";
    expect(isSuperAdminEmail("admin1@test.com")).toBe(true);
    expect(isSuperAdminEmail("admin2@test.com")).toBe(true);
    expect(isSuperAdminEmail("amicablembakara50@gmail.com")).toBe(true);
  });
});
