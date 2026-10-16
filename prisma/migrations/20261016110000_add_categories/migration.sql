-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Bug_categoryId_idx" ON "Bug"("categoryId");

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default categories
INSERT INTO "Category" ("id", "name", "isActive", "createdAt", "updatedAt")
VALUES
    ('cat_mobile', 'Mobile', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('cat_desktop', 'Desktop', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('cat_web', 'Web', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
