import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  RATE_LIMIT_RETENTION_MS,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/rate-limit";

/**
 * The shared rate-limit store (#296): one row per allowed attempt in
 * "RateLimitHit", read as a sliding window — the same semantics as the
 * in-memory limiter.
 *
 * Each check runs in a transaction holding a Postgres advisory lock on the
 * key, so two instances checking the same key at once can't both see
 * "one left" and both proceed.
 *
 * Keys are stored hashed: they contain email addresses and IPs, which have
 * no business sitting in a table for an hour.
 *
 * Times are epoch milliseconds in a BIGINT, which sidesteps any session
 * time zone between Node and Postgres.
 */

/** How often a check also deletes expired rows: roughly 1 in this many. */
const CLEANUP_EVERY = 200;

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function hit(key: string, config: RateLimitConfig, now: number): Promise<RateLimitResult> {
  const hashed = hashKey(key);
  const windowStart = BigInt(now - config.windowMs);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${hashed}))`;
    const rows = await tx.$queryRaw<{ count: bigint; oldest: bigint | null }[]>`
      SELECT count(*)::bigint AS count, min("at") AS oldest
      FROM "RateLimitHit"
      WHERE "key" = ${hashed} AND "at" > ${windowStart}`;
    const count = Number(rows[0]?.count ?? 0);
    if (count >= config.max) {
      const oldest = rows[0]?.oldest != null ? Number(rows[0].oldest) : now;
      return { allowed: false, retryAfterMs: Math.max(0, oldest + config.windowMs - now) };
    }
    await tx.$executeRaw`INSERT INTO "RateLimitHit" ("key", "at") VALUES (${hashed}, ${BigInt(now)})`;
    return { allowed: true, retryAfterMs: 0 };
  });

  if (Math.random() * CLEANUP_EVERY < 1) {
    const cutoff = BigInt(now - RATE_LIMIT_RETENTION_MS);
    prisma.$executeRaw`DELETE FROM "RateLimitHit" WHERE "at" < ${cutoff}`.catch((error: unknown) =>
      console.error("[rate-limit] cleanup failed", error),
    );
  }
  return result;
}

export const postgresRateLimitStore: RateLimitStore = { hit };
