import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const agentPlatformSql = readFileSync("scripts/sql/ensure-agent-platform.sql", "utf8");
const migrate = readFileSync("scripts/migrate.mjs", "utf8");

describe("Agent platform startup repair", () => {
  it("creates agent platform tables, enums, and columns without dropping anything", () => {
    expect(agentPlatformSql).toContain('CREATE TABLE IF NOT EXISTS "Tenant"');
    expect(agentPlatformSql).toContain('CREATE TABLE IF NOT EXISTS "Project"');
    expect(agentPlatformSql).toContain('CREATE TABLE IF NOT EXISTS "Membership"');
    expect(agentPlatformSql).toContain('CREATE TABLE IF NOT EXISTS "Agent"');
    expect(agentPlatformSql).toContain('ADD COLUMN IF NOT EXISTS "tenantId"');
    expect(agentPlatformSql).toContain('ADD COLUMN IF NOT EXISTS "projectId"');
    expect(agentPlatformSql).toContain('ADD COLUMN IF NOT EXISTS "beneficiaryUserId"');
    expect(agentPlatformSql).toContain('CREATE TYPE "MembershipRole" AS ENUM');
    expect(agentPlatformSql.toLowerCase()).not.toMatch(/\bdrop\b/);
  });

  it("runs the repair and records the agent platform migration in migrate.mjs", () => {
    expect(migrate).toContain("scripts/sql/ensure-agent-platform.sql");
    expect(migrate).toContain("20261021000000_agent_platform");
  });
});
