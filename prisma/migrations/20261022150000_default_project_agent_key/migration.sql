-- Each person gets a personal agent per project, and that key can be copied again.

ALTER TABLE "Agent" ADD COLUMN "defaultProjectId" TEXT;
ALTER TABLE "AgentApiKey" ADD COLUMN "sealedKey" TEXT;

CREATE UNIQUE INDEX "Agent_ownerUserId_defaultProjectId_key" ON "Agent"("ownerUserId", "defaultProjectId");

ALTER TABLE "Agent" ADD CONSTRAINT "Agent_defaultProjectId_fkey" FOREIGN KEY ("defaultProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
