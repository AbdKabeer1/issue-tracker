-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'deleted';
ALTER TYPE "ActivityType" ADD VALUE 'restored';

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bug" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Bug_isDeleted_idx" ON "Bug"("isDeleted");
