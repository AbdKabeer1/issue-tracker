## Summary

The `consumeAuthRateLimit` function in `lib/rate-limit.ts` calls `consumeRateLimit` twice (once for email, once for IP) but doesn't use a transaction, so one could succeed while the other fails.

## Current Code

```typescript
// lib/rate-limit.ts, lines 184-199
export async function consumeAuthRateLimit(
  action: AuthRateLimitAction,
  { email, ip }: { email?: string | null; ip?: string | null },
  now = Date.now(),
): Promise<RateLimitResult> {
  const limits = AUTH_RATE_LIMITS[action];
  const checks = await Promise.all([
    email
      ? consumeRateLimit(`auth:${action}:email:${email.trim().toLowerCase()}`, limits.email, now)
      : null,
    ip ? consumeRateLimit(`auth:${action}:ip:${ip}`, limits.ip, now) : null,
  ]);
  const blocked = checks.filter((c): c is RateLimitResult => c !== null && !c.allowed);
  if (blocked.length === 0) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: Math.max(...blocked.map((c) => c.retryAfterMs)) };
}
```

## Issue

- `consumeRateLimit` for email and IP are called in parallel via `Promise.all`
- If the Postgres store is used, these are two separate database operations
- One could succeed (record the hit) while the other fails (network error, timeout)
- This leads to inconsistent rate limit state

## Impact

- Race conditions in auth rate limiting
- Potential for bypassing rate limits if one check fails
- Inconsistent state between email and IP buckets

## Proposed Fix

1. Use a transaction when using Postgres store
2. Or make the checks atomic at the database level
3. At minimum, handle partial failures gracefully