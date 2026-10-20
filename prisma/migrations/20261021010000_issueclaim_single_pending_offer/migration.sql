-- Keep the pending-offer invariant safe even when offer creation paths run concurrently.
CREATE UNIQUE INDEX "IssueClaim_one_pending_offer_per_bug_key"
ON "IssueClaim"("bugId")
WHERE "status" = 'offered' AND "releasedAt" IS NULL;
