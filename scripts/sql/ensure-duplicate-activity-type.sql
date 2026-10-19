-- ActivityType value used when a duplicate link changes (#285).
-- Kept separate from the column repair: ADD VALUE must not roll back
-- Bug.duplicateOfId if it cannot run inside the same script.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'duplicate_changed';
