## Summary

There's no scheduled job to clean up old `RateLimitHit` records from the database. The `RATE_LIMIT_RETENTION_MS` constant defines how long to keep records, but no cleanup job exists.

## Current State

- `lib/rate-limit-postgres.ts` stores rate limit hits in the `RateLimitHit` table
- `RATE_LIMIT_RETENTION_MS = LONGEST_WINDOW_MS = 60 * 60 * 1000` (1 hour)
- No cron job or scheduled task calls the cleanup function
- The cleanup logic exists in `checkRateLimit` (in-memory) and partially in `lib/rate-limit-postgres.ts` but is not scheduled

## Code Reference

`lib/rate-limit-postgres.ts` line 55:
```typescript
prisma.$executeRaw`DELETE FROM "RateLimitHit" WHERE "at" < ${cutoff}`.catch((error: unknown) => ...
```

This only runs when `consumeRateLimit` is called and the store is Postgres, but it's not guaranteed to run regularly.

## Impact

- `RateLimitHit` table grows indefinitely
- Database bloat over time
- Potential performance degradation

## Proposed Fix

1. Add a scheduled job (cron) to clean up old rate limit hits
2. Or add a pg_cron job in PostgreSQL
3. Run cleanup periodically (e.g., every hour)