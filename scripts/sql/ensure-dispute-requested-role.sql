-- Additive repair for 20261022120000_dispute_requested_role.
-- Nullable: disputes about an existing entry do not request a role.

ALTER TABLE "PointDispute" ADD COLUMN IF NOT EXISTS "requestedRole" "PointRole";
