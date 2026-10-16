-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_lower_name_key" ON "Category"(LOWER("name"));

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IssueType_lower_name_key" ON "IssueType"(LOWER("name"));
