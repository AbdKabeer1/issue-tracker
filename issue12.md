## Summary

The `expireOffer` function in `lib/agent-api/offer.ts` uses `setTimeout` to schedule offer expiration (line 37-38), but this is not durable across process restarts.

## Current Code

```typescript
// lib/agent-api/offer.ts
function scheduleOfferExpiry(claimId: string): void {
  setTimeout(() => { void expireOffer(claimId).catch(() => undefined); }, OFFER_TTL_MS);
}
```

## Issue

- `setTimeout` is in-memory only
- If the server restarts, all pending timeouts are lost
- Expired offers will never be cleaned up unless the server stays up continuously
- The `expireOffer` function does check `isOfferExpired` again (line 122), but it's only called via the timeout

## Impact

- Offers that should expire remain in "offered" state indefinitely after a restart
- Blocks new offers for those issues
- Manual intervention required to clean up

## Proposed Fix

1. Add a scheduled job (cron) that periodically calls `expireOffer` for all pending offers
2. Or use a database-based scheduling mechanism (pg_cron, etc.)
3. The `expireOffer` function already has the logic to check if an offer is actually expired, so it's safe to call repeatedly

## Related

- Issue #647 mentions "No scheduler runs the platform sweeps — offers, claims, promotions, dispatch, and retention all depend on human clicks or dying timers"