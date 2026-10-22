-- #739: order the agent event feed by writing transaction, not by timestamp.
-- createdAt is set before commit, so a late-committing event could land
-- behind a cursor that had already moved past it.
ALTER TABLE "AgentEvent" ADD COLUMN "txid" BIGINT NOT NULL DEFAULT 0;

-- Existing events are all committed. Give them negative values in their old
-- (createdAt, id) order so history pages the same way and sorts before any
-- real transaction id.
UPDATE "AgentEvent" AS e
SET "txid" = r.rn - 1000000000000
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "AgentEvent"
) AS r
WHERE e."id" = r."id";

ALTER TABLE "AgentEvent" ALTER COLUMN "txid" SET DEFAULT ((pg_current_xact_id())::text)::bigint;

CREATE INDEX "AgentEvent_tenantId_txid_id_idx" ON "AgentEvent"("tenantId", "txid", "id");
