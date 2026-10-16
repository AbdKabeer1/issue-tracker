-- Clamp any previously abused vote values, then recompute counts and enforce the range.
UPDATE "Vote" SET "value" = 1 WHERE "value" > 1;
UPDATE "Vote" SET "value" = -1 WHERE "value" < -1;
DELETE FROM "Vote" WHERE "value" = 0;

UPDATE "Bug" b
SET "voteCount" = COALESCE((SELECT SUM(v."value") FROM "Vote" v WHERE v."bugId" = b."id"), 0);

ALTER TABLE "Vote" ADD CONSTRAINT "Vote_value_check" CHECK ("value" IN (-1, 1));
