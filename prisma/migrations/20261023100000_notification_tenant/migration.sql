-- Preserve the workspace for notifications even if the related issue is later removed.
ALTER TABLE "Notification" ADD COLUMN "tenantId" TEXT;

UPDATE "Notification" AS n
SET "tenantId" = b."tenantId"
FROM "Bug" AS b
WHERE n."bugId" = b."id";

UPDATE "Notification" AS n
SET "tenantId" = a."tenantId"
FROM "AgentQuestion" AS q
JOIN "Agent" AS a ON a."id" = q."agentId"
WHERE n."tenantId" IS NULL
  AND n."kind" = 'agent_question'
  AND n."url" = '/questions/' || q."id";

UPDATE "Notification" AS n
SET "tenantId" = r."tenantId"
FROM "RedesignProposal" AS r
WHERE n."tenantId" IS NULL
  AND n."kind" = 'approval_needed'
  AND n."url" = '/redesigns/' || r."id";

UPDATE "Notification" AS n
SET "tenantId" = i."tenantId"
FROM "TenantInvite" AS i
WHERE n."tenantId" IS NULL
  AND n."kind" = 'tenant_invite'
  AND n."url" = '/tenants?invite=' || i."id";

CREATE INDEX "Notification_userId_tenantId_readAt_idx"
ON "Notification"("userId", "tenantId", "readAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
