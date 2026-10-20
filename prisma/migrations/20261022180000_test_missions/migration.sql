CREATE TYPE "MissionRole" AS ENUM ('admin', 'member', 'signed_out');
CREATE TYPE "MissionViewport" AS ENUM ('desktop', 'mobile_375');

CREATE TABLE "TestMission" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "routePattern" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "role" "MissionRole" NOT NULL,
    "viewport" "MissionViewport" NOT NULL,
    "lastCoveredAt" TIMESTAMP(3),
    "issuesFiled" INTEGER NOT NULL DEFAULT 0,
    "lastAssignedAt" TIMESTAMP(3),
    "lastAssignedOwnerId" TEXT,
    "leaseAgentId" TEXT,
    "leaseOwnerId" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestMission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestMission_projectId_routePattern_role_viewport_key"
    ON "TestMission"("projectId", "routePattern", "role", "viewport");
CREATE INDEX "TestMission_projectId_lastCoveredAt_lastAssignedAt_idx"
    ON "TestMission"("projectId", "lastCoveredAt", "lastAssignedAt");
CREATE INDEX "TestMission_leaseAgentId_leaseExpiresAt_idx"
    ON "TestMission"("leaseAgentId", "leaseExpiresAt");

ALTER TABLE "TestMission" ADD CONSTRAINT "TestMission_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
