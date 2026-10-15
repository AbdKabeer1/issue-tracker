-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('created', 'status_changed', 'severity_changed', 'assignee_changed', 'commented', 'edited');

-- CreateTable
CREATE TABLE "BugActivity" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugActivity_bugId_createdAt_idx" ON "BugActivity"("bugId", "createdAt");

-- AddForeignKey
ALTER TABLE "BugActivity" ADD CONSTRAINT "BugActivity_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugActivity" ADD CONSTRAINT "BugActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
