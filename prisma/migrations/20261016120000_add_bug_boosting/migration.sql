-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'boosted';
ALTER TYPE "ActivityType" ADD VALUE 'unboosted';

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "isBoosted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bug" ADD COLUMN "boostedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Bug_isBoosted_idx" ON "Bug"("isBoosted");
