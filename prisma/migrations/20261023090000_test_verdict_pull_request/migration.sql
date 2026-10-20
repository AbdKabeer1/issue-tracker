-- #526, #529: a test verdict names the pull request it tested, and a
-- reviewer can change their verdict. Both columns are nullable, so existing
-- rows are untouched; a verdict with no pull request no longer counts
-- towards the merge gate.
ALTER TABLE "TestVerdict" ADD COLUMN IF NOT EXISTS "pullRequestUrl" TEXT;
ALTER TABLE "TestVerdict" ADD COLUMN IF NOT EXISTS "changedAt" TIMESTAMP(3);
