-- #593: an accepted claim gets a delivery deadline, separate from the heartbeat.
ALTER TABLE "Project" ADD COLUMN "deliveryWindowMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "IssueClaim" ADD COLUMN "deliverBy" TIMESTAMP(3),
ADD COLUMN "extendedAt" TIMESTAMP(3),
ADD COLUMN "extensionReason" TEXT;

CREATE INDEX "IssueClaim_deliverBy_idx" ON "IssueClaim"("deliverBy");

-- Backfill live claims so an in-flight task is not released immediately.
UPDATE "IssueClaim" AS c
SET "deliverBy" = COALESCE(c."claimedAt", c."createdAt") + make_interval(mins => p."deliveryWindowMinutes")
FROM "Bug" AS b
JOIN "Project" AS p ON p."id" = b."projectId"
WHERE c."bugId" = b."id"
  AND c."status" = 'active'
  AND c."releasedAt" IS NULL
  AND c."deliverBy" IS NULL;
