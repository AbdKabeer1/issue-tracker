## Summary

The rate limiting in `lib/rate-limit.ts` uses `x-forwarded-for` header for IP-based rate limiting, but this header can be spoofed by attackers.

## Current Code

```typescript
// lib/rate-limit.ts, line 97-102
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}
```

## Issue

The comment on line 93-95 acknowledges this:
```typescript
/**
 * Best-effort client IP from proxy headers (first `x-forwarded-for` entry,
 * else `x-real-ip`). It's only used as a rate-limit key, so a spoofed value
 * at worst gives an attacker their own bucket; the per-email limit still applies.
 */
```

However, this is a security concern because:
1. An attacker can rotate `x-forwarded-for` to bypass IP-based rate limits
2. The rate limit is shared across instances via Postgres, so spoofing works globally
3. While per-email limits still apply, IP limits are meant to prevent credential stuffing across multiple emails

## Proposed Fix

1. Validate that the request comes from a trusted proxy (check `X-Forwarded-For` only when behind a known load balancer)
2. Or, use a more robust client identification method
3. At minimum, document this limitation clearly and consider it in threat modeling