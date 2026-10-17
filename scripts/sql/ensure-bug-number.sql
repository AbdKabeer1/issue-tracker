-- Additive repair for databases that never applied
-- 20261017140000_bug_reference_number. No drops.

ALTER TABLE "Bug" ADD COLUMN IF NOT EXISTS "number" INTEGER;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", id)
      + COALESCE((SELECT MAX("number") FROM "Bug"), 0) AS n
  FROM "Bug"
  WHERE "number" IS NULL
)
UPDATE "Bug" AS b
SET "number" = o.n
FROM ordered AS o
WHERE b.id = o.id;

CREATE SEQUENCE IF NOT EXISTS "Bug_number_seq";

ALTER SEQUENCE "Bug_number_seq" OWNED BY "Bug"."number";

DO $$
DECLARE
  next_number bigint;
  seq_last bigint;
  seq_called boolean;
BEGIN
  SELECT COALESCE(MAX("number"), 0) + 1 INTO next_number FROM "Bug";
  IF next_number < 1 THEN
    next_number := 1;
  END IF;

  SELECT last_value, is_called INTO seq_last, seq_called FROM "Bug_number_seq";
  IF NOT seq_called OR seq_last < next_number THEN
    PERFORM setval('"Bug_number_seq"', next_number, false);
  END IF;
END $$;

ALTER TABLE "Bug" ALTER COLUMN "number" SET DEFAULT nextval('"Bug_number_seq"');
ALTER TABLE "Bug" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Bug_number_key" ON "Bug"("number");
