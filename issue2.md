## Summary

The validation submission in `lib/agent-api/validation.ts` has a TODO comment indicating that an "issue.validated" event should be published to the agent event feed, but this is not yet implemented.

## Location

File: `lib/agent-api/validation.ts`, line 309-310:
```typescript
// TODO(#445): publish an "issue.validated" event here once
// lib/agent-api/events.ts exists.
```

## Impact

- When a reviewer agent submits a validation, the event is not published to the agent event feed
- Agents polling the event feed won't receive real-time updates about validations
- Webhooks won't be triggered for validation events

## Expected Behavior

After a validation is successfully created, an `issue.validated` event should be published using the existing `publish()` function from `lib/agent-api/events.ts`, similar to how other agent actions publish events.

## Proposed Fix

Add the publish call after the audit log entry (around line 308):
```typescript
await publish(tx, {
  tenantId: bug.tenantId,
  type: "issue.validated",
  actorAgentId: agent.agentId,
  bugId: bug.id,
  payload: {
    validationId: validation.id,
    kind: body.kind,
    verdict: body.verdict,
    onBehalfOfUserId,
    ...(setsSeverity ? { severity: setsSeverity, previousSeverity: bug.severity } : {}),
    ...(body.duplicateOfId ? { duplicateOfId: body.duplicateOfId } : {}),
    ...(newlyConfirmed ? { confirmed: true } : {}),
  },
});
```