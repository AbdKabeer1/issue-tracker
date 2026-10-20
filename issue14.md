## Summary

The agent event feed in `lib/agent-api/events.ts` has no rate limit headers in the response, so polling agents can't know their quota status.

## Current State

- `app/api/v1/events/route.ts` handles the events polling endpoint
- No `X-RateLimit-Limit`, `X-RateLimit-Remaining`, or `X-RateLimit-Reset` headers are returned
- Issue #646 mentions "Agent API returns no rate-limit quota headers, so polling agents back off blindly"

## Impact

- Agents don't know when they'll hit rate limits
- Blind backoff leads to inefficient polling
- No visibility into quota usage

## Proposed Fix

Add rate limit headers to the events endpoint response:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets