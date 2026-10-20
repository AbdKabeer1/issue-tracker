## Summary

Agent pairing codes in `prisma/schema.prisma` (model `AgentPairing`) have an `expiresAt` field but there's no cleanup job to remove expired pairings from the database.

## Current State

- `AgentPairing` model has `expiresAt DateTime` field
- Pairing codes are created with a TTL (typically 10-15 minutes)
- No scheduled job or database trigger cleans up expired pairings
- Expired pairings accumulate in the database indefinitely

## Impact

- Database bloat from unused pairing records
- Potential performance impact on pairing-related queries
- Security risk: expired but unused pairing codes remain valid until cleaned up

## Related Code

- `prisma/schema.prisma` lines 555-574: AgentPairing model
- `lib/agents/registry.ts`: Pairing creation logic
- `app/api/v1/agents/pairing/route.ts`: Pairing creation endpoint

## Proposed Fix

1. Add a scheduled job (cron) to clean up expired pairings periodically
2. Or add a database trigger/function to auto-delete expired rows
3. Run cleanup on pairing approval/rejection as well

## Example Cleanup Query

```sql
DELETE FROM "AgentPairing" 
WHERE "expiresAt" < NOW() 
  AND "approvedAt" IS NULL 
  AND "consumedAt" IS NULL;
```