-- Additive repair for 20261022120000_agent_key_project_scope.
-- migrate deploy can stop on an earlier failure, so pairing still inserts a
-- row whose Prisma client selects AgentPairing.projectId. No drops.

ALTER TABLE "AgentApiKey" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "AgentPairing" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE INDEX IF NOT EXISTS "AgentApiKey_agentId_projectId_idx" ON "AgentApiKey"("agentId", "projectId");

DO $$ BEGIN
  ALTER TABLE "AgentApiKey"
    ADD CONSTRAINT "AgentApiKey_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentPairing"
    ADD CONSTRAINT "AgentPairing_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
