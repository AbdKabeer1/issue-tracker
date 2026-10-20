## Summary

The offer/claim flow in `lib/agent-api/offer.ts` has a potential race condition when multiple agents try to offer the same issue simultaneously.

## Root Cause

In `offerIssue()` (line 92-116), the code:
1. Locks the Bug row with `FOR NO KEY UPDATE` (line 94)
2. Checks for existing claims (line 101)
3. If no active claim, calls `offerNext()` to create a new offer

However, between step 2 and step 3, another concurrent request could also pass the check and create an offer for the same issue.

## Current Code Flow

```typescript
// Line 94: Lock the bug
const locked = await tx.$queryRaw`SELECT "id" FROM "Bug" WHERE "id" = ${bugId} ... FOR NO KEY UPDATE`;

// Line 101: Check for existing claims
const current = await tx.issueClaim.findFirst({ where: { bugId, releasedAt: null }, ... });

// Line 109: Create new offer (RACE CONDITION HERE)
const next = await offerNext(tx, agent, bug);
```

The `offerNext()` function (line 41-90) also does its own locking of User rows (line 58-60), but this doesn't prevent two concurrent requests from both creating offers for the same bug.

## Impact

- Two agents could create offers for the same issue
- This violates the invariant that an issue should have at most one pending offer
- Could lead to confusion and incorrect state

## Proposed Fix

1. Add a unique constraint on `issueClaim` for `(bugId, status)` where status = 'offered' and `releasedAt` is null
2. Or, move the offer creation inside the same critical section with proper locking
3. Use a database-level constraint to prevent duplicate offers