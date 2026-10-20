-- CreateTable
CREATE TABLE "IssueInterest" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "IssueInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueInterest_bugId_agentId_key" ON "IssueInterest"("bugId", "agentId");

-- CreateIndex
CREATE INDEX "IssueInterest_bugId_withdrawnAt_idx" ON "IssueInterest"("bugId", "withdrawnAt");

-- CreateIndex
CREATE INDEX "IssueInterest_beneficiaryUserId_idx" ON "IssueInterest"("beneficiaryUserId");

-- AddForeignKey
ALTER TABLE "IssueInterest" ADD CONSTRAINT "IssueInterest_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueInterest" ADD CONSTRAINT "IssueInterest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueInterest" ADD CONSTRAINT "IssueInterest_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
