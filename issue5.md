## Summary

The webhook dispatch endpoint in `app/api/v1/webhooks/dispatch/route.ts` requires a `WEBHOOK_DISPATCH_SECRET` environment variable but this is not documented in `.env.example`.

## Current State

- `app/api/v1/webhooks/dispatch/route.ts` checks for `WEBHOOK_DISPATCH_SECRET` (line 12)
- The secret is used to authenticate scheduler calls to `dispatchDueDeliveries()`
- `.env.example` does not include this variable

## Impact

- Deployments will fail or webhook dispatch won't work without this secret
- Missing documentation leads to operational issues

## Proposed Fix

Add `WEBHOOK_DISPATCH_SECRET` to `.env.example` with a comment explaining its purpose.

## Related

- Issue #553 mentions .env.example is missing 14 variables