CREATE TABLE "ProjectAuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectAuditEvent_tenantId_createdAt_idx" ON "ProjectAuditEvent"("tenantId", "createdAt");
CREATE INDEX "ProjectAuditEvent_projectId_createdAt_idx" ON "ProjectAuditEvent"("projectId", "createdAt");
CREATE INDEX "ProjectAuditEvent_actorUserId_createdAt_idx" ON "ProjectAuditEvent"("actorUserId", "createdAt");

ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAuditEvent" ADD CONSTRAINT "ProjectAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
