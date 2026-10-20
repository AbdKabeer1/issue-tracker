## Summary

The `offerNext` function in `lib/agent-api/offer.ts` locks User rows with `FOR NO KEY UPDATE` (line 59) but this locking is done per-user in a loop, which doesn't prevent race conditions between different users being offered the same issue.

## Current Code

```typescript
// lib/agent-api/offer.ts, lines 58-60
for (const userId of people.map((person) => person.beneficiaryUserId).sort()) {
  await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
}
```

## Issue

- The loop locks each user row sequentially
- Between locking user A and user B, another concurrent request could lock user B first and create an offer
- The comment on line 56-57 says "Serialize offer selection across issues so a person cannot accumulate simultaneous pending offers while their active-claim count is stale" but this doesn't prevent two requests from creating offers for the same bug

## Impact

- Race condition in offer creation
- Multiple offers could be created for the same issue
- Violates the invariant of at most one pending offer per issue

## Proposed Fix

1. Lock the Bug row first (already done in `offerIssue`)
2. Then check for existing offers/claims within the same transaction
3. Only then create the new offer
4. The user locking should be inside the same critical section