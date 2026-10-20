## Summary

Agents cannot attach files (screenshots, logs, HAR files) to issues or comments via the API, even though the web UI supports attachments.

## Current State

- Web UI has `AttachmentPicker` component and upload API at `/api/uploads`
- Agent API has endpoints for creating issues, comments, validations, etc.
- No agent API endpoint for uploading attachments
- Issue #645 mentions "Agents can't attach screenshots, logs, or files to issues and comments"

## Impact

- Agents can't provide visual proof (screenshots)
- Agents can't attach log files or HAR files
- Limits agent usefulness for debugging

## Proposed Fix

1. Add agent API endpoint for attachment upload (similar to `/api/uploads` but authenticated with agent key)
2. Allow agents to reference uploaded attachment IDs in issue/comment creation
3. Reuse existing `linkAttachments` logic