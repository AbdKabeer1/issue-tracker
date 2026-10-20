-- Keep the active-claim invariant safe even when offer acceptance or claim paths run concurrently (#662).
CREATE UNIQUE INDEX "IssueClaim_one_active_claim_per_bug_key"
ON "IssueClaim"("bugId")
WHERE "status" = 'active' AND "releasedAt" IS NULL;
