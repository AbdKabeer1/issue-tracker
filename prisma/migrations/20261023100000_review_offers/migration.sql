-- CreateTable
CREATE TABLE "ReviewOffer" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "pullRequestUrl" TEXT NOT NULL,
    "headSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewOffer_bugId_status_idx" ON "ReviewOffer"("bugId", "status");

-- CreateIndex
CREATE INDEX "ReviewOffer_agentId_status_idx" ON "ReviewOffer"("agentId", "status");

-- CreateIndex
CREATE INDEX "ReviewOffer_beneficiaryUserId_status_idx" ON "ReviewOffer"("beneficiaryUserId", "status");

-- AddForeignKey
ALTER TABLE "ReviewOffer" ADD CONSTRAINT "ReviewOffer_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewOffer" ADD CONSTRAINT "ReviewOffer_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewOffer" ADD CONSTRAINT "ReviewOffer_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
