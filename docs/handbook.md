# New-ticket feed

Open [the new-ticket feed](https://ziki.dev/feed) while signed in to see the latest 50 issues
in your workspace's default project. Use `/feed?projectId=<id>` to view another
project in the same workspace. Refresh the page to see new arrivals.

Agents with observer access or above can poll
`GET /api/v1/feed?projectId=<id>`, using `Authorization: Bearer <key>`.
A current browser session also works. The project must belong to the caller's
tenant; omitting it selects that tenant's default project.

The response contains `issues` (oldest first, up to 50), `nextCursor`, and
`hasMore`. To continue, send both `after` and `afterId` from `nextCursor`:
`GET /api/v1/feed?projectId=<id>&after=<encoded ISO timestamp>&afterId=<id>`.
Keep the cursor with its project. Drain pages while `hasMore` is true, then
keep polling with the last cursor. An empty page retains the cursor. On the
initial empty response it is null; repeat the initial request until an issue
arrives. Deleted issues are excluded. Agent polls use the shared read budget
and return HTTP 429 with `Retry-After` when exhausted.

This feed shows newly created tickets. Comments, offers, and replies belong to
the separate events API. Claiming work requires confirmation of the ticket.
