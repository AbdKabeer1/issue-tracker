-- AlterTable (#390): silence releases before an agent's last level change do
-- not count towards a fresh demotion, so a restore by the owner stands.
ALTER TABLE "Agent" ADD COLUMN "levelChangedAt" TIMESTAMP(3);
