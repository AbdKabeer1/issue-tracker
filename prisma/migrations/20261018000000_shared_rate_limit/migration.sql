-- Shared rate-limit store (#296). One row per allowed attempt; the app
-- deletes rows older than its longest window.
CREATE TABLE "RateLimitHit" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "at" BIGINT NOT NULL,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitHit_key_at_idx" ON "RateLimitHit"("key", "at");
