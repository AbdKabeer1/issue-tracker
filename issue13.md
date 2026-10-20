## Summary

The `agentApiKey` model in `prisma/schema.prisma` stores only the SHA-256 hash of the API key (`keyHash`), but there's no way to rotate the key without deleting and recreating the subscription.

## Current State

- `AgentApiKey` model has `keyHash` (SHA-256 of raw key) and `prefix` (first few chars for identification)
- `app/api/v1/agents/me/key/route.ts` has a `POST` endpoint to rotate the key
- But there's no `PATCH` or `PUT` endpoint on `app/api/v1/webhooks/[id]/route.ts` to rotate the webhook signing secret

## Issue

- Webhook subscriptions have a `signingSecretEncrypted` field that's encrypted (not hashed)
- There's no API to rotate this secret without deleting and recreating the subscription
- Issue #643 mentions "Agents can't rotate a webhook signing secret without deleting the subscription"

## Proposed Fix

Add a `PATCH` endpoint to `/api/v1/webhooks/[id]` that allows rotating the signing secret, similar to how agent API keys can be rotated.