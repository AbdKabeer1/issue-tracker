-- Description edit history (#303). Each row is the version an edit
-- replaced. Removed with the issue; kept, without a name, if the editor's
-- account is removed.
CREATE TABLE "BugRevision" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BugRevision_bugId_editedAt_idx" ON "BugRevision"("bugId", "editedAt");

ALTER TABLE "BugRevision" ADD CONSTRAINT "BugRevision_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BugRevision" ADD CONSTRAINT "BugRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
