## Summary

The webhook dispatch endpoint in `app/api/v1/webhooks/dispatch/route.ts` has no rate limiting, allowing unlimited calls to trigger webhook delivery processing.

## Current Code

```typescript
// app/api/v1/webhooks/dispatch/route.ts
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.WEBHOOK_DISPATCH_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const count = await dispatchDueDeliveries();
    return NextResponse.json({ dispatched: count });
  } catch (error) {
    return NextResponse.json({ error: "Dispatch failed" }, { status: 503 });
  }
}
```

## Issue

- Only authentication via `WEBHOOK_DISPATCH_SECRET` is checked
- No rate limiting on how often the dispatch can be called
- A compromised scheduler or misconfigured cron could spam the endpoint
- This could overwhelm the webhook delivery system

## Proposed Fix

Add rate limiting to the dispatch endpoint, e.g., max 1 call per 10 seconds per IP or per secret.