import { describe, expect, it } from "vitest";
import { getSuperAdminEmails, isSuperAdminEmail } from "./super-admin";

describe("super-admin helper", () => {
  it("has no super admins when nothing is configured", () => {
    expect(getSuperAdminEmails({}).size).toBe(0);
    expect(isSuperAdminEmail("anyone@example.com", {})).toBe(false);
  });

  it("does not grant super admin to any built-in address", () => {
    // Regression for #111: no address may be hard-coded into the set.
    const env = { SUPER_ADMIN_EMAIL: "owner@zedu.chat" };
    expect([...getSuperAdminEmails(env)]).toEqual(["owner@zedu.chat"]);
  });

  it("matches the configured address case- and whitespace-insensitively", () => {
    const env = { SUPER_ADMIN_EMAIL: '"Owner@Zedu.chat"' };
    expect(isSuperAdminEmail("owner@zedu.chat", env)).toBe(true);
    expect(isSuperAdminEmail(" OWNER@ZEDU.CHAT ", env)).toBe(true);
  });

  it("rejects non-admin and empty emails", () => {
    const env = { SUPER_ADMIN_EMAIL: "owner@zedu.chat" };
    expect(isSuperAdminEmail("random@example.com", env)).toBe(false);
    expect(isSuperAdminEmail("", env)).toBe(false);
    expect(isSuperAdminEmail(null, env)).toBe(false);
    expect(isSuperAdminEmail(undefined, env)).toBe(false);
  });

  it("handles comma-separated lists", () => {
    const env = { SUPER_ADMIN_EMAILS: "admin1@test.com, admin2@test.com" };
    expect(isSuperAdminEmail("admin1@test.com", env)).toBe(true);
    expect(isSuperAdminEmail("admin2@test.com", env)).toBe(true);
  });

  it("merges SUPER_ADMIN_EMAIL and SUPER_ADMIN_EMAILS when both are set", () => {
    const env = {
      SUPER_ADMIN_EMAIL: "owner@zedu.chat",
      SUPER_ADMIN_EMAILS: "lead@zedu.chat",
    };
    expect(isSuperAdminEmail("owner@zedu.chat", env)).toBe(true);
    expect(isSuperAdminEmail("lead@zedu.chat", env)).toBe(true);
  });
});
