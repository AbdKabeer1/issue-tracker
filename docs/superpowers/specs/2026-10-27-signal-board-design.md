# Signal Board — design

Date: 2026-10-27
Status: direction chosen, revised for enterprise positioning
Surface: signed-in web app
Primary target: `/dashboard`, `/issues`, `/issues/[id]`

## Intent

Ziki Issues is an enterprise automation layer for software teams. Companies connect their projects; agents and bots monitor the codebase, pick up work, resolve issues, and prevent regressions before they reach customers. People do not work a ticket queue. They supervise the automation and make the few decisions that require judgement: new feature suggestions, high-risk changes, and policy exceptions.

The signed-in home becomes a **Signal Board**: one live surface that shows the operation, the full issue line, the workforce, and the decisions waiting for a human. It replaces the old dashboard and the separate “issues assigned to me” table.

The board is a physical control room, not a themed SaaS dashboard. Dark green shell, cream enamel board, brass labels, enamel signal lamps. The charm comes from the instruments doing real work: a lamp is a state, a handoff is a chain, a down bot has a recovery path, and an approval is a brass plate you actually press.

The existing product truth in `PRODUCT.md` and `docs/ziki-for-agents.md` — one board for humans and agents, agent-first issue tracking, auditable decisions — still holds. This design extends it from an internal/cohort tool into a company-facing automation product. Points, weekly targets, and contributor ranking are removed from the new home and navigation; they are not part of the enterprise story.

## Goals

1. Merge the old dashboard and the all-issues view into one home at `/dashboard`.
2. Make the agent → bot → reviewer handoff visible on each issue.
3. Turn the decision queue into an informed approval surface, not a rubber stamp.
4. Make “down” actionable: show who picked up the work and where to recover.
5. Show the enterprise value: auto-resolved issues, automation coverage, open decisions, and the prevention layer.
6. Carry the same world into the issue detail, full issues list, workforce roster, header, new-issue flow, and login.
7. Preserve every existing function: filters, bulk triage, votes, comments, keyboard shortcuts, skip link, focus management, reduced motion, WCAG AA, and ≥40px targets.

## Non-goals

- No new data model. “Bot” is a presentation label for an execution-level agent; both are `Agent` rows.
- No new automation engine. The board visualizes existing agents, claims, approvals, issues, and events.
- No real-time websocket requirement in v1. The board is a server-rendered snapshot; actions refresh it. A live event feed is a follow-up.
- No removal of the full `/issues` manifest or its bulk actions.
- No fake “wake bot” API. Recovery links to the agent settings/reconnect flow.
- No fake “prevented bug” count. Prevention is a real product direction, but v1 has no prevention data source; it shows only real auto-resolved and open-decision numbers.
- No points, weekly targets, contributor ranking, or leaderboard in the new home, header, or workforce surfaces. Legacy routes may remain for a transition period but are not linked from the signal world.
- No sound.
- No literal 6px instrument labels. The mockup is a scale model; production type is readable.

## Anti-goals

- A dark dashboard with glowing decoration that does not encode state.
- Lamps used as ornament; every lamp must map to `working`, `waiting`, `idle`, or `offline`.
- A home that hides the full issue list behind a second click.
- An approval card that only says “Approve” without showing what is being approved or what happens next.
- A roster of avatars with no current work, last-seen signal, or recovery.
- Replacing the full issues table with a board that cannot filter or bulk-edit.
- A gamified contributor surface in a product sold to engineering organisations.
- Overloading the home with every metric. The operations brief stays compact; deep charts live on the workforce page.

## Constraints

- Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Prisma, Auth.js v5.
- Existing routes, auth, tenant scoping, and RBAC stay intact.
- Existing data loaders are reused where possible: `loadWorkspaceOverview`, `loadOwnAgents`, `teamAgentsForMembers`, `loadPointHistory` (only if a non-gamified operational metric needs it), `openIssueStages`, and the existing issue queries.
- `IssueApproval` and `decideApproval` are the real decision mechanism. The queue shows pending approvals only.
- The full issues page keeps `IssueFilters`, `BulkSelectionProvider`, `PaginationControls`, votes, and search.
- Dark mode must work. The board is a material object: light mode = cream enamel board; dark mode = deep green board with cream ink. The shell stays dark green in both.
- Mobile is a different arrangement, not a squeezed desktop grid.
- The board must be full-bleed below the header. Do not fake it with negative margins on a max-width container.
- The board is tenant-wide by default. It ignores the active-project cookie unless the user picks a project in the board header. The full manifest link must include `&project=all` so the two surfaces agree.

## The world

### Palette

| Role | Light | Dark |
| --- | --- | --- |
| Shell | `#1B2A24` bottle green | `#101C17` |
| Board | `#EFE7D6` cream enamel | `#1F3028` deep enamel |
| Board raised | `#FBF7EC` | `#263A31` |
| Ink | `#1E2B25` | `#EDE6D6` |
| Muted ink | `#5F675F` | `#A9B8AD` |
| Brass | `#AD8551` | `#C39A61` |
| Signal green | `#3F9D72` | `#58C694` |
| Signal amber | `#C4862B` | `#E0AD55` |
| Signal red | `#B74B3C` | `#E07A68` |
| Idle | `#B4AA97` | `#6F8177` |

Color strategy: **Committed**. The shell and board own whole regions. Brass is the action color; green/amber/red are state only. No gradient headlines, no glass, no soft neon.

### Type

- Display and UI: **Archivo** (variable, self-hosted via `next/font`), with tight tracking on large headings.
- Instrument labels and data: **Geist Mono** (already in the app), tabular numerals.
- No Fraunces, no field-guide serif. The previous world is the anti-reference.
- Production sizes: board headings 22–28px; issue titles 14–16px; body 13–14px; metadata 11–12px. Never below 11px for essential data.

### Materials

- Enamel board with a faint edge seam and corner screws.
- Brass label plates, slightly warm, not shiny gold.
- Paper job cards on the conveyor or in the decision queue, with a soft 1–2px offset shadow, not a hard neobrutalist block.
- Signal lamps with a glass highlight and a soft glow; glow is reserved for active states.
- Thin rules and engraved dividers; no rounded pill soup. Controls are 2–4px radius, square-ish.

### Motion

One signature moment: **the handoff pulse**. When a user action changes a worker or an issue stage, the lamp pulses once and a thin signal line travels to the next stage. When an issue ships, the channel briefly reads “LINE CLEAR” and settles.

- The pulse is not a fake live feed. It fires only after a server action redirects back with `?pulse=<bugId>` (approve, reject, summon, new issue). Initial page loads are static.
- No constant blinking.
- `prefers-reduced-motion`: replace the travel with a static state change and a brief border emphasis; no transform.
- The board should feel alive at rest through data, not animation.

## Information architecture

### `/dashboard` — the Signal Board home

This replaces the current dashboard. It is the signed-in landing page.

Layout, desktop:
- **Header / signal rail** (global): brand, workspace, search, pending-decision count, new issue, notifications, account. Dark green, brass action, full-bleed background. The inner content aligns with the board edges. No points.
- **Left tower**: operations brief, automation gauge, workforce roster (all active agents in the tenant, capped at 4 in the tower, “View roster” for the rest).
- **Centre board**: “All issues” with view tabs and a scrollable list of channels.
- **Right queue**: decision queue, then signal log.
- **Bottom status strip**: line clear, working count, down count, automation percentage, last signal.

The board fills the viewport below the header. The centre list scrolls internally; the tower and queue stay fixed.

#### Operations brief

Replaces the old stat cards and all points UI:
- open issues
- auto-resolved this week (issues resolved by an agent claim)
- pending decisions
- automation coverage (%)
- high-priority issues
- a small “View workforce” link

No points, no weekly target, no rank, no leaderboard. The old points chart stays on the legacy `/workers` route only if that route is retained; it is not part of the new home.

#### All issues section

- Default view: all issues in the tenant, not deleted, sorted by votes, limit 25.
- Tabs: **All**, **Mine**, **Needs you**, **Running**, **Down**.
  - `All`: all issues in the tenant.
  - `Mine`: assigned to or reported by the current user.
  - `Needs you`: issues with a pending `IssueApproval` or an unanswered agent question.
  - `Running`: issues with an active claim / in-progress state.
  - `Down`: issues whose current worker is offline or whose claim heartbeat is stale.
- Each channel row: signal lamp, issue number, title, one-line current activity, worker tag, state text. The state text is mandatory; colour alone is not enough.
- “View full manifest” links to `/issues?status=all&project=all`.
- Empty states: no issues (calm board, “File the first signal”), no matches (clear filters), no agents (pair an agent).

#### Handoff chain

Each channel shows a three-step chain:

`Plan → Build → Verify`

- The active step is derived from the canonical signal stage (below).
- The current worker is the real assignee: the claiming agent, or the assigned person, or “unassigned.”
- Past steps are dim; future steps are outlined.
- If the issue has an active claim, the chain shows the agent name and level; if not, it shows the stage without inventing a worker.
- A future version can replace the stage chain with actual handoff history from `AgentEvent` / `BugActivity`. V1 does not fabricate history.

This is the visible answer to “connection between agents and bots”: planning agents, execution agents, and reviewers are stages in one chain, not separate product areas.

#### Workforce tower

- Loads all active agents in the tenant via the team directory, capped at four in the tower.
- Each worker row: lamp, name, role label (`agent` or `bot`), current work (`#12 · proposal ready`), and last-seen / offline text.
- Status mapping:
  - `working` → green
  - `waiting` → amber
  - `idle` → grey
  - `offline` → red
- The automation gauge is the percentage of open issues with an active agent claim vs total open issues. It is labelled “Automation” and shows the working/down counts.
- Down worker: red lamp, “lost signal · rerouting” if the issue has been reassigned; otherwise “offline · last seen 2h ago” and a link to `/settings/agents`.

#### Decision queue

- Shows pending `IssueApproval` rows for the tenant, newest first.
- Card content:
  - issue number and title
  - stage: before offer / before merge
  - rule reason: issue type, severity, file glob
  - what happens on approve / reject
  - Approve and Reject buttons
- Uses the existing `POST /api/v1/approvals/[id]/decision` endpoint and refreshes the board.
- If the viewer is not a workspace owner/admin, show “Waiting for an owner or admin” instead of buttons.
- Empty state: “No decisions waiting. The line is clear.”
- No “Hold” action. The API has approved/rejected; “Hold” would be a fake. Rejection in v1 stops that stage permanently; the copy must say so. If the product wants “reject and let the agent revise,” that is a backend change in `lib/approvals.ts` and a separate task.

#### Down recovery

- If an issue’s worker is offline, the channel shows:
  - `tester-09 lost signal`
  - `rerouted to tester-11` if a new claim exists
  - `offline · last seen 2h ago` if no new claim
- Recovery action links to the agent settings/reconnect page. There is no fake “wake” API.
- The board’s status strip counts down workers; it does not hide them.

#### Prevention layer

The enterprise promise includes preventing bugs before they happen. V1 has no prevention data source, so the board does not show a fake “prevented” number. The operations brief can include a small **Preflight** entry only when a real prevention source is connected (for example, a webhook or agent check table added later). Until then, the board shows auto-resolved, open issues, decisions, and coverage.

### `/issues` — full manifest

The existing full issues page stays, with all filters, bulk actions, search, pagination, and keyboard shortcuts. It gets the Signal Board skin:

- Header becomes the signal rail.
- The table keeps its density, but gains a lamp column, worker column, and state text.
- Rows use the same signal language and a compact handoff chain preview.
- Bulk selection stays; the action bar becomes a brass control strip.
- Empty/error states use the board’s language, not generic cards.
- The manifest is project-scoped by default; the home link explicitly opens `?project=all`.

This is the deep-work surface; the home is the overview.

### `/issues/[id]` — issue channel

The issue detail becomes a vertical signal track:

- Top: issue number, title, state lamp, vote, priority.
- Left/centre: a vertical track of six stages (`Report → Confirm → Plan → Build → Verify → Ship`) with the active stage lit.
- Handoff chain: current worker and adjacent stages.
- Decision bar: if a pending `IssueApproval` exists, show the same approve/reject card as the home.
- Description, comments, activity, PR links, and agent decisions keep their existing data and actions, restyled.
- The existing Agent Summon Pad stays and is restyled as a brass action. Its persistence gap is unchanged and tracked separately. Do not claim it creates a comment until a server action exists.

### `/workers` — relay roster

- The old ranking/team page becomes the full workforce roster.
- Each worker card: lamp, name, level, owner, current work, accepted fixes, last seen.
- Agents and execution-level agents (“bots”) share one roster; the role label is explicit.
- Points and ranking are removed from this surface. If the route is retained, it shows the roster only. A separate legacy leaderboard can remain for a transition period but is not linked from the signal world.

### `/issues/new` — file a signal

- Keep the existing form logic and validation.
- Restyle as a “File a signal” sheet: title, description, type, severity, platform, area.
- The submit action is a brass plate. The form uses ruled inputs, not pill fields.
- No new workflow.

### Login

- Restyle the existing split login as “Enter the signal room.”
- Left panel: a live-looking signal board vignette (static, labelled as illustrative) with the enterprise promise: “Your agents resolve the queue. You make the call.”
- Right panel: the same auth form, cream board, brass sign-in.
- Keep Google and password flows, error states, and focus behavior.

### Settings and secondary screens

- Inherit the global header, tokens, controls, and surface materials.
- No custom layout in v1 for admin, docs, feed, escalations, projects, notifications. They get the world through the design system and header.
- Settings/agents gets the relay-roster treatment because it is where recovery lives.

## Canonical signal stage

One pure mapping function drives the home chain, the detail track, the Running/Down tabs, and the counts. Do not let the home and detail invent separate stages.

```ts
export type SignalStage =
  | "report"   // open, not confirmed
  | "confirm"  // open, confirmed, not ready
  | "plan"     // open and ready for work
  | "build"    // in progress, active claim or assignee, no PR yet
  | "verify"   // in progress with PR, test verdict, or before_merge approval
  | "ship";    // resolved or closed

export function signalStageFor(input: {
  status: "open" | "in_progress" | "resolved" | "closed";
  intakeStage: "reported" | "confirmed" | "ready" | null;
  hasActiveClaim: boolean;
  hasAssignee: boolean;
  hasPullRequest: boolean;
  hasTestVerdict: boolean;
  hasPendingMergeApproval: boolean;
}): SignalStage
```

Mapping:
- `open` + `reported` → `report`
- `open` + `confirmed` → `confirm`
- `open` + `ready` → `plan`
- `in_progress` + no PR/verdict/merge approval → `build`
- `in_progress` + PR/verdict/merge approval → `verify`
- `resolved` / `closed` → `ship`

The home three-step chain collapses:
- `Plan` = `report` + `confirm` + `plan`
- `Build` = `build`
- `Verify` = `verify`
- `Ship` is a terminal badge, not a fourth chain step.

Special states:
- Rejected / duplicate / deleted issues show a terminal badge and a muted channel; they are not counted in Running.
- `offline` is a worker state, not an issue stage. It can coexist with `build` or `verify`.

Tests: unit-test the mapping for every combination and the tab counts.

## Data and loaders

Add `lib/signal-board.ts` (server-only):

```ts
export type SignalState = "working" | "waiting" | "idle" | "offline";

export type SignalChannel = {
  id: string;
  number: number;
  title: string;
  status: string;
  severity: string | null;
  voteCount: number;
  commentCount: number;
  worker: { id: string; name: string; kind: "agent" | "bot" | "person" } | null;
  stage: SignalStage;
  chainStage: "plan" | "build" | "verify";
  state: SignalState;
  activity: string | null;
  lastSignalAt: string | null;
  hasPendingApproval: boolean;
};

export type SignalDecision = {
  id: string;
  issueNumber: number;
  issueTitle: string;
  stage: "before_offer" | "before_merge";
  ruleReason: string | null;
  createdAt: string;
};

export type SignalWorkforce = {
  id: string;
  name: string;
  kind: "agent" | "bot";
  level: string;
  state: SignalState;
  currentWork: string | null;
  lastSeenAt: string | null;
};
```

Loaders:
- `loadSignalChannels({ tenantId, userId, view, limit })` — issue query with tenant filter, not deleted, view-specific where, order by votes/created, take 25. Join current claim + assignee + approval count + latest activity.
- `loadSignalDecisions({ tenantId })` — pending `IssueApproval` rows with issue and rule fields.
- `loadSignalWorkforce({ tenantId })` — active agents for the tenant via `teamAgentsForMembers`; map `online`/current work to `SignalState`. `kind` maps level: contributor/observer → `bot`; triager/reviewer/merger → `agent`. This is a presentation mapping, not a new entity.
- `loadSignalBrief({ tenantId })` — open issues, auto-resolved this week (agent claims released as resolved), pending decisions, automation coverage, high-priority count. No points.

Real data rules:
- Never invent a worker name. If no claim/assignee, show “unassigned.”
- Never invent a handoff history. The chain is a stage indicator; the worker is the current claim/assignee.
- Never invent a down recovery. If no new claim exists, say “offline” and link to settings.
- Never invent an approval. The queue is pending `IssueApproval` only.
- Never invent a prevented count. Show prevention only when a real source exists.
- “Last signal” is the latest relevant `BugActivity` or `AgentEvent` timestamp; if none, say “no signal yet.”
- Per-row activity: the latest `BugActivity.summary` for that issue, or the current worker + stage, or “no signal yet.”
- Signal log: latest four `BugActivity` items across the visible channels, with actor and timestamp. It is scoped to the board, not a second `/feed`.

## Routes and shell

- `/dashboard` becomes the Signal Board.
- `/issues` remains the full manifest.
- The logo goes to `/dashboard`; the Product nav item goes to `/issues`.
- The post-login redirect stays `/dashboard`.
- Add a full-bleed shell for the board:
  - Refactor the current `app/(app)/layout.tsx` data loading into a shared `AppShell` server component with a `fullBleed` prop.
  - Create a `(board)` route group (URL unchanged) whose layout calls `AppShell fullBleed`.
  - Move `dashboard/page.tsx` into the board group.
  - Normal pages keep the `max-w-6xl` container.
- The global header becomes the signal rail. It keeps all existing menus, notifications, workspace switcher, agents, theme, and account actions. Remove the points pill; add a pending-decision counter.
- The board is tenant-wide. Add a project selector in the board header; default “All projects.” The manifest link preserves `project=all`.

## Responsive

- Desktop ≥1280px: tower / board / queue three-column; board fills the viewport below the header.
- Tablet 768–1279px: tower collapses to a horizontal workforce strip above the board; queue moves below the board or into a right drawer.
- Mobile <768px: one column. A sticky segmented control switches **Issues / Workforce / Decisions**. The operations brief is a compact strip under the header. The bottom nav stays.
- The full manifest table becomes horizontally scrollable with a frozen issue column; do not hide data.
- No text below 11px; tap targets ≥40px.

## Accessibility

- Signal state is always text + lamp, never colour alone.
- Lamps are `aria-hidden`; the state text is the accessible label.
- The board is a region with an accessible name.
- Tabs use links with `aria-current`; the active view is announced.
- The decision buttons have clear labels and busy/error states.
- Focus rings use brass on dark and deep green on cream, with 2px offset.
- Skip link and route-change focus stay.
- `prefers-reduced-motion` removes the handoff travel and pulse; state changes are instant.
- Contrast: body and metadata ≥4.5:1, large text ≥3:1. Brass on cream is for large labels only, never body text.
- Keyboard: `j/k` move channels, `a` approves the focused decision, `r` rejects with confirmation, `/` focuses search, `?` opens shortcuts. Do not override browser or existing shortcuts.

## Implementation phases

### Phase 1 — the home
- Add `lib/signal-board.ts` loaders, `signalStageFor`, and tests.
- Build `SignalBoard`, `OperationsBrief`, `WorkforceTower`, `ChannelList`, `DecisionQueue`, `SignalStatus`.
- Refactor the shell for full-bleed and move the dashboard into the board group.
- Restyle the global header as the signal rail; remove points from the header.
- Replace the dashboard page.
- Add empty/loading/error states.
- Verify desktop, tablet, mobile, dark mode, reduced motion, keyboard.

### Phase 2 — the deep surfaces
- Restyle `/issues` as the manifest, preserving all logic.
- Restyle `/issues/[id]` as the issue channel with the six-stage track, handoff chain, and decision bar.
- Restyle `/workers` as the relay roster; remove points/ranking from the surface.
- Restyle `/issues/new` as the signal form.
- Restyle login.
- Restyle the Agent Summon Pad.

### Phase 3 — polish
- Add the handoff pulse and line-clear moment, triggered by `?pulse=<bugId>` only.
- Add the signal-log microcopy and last-signal timestamps.
- Add the dark board variant.
- Run the design detector, contrast checks, keyboard pass, and a final visual review.
- Write DESIGN.md from the built world.

## Acceptance criteria

- A signed-in user lands on `/dashboard` and sees the Signal Board, not the old dashboard.
- No points, weekly target, ranking, or leaderboard appears on the home, header, or workforce surface.
- The centre lists all issues with working tabs; “View full manifest” reaches `/issues?status=all&project=all`.
- Every channel shows a real worker or “unassigned,” a stage chain, and a text state.
- The decision queue shows pending `IssueApproval` rows with approve/reject and refreshes after a decision.
- Rejection copy is honest: it stops that stage; it does not promise an automatic retry.
- An offline worker is visibly red, labelled, and links to recovery; no fake wake action.
- The full issues page still filters, searches, paginates, votes, and bulk-edits.
- The issue detail still comments, votes, links PRs, and shows activity; the new decision bar works.
- Login, new issue, workers, and settings inherit the world.
- WCAG AA, skip link, focus management, reduced motion, and ≥40px targets pass.
- Dark mode is a real variant, not an inverted afterthought.
- No field-guide CSS, Fraunces, paper grain, or stamp language remains on the redesigned surfaces.

## Decisions made here

- “Bot” = an execution-level agent. No new entity.
- The home is `/dashboard`; the full manifest is `/issues`.
- The board is tenant-wide by default; the project selector can narrow it.
- The board uses the existing `IssueApproval` mechanism; no new approval model.
- Rejection is terminal in v1; “reject and revise” is a separate backend task.
- Recovery links to agent settings; no wake API in v1.
- The board is a server-rendered snapshot; live streaming is a follow-up.
- The handoff pulse fires only after an action redirect, not on initial load.
- The workforce tower shows all active agents in the tenant, capped at four.
- The full manifest keeps table density; it gains lamps, workers, and brass controls.
- The Agent Summon Pad stays and is restyled; its persistence gap is unchanged.
- Points/ranking are removed from the new home, header, and workforce surface. Legacy routes may remain but are unlinked.
- Prevention is a product direction, not a v1 metric; no fake prevented count.
