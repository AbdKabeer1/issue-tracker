-- Agent API keys can be limited to one project (#742). Existing keys stay
-- null and keep working across the tenant; new keys set projectId.
-- Pairing stores the project chosen when the owner approves.

ALTER TABLE "AgentApiKey" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AgentPairing" ADD COLUMN "projectId" TEXT;

CREATE INDEX "AgentApiKey_agentId_projectId_idx" ON "AgentApiKey"("agentId", "projectId");

ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPairing" ADD CONSTRAINT "AgentPairing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
