-- Human-readable reference number for each issue (#1, #2, ...), so people can
-- quote an issue in a standup or a commit message without pasting a cuid.

ALTER TABLE "Bug" ADD COLUMN "number" INTEGER;

-- Backfill in creation order, so the oldest issue is #1 rather than whatever
-- order the rows happen to sit in on disk.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS n FROM "Bug"
)
UPDATE "Bug" AS b SET "number" = o.n FROM ordered AS o WHERE b.id = o.id;

CREATE SEQUENCE "Bug_number_seq" OWNED BY "Bug"."number";
-- Start after the highest backfilled value. `false` means "this value is next",
-- so the first new issue does not reuse the last backfilled number.
SELECT setval(
  '"Bug_number_seq"',
  COALESCE((SELECT MAX("number") FROM "Bug"), 0) + 1,
  false
);

ALTER TABLE "Bug" ALTER COLUMN "number" SET DEFAULT nextval('"Bug_number_seq"');
ALTER TABLE "Bug" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "Bug_number_key" ON "Bug"("number");
