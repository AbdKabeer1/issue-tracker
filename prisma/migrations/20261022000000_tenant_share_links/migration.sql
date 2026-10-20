-- Shareable tenant invite links. Separate from email invites: one link can
-- admit many people, with an expiry and an optional cap on how many join.

-- CreateTable
CREATE TABLE "TenantShareLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantShareRedemption" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantShareRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantShareLink_tokenHash_key" ON "TenantShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantShareLink_tenantId_createdAt_idx" ON "TenantShareLink"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "TenantShareRedemption_userId_idx" ON "TenantShareRedemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantShareRedemption_linkId_userId_key" ON "TenantShareRedemption"("linkId", "userId");

-- AddForeignKey
ALTER TABLE "TenantShareLink" ADD CONSTRAINT "TenantShareLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantShareLink" ADD CONSTRAINT "TenantShareLink_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantShareRedemption" ADD CONSTRAINT "TenantShareRedemption_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TenantShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantShareRedemption" ADD CONSTRAINT "TenantShareRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantShareLink" ADD CONSTRAINT "TenantShareLink_maxUses_check" CHECK ("maxUses" IS NULL OR "maxUses" > 0) NOT VALID;
ALTER TABLE "TenantShareLink" VALIDATE CONSTRAINT "TenantShareLink_maxUses_check";

ALTER TABLE "TenantShareLink" ADD CONSTRAINT "TenantShareLink_useCount_check" CHECK ("useCount" >= 0) NOT VALID;
ALTER TABLE "TenantShareLink" VALIDATE CONSTRAINT "TenantShareLink_useCount_check";
