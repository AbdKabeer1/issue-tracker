-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_bugId_createdAt_idx" ON "Comment"("bugId", "createdAt");
