-- Mark an issue as a duplicate of another (#285). Deleting the canonical
-- issue clears the link rather than deleting its duplicates.
ALTER TYPE "ActivityType" ADD VALUE 'duplicate_changed';

ALTER TABLE "Bug" ADD COLUMN "duplicateOfId" TEXT;

CREATE INDEX "Bug_duplicateOfId_idx" ON "Bug"("duplicateOfId");

ALTER TABLE "Bug" ADD CONSTRAINT "Bug_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Bug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Belt and braces under the action's check: never a self link.
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_not_duplicate_of_self" CHECK ("duplicateOfId" IS NULL OR "duplicateOfId" <> "id");
