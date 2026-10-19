-- ActivityType value used when a milestone link changes (#289).
-- Kept separate from the column repair: ADD VALUE must not roll back
-- Bug.milestoneId if it cannot run inside the same script.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'milestone_changed';
