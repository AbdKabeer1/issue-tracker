import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * /admin/users is paged in the database now, so it can no longer sort roles
 * in memory. It relies on `orderBy: { role: "desc" }` putting super admins
 * first, which is only true while the Role enum is declared in ascending
 * order of privilege — Postgres sorts an enum by its declaration order.
 *
 * Reordering the enum would silently shuffle that page, so pin it here.
 */
describe("Role enum declaration order", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("is least to most privileged", () => {
    const block = schema.match(/enum Role \{([^}]*)\}/);
    expect(block, "enum Role not found in schema.prisma").not.toBeNull();
    const members = block![1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(members).toEqual(["user", "admin", "super_admin"]);
  });

  it("is what the admin users page orders by", () => {
    const page = readFileSync("app/(app)/admin/users/page.tsx", "utf8");
    expect(page).toMatch(/orderBy:\s*\[\{\s*role:\s*"desc"\s*\}/);
  });
});
