-- #546: retention prunes by age, so each sweep must be an index scan, not a
-- table scan. Indexes match the prune filters in lib/agent-retention.ts:
-- expired pairings (1 day), events (7 days), finished webhook deliveries
-- (delivered/dead, 30 days), and audit rows (180 days).

CREATE INDEX IF NOT EXISTS "AgentPairing_expiresAt_idx" ON "AgentPairing"("expiresAt");
CREATE INDEX IF NOT EXISTS "AgentEvent_createdAt_idx" ON "AgentEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentAuditEvent_createdAt_idx" ON "AgentAuditEvent"("createdAt");
