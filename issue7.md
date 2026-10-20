## Summary

The `toggleVoteAction` in `app/actions/issues.ts` uses a database row lock (`SELECT ... FOR UPDATE`) to prevent race conditions on vote count, but other actions that modify `voteCount` don't use the same locking mechanism.

## Current State

- `toggleVoteAction` (line 997-1000): Uses `await tx.$queryRaw`SELECT id FROM "Bug" WHERE id = ${bugId} FOR UPDATE`` to lock the bug row
- `createBugAction`, `updateBugAction`, `deleteBugAction`, `restoreBugAction` don't use this locking when they might affect vote counts
- `voteCount` is denormalized and updated in multiple places

## Impact

- Concurrent operations could cause vote count drift
- The reconciliation in `lib/voting.ts` (`reconcileVoteCount`) only runs during vote toggle, not after other operations

## Affected Actions

1. `createBugAction` - Creates bug with initial voteCount=0
2. `updateBugAction` - Could indirectly affect votes if bug is deleted/restored
3. `deleteBugAction` - Soft deletes bug, votes still exist but bug is hidden
4. `restoreBugAction` - Restores bug, votes should still be accurate

## Proposed Fix

Ensure all operations that could affect `voteCount` use the same row locking pattern, or move vote count to a computed value (database view or trigger).