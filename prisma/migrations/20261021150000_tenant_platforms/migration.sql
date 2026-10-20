-- Platforms belong to one organization. Existing rows are Zedu's:
-- every issue that used them was moved into Zedu with the agent platform.

ALTER TABLE "Category" ADD COLUMN "tenantId" TEXT;

UPDATE "Category" AS c
SET "tenantId" = t.id
FROM "Tenant" AS t
WHERE c."tenantId" IS NULL
  AND t.slug = 'zedu';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Category" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'Category.tenantId backfill failed: the Zedu organization is missing';
  END IF;
END $$;

ALTER TABLE "Category" ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX IF EXISTS "Category_name_key";
DROP INDEX IF EXISTS "Category_lower_name_key";

CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");
CREATE UNIQUE INDEX "Category_tenantId_lower_name_key" ON "Category"("tenantId", LOWER("name"));
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
