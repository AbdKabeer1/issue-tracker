-- Ensure Bug_assigneeId_fkey has ON DELETE SET NULL (#356)
DO $$
BEGIN
  ALTER TABLE "Bug" DROP CONSTRAINT IF EXISTS "Bug_assigneeId_fkey";
  ALTER TABLE "Bug"
    ADD CONSTRAINT "Bug_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
