import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const columnSql = readFileSync("scripts/sql/ensure-bug-duplicates.sql", "utf8");
const enumSql = readFileSync("scripts/sql/ensure-duplicate-activity-type.sql", "utf8");
const migrate = readFileSync("scripts/migrate.mjs", "utf8");

describe("Bug.duplicateOfId startup repair", () => {
  it("adds the column, index, and constraints without dropping anything", () => {
    expect(columnSql).toContain('ADD COLUMN IF NOT EXISTS "duplicateOfId"');
    expect(columnSql).toContain('CREATE INDEX IF NOT EXISTS "Bug_duplicateOfId_idx"');
    expect(columnSql).toContain('"Bug_duplicateOfId_fkey"');
    expect(columnSql).toContain('"Bug_not_duplicate_of_self"');
    expect(columnSql.toLowerCase()).not.toMatch(/\bdrop\b/);
  });

  it("adds the activity enum in its own script", () => {
    expect(enumSql).toContain("ADD VALUE IF NOT EXISTS 'duplicate_changed'");
    expect(enumSql.toLowerCase()).not.toMatch(/\bdrop\b/);
  });

  it("runs the repair and records the duplicates migration", () => {
    expect(migrate).toContain("scripts/sql/ensure-bug-duplicates.sql");
    expect(migrate).toContain("scripts/sql/ensure-duplicate-activity-type.sql");
    expect(migrate).toContain("20261019020000_bug_duplicates");
  });
});
