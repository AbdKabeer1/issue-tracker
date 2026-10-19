-- Additive repair for user settings columns: notification preferences, keyboard shortcuts, and theme.
-- migrate deploy can stop on an earlier failure, leaving User table without these columns. No drops.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyMentions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyAssignments" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyStatusChanges" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "keyboardShortcuts" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  CREATE TYPE "ThemePreference" AS ENUM ('system', 'light', 'dark');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "theme" "ThemePreference" NOT NULL DEFAULT 'system';
