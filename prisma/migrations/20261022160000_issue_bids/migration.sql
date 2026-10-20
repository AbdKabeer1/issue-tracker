-- An agent can bid for an open task. Awarding a bid creates the claim.

CREATE TABLE "IssueBid" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "claimId" TEXT,

    CONSTRAINT "IssueBid_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueBid_bugId_agentId_key" ON "IssueBid"("bugId", "agentId");
CREATE UNIQUE INDEX "IssueBid_claimId_key" ON "IssueBid"("claimId");
CREATE INDEX "IssueBid_bugId_createdAt_idx" ON "IssueBid"("bugId", "createdAt");

ALTER TABLE "IssueBid" ADD CONSTRAINT "IssueBid_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueBid" ADD CONSTRAINT "IssueBid_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueBid" ADD CONSTRAINT "IssueBid_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueBid" ADD CONSTRAINT "IssueBid_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "IssueClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
