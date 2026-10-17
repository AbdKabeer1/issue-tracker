-- #217: indexes for the issues list.

-- Foreign keys behind the "Assigned to me" / "Reported by me" filters.
CREATE INDEX IF NOT EXISTS "Bug_assigneeId_idx" ON "Bug"("assigneeId");
CREATE INDEX IF NOT EXISTS "Bug_reporterId_idx" ON "Bug"("reporterId");

-- The list is always ordered boosted-first, then by the chosen sort
-- (lib/bugs-sort.ts getBugOrderBy). These match those orders exactly.
CREATE INDEX IF NOT EXISTS "Bug_list_top_votes_idx"
  ON "Bug"("isDeleted", "isBoosted" DESC, "boostedAt" DESC, "voteCount" DESC, "updatedAt" DESC, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Bug_list_newest_idx"
  ON "Bug"("isDeleted", "isBoosted" DESC, "boostedAt" DESC, "createdAt" DESC, "id" DESC);

-- Search uses ILIKE '%q%' on title and description, which no btree index can
-- serve. Trigram GIN indexes can. Creating the extension needs a privileged
-- role, so this is skipped (with a notice) rather than failing the deploy if
-- the database user isn't allowed to; search still works, just unindexed.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm not available (insufficient privilege); skipping search indexes';
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Bug_title_trgm_idx" ON "Bug" USING gin ("title" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Bug_description_trgm_idx" ON "Bug" USING gin ("description" gin_trgm_ops)';
  END IF;
END
$$;
