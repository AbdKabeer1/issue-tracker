-- CreateTable
CREATE TABLE "IssueType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueType_name_key" ON "IssueType"("name");

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "typeId" TEXT;

-- CreateIndex
CREATE INDEX "Bug_typeId_idx" ON "Bug"("typeId");

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "IssueType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default issue types (Marketing, Design, Fix, Feat)
INSERT INTO "IssueType" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
VALUES
  ('type_marketing', 'Marketing', 'Marketing and promotion related tasks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('type_design', 'Design', 'UI/UX and visual design tasks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('type_fix', 'Fix', 'Bug fixes and defect resolutions', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('type_feat', 'Feat', 'New features and enhancements', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

