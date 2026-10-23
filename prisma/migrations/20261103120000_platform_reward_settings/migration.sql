-- Site-wide reward defaults editable by super admins. A missing row means
-- the hard-coded amounts in lib/points/rules.ts are used unchanged.
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "rewardConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
