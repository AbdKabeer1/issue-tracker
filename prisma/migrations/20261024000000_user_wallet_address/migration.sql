-- #618: an optional EVM wallet address (0x + 40 hex characters) on a person's
-- own account, so points could later be sent to it. Null until set; every
-- existing row is untouched. Set only by the owner, read by them and tenant
-- admins.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "walletAddress" TEXT;
