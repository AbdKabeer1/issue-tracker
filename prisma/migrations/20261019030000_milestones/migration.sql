-- Milestones (#289): group issues into a release or sprint with an
-- optional due date. Deleting a milestone clears its issues' link.
ALTER TYPE "ActivityType" ADD VALUE 'milestone_changed';

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Milestone_title_key" ON "Milestone"("title");
CREATE INDEX "Milestone_isClosed_dueDate_idx" ON "Milestone"("isClosed", "dueDate");

ALTER TABLE "Bug" ADD COLUMN "milestoneId" TEXT;
CREATE INDEX "Bug_milestoneId_idx" ON "Bug"("milestoneId");
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
