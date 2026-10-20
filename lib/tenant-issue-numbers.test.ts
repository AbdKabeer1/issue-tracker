import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * #517: issue numbers are handed out per tenant. The guarantee lives in the
 * database (a row-locking counter plus a BEFORE INSERT trigger), so these
 * checks lock down the migration and schema that carry it.
 */

const migration = readFileSync(
  "prisma/migrations/20261023100000_tenant_issue_numbers/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("per-tenant issue numbers (#517)", () => {
  it("adds a counter that resumes after each tenant's highest number", () => {
    expect(migration).toContain('ADD COLUMN "nextIssueNumber"');
    expect(migration).toContain('MAX(b."number") + 1');
    expect(migration).toContain('WHERE b."tenantId" = t."id"');
  });

  it("assigns the number from the tenant counter before every insert", () => {
    expect(migration).toContain('BEFORE INSERT ON "Bug"');
    expect(migration).toContain('"nextIssueNumber" = "nextIssueNumber" + 1');
    expect(migration).toContain('NEW."number" := assigned');
  });

  it("makes numbers unique per tenant instead of site-wide", () => {
    expect(migration).toContain('DROP INDEX IF EXISTS "Bug_number_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "Bug_tenantId_number_key" ON "Bug"("tenantId", "number")');
    expect(schema).toContain("@@unique([tenantId, number])");
    expect(schema).toMatch(/model Tenant \{[\s\S]*nextIssueNumber\s+Int\s+@default\(1\)/);
  });
});
