-- #215: file attachments on issues and comments, stored in Postgres.
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "bugId" TEXT,
    "commentId" TEXT,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_bugId_idx" ON "Attachment"("bugId");
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");
CREATE INDEX "Attachment_uploaderId_createdAt_idx" ON "Attachment"("uploaderId", "createdAt");

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
