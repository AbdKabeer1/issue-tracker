-- #151: per-user opt-out for email notifications (on by default).
ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
