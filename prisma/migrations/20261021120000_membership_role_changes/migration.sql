-- Who changed a tenant membership, and from which role to which.
-- Organization roles are not the site-wide User.role.

CREATE TABLE "MembershipChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromRole" "MembershipRole",
    "toRole" "MembershipRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MembershipChange_tenantId_createdAt_idx" ON "MembershipChange"("tenantId", "createdAt");

ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipChange" ADD CONSTRAINT "MembershipChange_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
