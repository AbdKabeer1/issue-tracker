-- Additive repair for 20261019020000_bug_duplicates.
-- migrate deploy can stop on an earlier failure, so the issues list asks for
-- Bug.duplicateOfId before that migration has run. No drops.

ALTER TABLE "Bug" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;

CREATE INDEX IF NOT EXISTS "Bug_duplicateOfId_idx" ON "Bug"("duplicateOfId");

DO $$
BEGIN
  ALTER TABLE "Bug"
    ADD CONSTRAINT "Bug_duplicateOfId_fkey"
    FOREIGN KEY ("duplicateOfId") REFERENCES "Bug"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Bug"
    ADD CONSTRAINT "Bug_not_duplicate_of_self"
    CHECK ("duplicateOfId" IS NULL OR "duplicateOfId" <> "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
