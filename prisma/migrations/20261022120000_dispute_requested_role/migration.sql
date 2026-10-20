-- Remember which award a missing-points dispute asked for (#709).
-- Nullable: disputes about an existing entry do not request a role.
ALTER TABLE "PointDispute" ADD COLUMN "requestedRole" "PointRole";
