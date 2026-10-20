-- #517: issue numbers are per tenant, not one site-wide sequence. A new
-- tenant's first issue is #1 instead of whatever number the shared sequence
-- happened to reach, so the count no longer leaks across organisations.
--
-- Existing rows are not renumbered. Each tenant's counter resumes after its
-- own highest number, which keeps Zedu's numbers exactly as they are.

ALTER TABLE "Tenant" ADD COLUMN "nextIssueNumber" INTEGER NOT NULL DEFAULT 1;

UPDATE "Tenant" AS t
SET "nextIssueNumber" = COALESCE(
  (SELECT MAX(b."number") + 1 FROM "Bug" AS b WHERE b."tenantId" = t."id"),
  1
);

-- The insert trigger takes the next value under the tenant row lock. Two
-- concurrent creates for the same tenant serialise on that UPDATE, and a
-- rolled-back insert also rolls the counter back, so numbers have no gaps.
CREATE OR REPLACE FUNCTION "assign_tenant_bug_number"() RETURNS trigger AS $$
DECLARE
  assigned integer;
BEGIN
  UPDATE "Tenant"
  SET "nextIssueNumber" = "nextIssueNumber" + 1
  WHERE "id" = NEW."tenantId"
  RETURNING "nextIssueNumber" - 1 INTO assigned;

  NEW."number" := assigned;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Bug_assign_tenant_number" ON "Bug";
CREATE TRIGGER "Bug_assign_tenant_number"
BEFORE INSERT ON "Bug"
FOR EACH ROW EXECUTE FUNCTION "assign_tenant_bug_number"();

-- Global uniqueness becomes per-tenant uniqueness.
DROP INDEX IF EXISTS "Bug_number_key";
CREATE UNIQUE INDEX "Bug_tenantId_number_key" ON "Bug"("tenantId", "number");
