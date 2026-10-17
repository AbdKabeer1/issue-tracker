-- Per-event email preferences. "emailNotifications" stays as the master
-- switch; these three decide which kinds of mail a user wants when it is on.

ALTER TABLE "User" ADD COLUMN "notifyMentions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyAssignments" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyStatusChanges" BOOLEAN NOT NULL DEFAULT true;

-- Anyone who had already opted out stays opted out of every kind, so turning
-- the master switch back on does not silently resubscribe them to everything.
UPDATE "User"
SET "notifyMentions" = false,
    "notifyAssignments" = false,
    "notifyStatusChanges" = false
WHERE "emailNotifications" = false;
