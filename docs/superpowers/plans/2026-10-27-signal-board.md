# Signal Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the signed-in dashboard with an enterprise Signal Board that shows the full issue line, the agent/bot workforce, real approval decisions, and the automation operation — with no points or ranking.

**Architecture:** One new server-only domain module (`lib/signal-board.ts`) owns the stage mapping and board loaders. A full-bleed `AppShell` hosts the board at `/dashboard`; the existing `/issues` manifest and `/issues/[id]` detail keep their logic but adopt the signal language. The home is tenant-wide with a project selector; the manifest stays project-scoped and is linked with `project=all`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma, Auth.js v5, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-signal-board-design.md`

## Global Constraints

- No points, weekly target, ranking, or leaderboard on `/dashboard`, the header, or `/workers`.
- “Bot” is a presentation label for an execution-level `Agent`; do not add a bot model.
- The home is tenant-wide by default. The manifest link is `/issues?status=all&project=all`.
- The workforce tower shows all active agents in the tenant, capped at four.
- The decision queue uses real pending `IssueApproval` rows. Rejection is terminal in v1; do not promise an automatic retry.
- No fake “wake bot” action. Recovery links to `/settings/agents`.
- No fake “prevented” count. Prevention is a product direction, not a v1 metric.
- The handoff pulse fires only after an action redirect with `?pulse=<bugId>`; initial loads are static.
- Signal state is always text + lamp, never colour alone.
- Production type is never below 11px for essential data.
- Preserve skip link, focus management, `prefers-reduced-motion`, WCAG AA, and ≥40px targets.
- Use `pnpm exec tsc --noEmit` and `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' <paths>` for verification.

## Review Focus

1. **Tenant vs project scope.** The board is tenant-wide and the manifest is project-scoped; the link and tab counts must not disagree. Test: Task 6 asserts `project=all` in the manifest link; Task 7 asserts the manifest still honors its own project filter.
2. **Stage contradictions.** The home three-step chain and the detail six-step track must derive from one mapping. Test: Task 1 covers every `signalStageFor` combination and the collapse; Task 8 asserts the detail uses the same function.
3. **Approval rejection copy.** A rejected `IssueApproval` is terminal in v1. Test: Task 5 asserts the reject confirmation copy says the stage stops; no test may claim a retry.
4. **Offline worker with no reroute.** The UI must not invent a replacement. Test: Task 5 renders “offline · last seen …” and a settings link when `worker.state === "offline"` and no new claim exists.
5. **Dark mode and reduced motion.** Lamps, brass labels, and the pulse must survive both themes and reduced motion. Test: Task 10 asserts the pulse class is absent under reduced motion; Task 11 captures both themes.

---

### Task 1: Signal domain model and stage mapping

**Files:**
- Create: `lib/signal-board.ts`
- Test: `lib/signal-board.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SignalStage`, `SignalState`, `SignalView`, `SignalChannel`, `SignalDecision`, `SignalWorkforce`, `OperationsBrief`, `signalStageFor`, `chainStageFor`, `workerStateFor`, `parseSignalView`.

- [ ] **Step 1: Write failing tests for the stage mapping**

```ts
import { describe, expect, it } from "vitest";
import { chainStageFor, parseSignalView, signalStageFor, workerStateFor } from "./signal-board";

describe("signalStageFor", () => {
  it("maps open intake stages", () => {
    expect(signalStageFor({ status: "open", intakeStage: "reported", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("report");
    expect(signalStageFor({ status: "open", intakeStage: "confirmed", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("confirm");
    expect(signalStageFor({ status: "open", intakeStage: "ready", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("plan");
  });
  it("maps build and verify", () => {
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("build");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: true, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("verify");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: true, hasPendingMergeApproval: false })).toBe("verify");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: true })).toBe("verify");
  });
  it("maps ship and collapses the chain", () => {
    expect(signalStageFor({ status: "resolved", intakeStage: null, hasActiveClaim: false, hasAssignee: false, hasPullRequest: true, hasTestVerdict: true, hasPendingMergeApproval: false })).toBe("ship");
    expect(chainStageFor("report")).toBe("plan");
    expect(chainStageFor("confirm")).toBe("plan");
    expect(chainStageFor("plan")).toBe("plan");
    expect(chainStageFor("build")).toBe("build");
    expect(chainStageFor("verify")).toBe("verify");
    expect(chainStageFor("ship")).toBe("verify");
  });
  it("maps worker states and view params", () => {
    expect(workerStateFor({ online: true, waiting: false, activeClaim: true })).toBe("working");
    expect(workerStateFor({ online: true, waiting: true, activeClaim: false })).toBe("waiting");
    expect(workerStateFor({ online: true, waiting: false, activeClaim: false })).toBe("idle");
    expect(workerStateFor({ online: false, waiting: false, activeClaim: false })).toBe("offline");
    expect(parseSignalView("mine")).toBe("mine");
    expect(parseSignalView("nope")).toBe("all");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' lib/signal-board.test.ts`
Expected: FAIL with “Cannot find module './signal-board'”.

- [ ] **Step 3: Implement the types and pure functions**

Add the exact types from the spec and the mapping from the spec’s “Canonical signal stage” section. `chainStageFor` collapses `report|confirm|plan → plan`, `build → build`, `verify|ship → verify`. `workerStateFor` uses `waiting` before `working`, `working` before `idle`, and `offline` last. `parseSignalView` returns `all` for unknown values.

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' lib/signal-board.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/signal-board.ts lib/signal-board.test.ts
git commit -m "feat(signal): add signal stage model"
```

---

### Task 2: Signal board loaders

**Files:**
- Modify: `lib/signal-board.ts`
- Test: `lib/signal-board.test.ts`

**Interfaces:**
- Consumes: `signalStageFor`, `chainStageFor`, `workerStateFor`; `prisma`; `bugInTenant`; `openIssueStages`; `teamAgentsForMembers`.
- Produces: `loadSignalChannels`, `loadSignalDecisions`, `loadSignalWorkforce`, `loadSignalBrief`.

- [ ] **Step 1: Write failing loader tests**

Mock `@/lib/prisma` with two bugs: one `open`/`ready`, one `in_progress` with a claim and `pullRequestUrl`. Mock `@/lib/issue-stage` `openIssueStages` to return `ready` for the first. Mock `@/lib/team-directory` `teamAgentsForMembers` to return one online agent. Mock `prisma.issueApproval.findMany` to return one pending approval. Assert:
- `loadSignalChannels` returns two channels, sorted by votes, with stages `plan` and `verify`.
- The in-progress channel has the claiming agent as `worker` and `state: "working"`.
- `loadSignalDecisions` returns the approval with a rule reason.
- `loadSignalWorkforce` returns one `SignalWorkforce` with `kind: "agent"` or `"bot"` from the level mapping.
- `loadSignalBrief` returns `openIssues`, `autoResolved`, `pendingDecisions`, `automationPct`, `highPriority` and no points field.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' lib/signal-board.test.ts`
Expected: FAIL with “loadSignalChannels is not a function”.

- [ ] **Step 3: Implement the loaders**

Use `prisma.bug.findMany` with `{ ...bugInTenant(tenantId), isDeleted: false }`, the view where, `orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }]`, `take: 25`, and include `claims` (active), `assignee`, `type`, `_count.comments`, and the latest `activities` row. Use `openIssueStages` for intake. Use `prisma.issueApproval.findMany` with `status: "pending"` and include `bug`, `rule.issueType`. Use `teamAgentsForMembers` with the tenant’s member ids. Compute the brief with `prisma.bug.count` and `prisma.issueClaim.count` (auto-resolved = released claims with `releaseReason: "resolved"` in the last 7 days). Do not add a points field.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' lib/signal-board.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/signal-board.ts lib/signal-board.test.ts
git commit -m "feat(signal): load board channels, decisions, workforce, brief"
```

---

### Task 3: Full-bleed app shell

**Files:**
- Create: `components/app-shell.tsx`
- Create: `components/app-shell-classes.ts`
- Modify: `app/(app)/layout.tsx`
- Create: `app/(board)/layout.tsx`
- Move: `app/(app)/dashboard/page.tsx` → `app/(board)/dashboard/page.tsx`
- Test: `components/app-shell-classes.test.ts`

**Interfaces:**
- Consumes: existing layout data loaders.
- Produces: `AppShell({ children, fullBleed }: { children: React.ReactNode; fullBleed?: boolean })`; `shellMainClass(fullBleed: boolean): string`.

- [ ] **Step 1: Write the failing class test**

```ts
import { expect, it } from "vitest";
import { shellMainClass } from "./app-shell-classes";
import { PAGE_CONTAINER_CLASS } from "./page-container";

it("keeps the page container on normal pages", () => {
  expect(shellMainClass(false)).toContain(PAGE_CONTAINER_CLASS);
});
it("removes the max width and padding on the board", () => {
  const cls = shellMainClass(true);
  expect(cls).toContain("max-w-none");
  expect(cls).toContain("p-0");
  expect(cls).not.toContain("max-w-6xl");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/app-shell-classes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `AppShell` and the route group**

Move the existing `AppLayout` body into `AppShell`. `AppShell` renders the skip link, header, and `<main id={MAIN_CONTENT_ID}>` with `shellMainClass(fullBleed)`. `app/(app)/layout.tsx` returns `<AppShell>{children}</AppShell>`. `app/(board)/layout.tsx` returns `<AppShell fullBleed>{children}</AppShell>`. Move `dashboard/page.tsx` to `app/(board)/dashboard/page.tsx`; the URL stays `/dashboard`.

- [ ] **Step 4: Run typecheck and the class test**

Run: `pnpm exec tsc --noEmit`
Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/app-shell-classes.test.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add components/app-shell.tsx components/app-shell-classes.ts components/app-shell-classes.test.ts app/'(app)'/layout.tsx app/'(board)'/layout.tsx app/'(board)'/dashboard/page.tsx
git commit -m "feat(shell): add full-bleed board shell"
```

---

### Task 4: Signal rail header

**Files:**
- Modify: `components/app-header.tsx`
- Modify: `components/app-header.dom.test.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/theme-brand.css`

**Interfaces:**
- Consumes: existing header props minus points.
- Produces: `pendingDecisions: number` prop; no `points`, `solvedTasks`, or `targetPoints` props.

- [ ] **Step 1: Update the header test first**

Replace the points assertion with:
```ts
expect(screen.queryByText(/pts/i)).toBeNull();
expect(screen.getByText("3 decisions")).toBeInTheDocument();
```
Keep the existing nav, account, notifications, and agents assertions.

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/app-header.dom.test.tsx`
Expected: FAIL on the points assertion.

- [ ] **Step 3: Remove the points pill and restyle the rail**

Remove the points link and `formatPoints`/`pointsProgress` imports. Add `pendingDecisions` to `AppHeader` props and render a brass `3 decisions` link to `/dashboard?view=needs`. Apply the shell/brass tokens: dark green background, cream text, brass action, 2–4px radii. Keep every menu, focus behavior, mobile tab strip, and account action. Update the layout to load pending decisions with the existing `countPendingEscalations` or a new `prisma.issueApproval.count` and pass it.

- [ ] **Step 4: Run the test and typecheck**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/app-header.dom.test.tsx`
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/app-header.tsx components/app-header.dom.test.tsx app/'(app)'/layout.tsx app/globals.css app/theme-brand.css
git commit -m "feat(header): signal rail, remove points"
```

---

### Task 5: Signal Board components

**Files:**
- Create: `components/signal-board/signal-board.tsx`
- Create: `components/signal-board/operations-brief.tsx`
- Create: `components/signal-board/workforce-tower.tsx`
- Create: `components/signal-board/channel-list.tsx`
- Create: `components/signal-board/decision-queue.tsx`
- Create: `components/signal-board/signal-status.tsx`
- Create: `components/signal-board/signal-board.css`
- Test: `components/signal-board/signal-board.test.tsx`
- Test: `components/signal-board/decision-queue.dom.test.tsx`

**Interfaces:**
- Consumes: `SignalChannel`, `SignalDecision`, `SignalWorkforce`, `OperationsBrief`.
- Produces: `SignalBoard({ brief, channels, decisions, workforce, canDecide, pulseId, view })`.

- [ ] **Step 1: Write failing render tests**

Render `SignalBoard` with one channel, one decision, one offline worker, and a brief. Assert:
- “All issues” and the channel title render.
- “3 decisions” or the decision count renders.
- The offline worker renders “offline” and a link to `/settings/agents`.
- No text matching `/pts|points|ranking|leaderboard/i` renders.
- The manifest link is `/issues?status=all&project=all`.

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-board/signal-board.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the server components and CSS**

Build the three-column grid: tower, board, queue. Use the spec’s palette and type tokens. Render lamps with `aria-hidden` and state text. Render the operations brief with open issues, auto-resolved, decisions, coverage, high-priority. Render the channel list with the three-step chain. Render the decision queue as a client component; approve/reject POST to `${BASE_PATH}/api/v1/approvals/${id}/decision`, then `router.refresh()`. The reject confirmation copy must say “This stops the stage. The agent will not retry automatically.”

- [ ] **Step 4: Run the tests and typecheck**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-board/signal-board.test.tsx components/signal-board/decision-queue.dom.test.tsx`
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/signal-board
git commit -m "feat(signal): add board home components"
```

---

### Task 6: Replace the dashboard page

**Files:**
- Modify: `app/(board)/dashboard/page.tsx`
- Create: `app/(board)/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `loadSignalBrief`, `loadSignalChannels`, `loadSignalDecisions`, `loadSignalWorkforce`, `parseSignalView`.
- Produces: the `/dashboard` page.

- [ ] **Step 1: Write the failing page test**

Mock the four loaders and `requireUser`/`currentTenantIdFor`. Render the page with `searchParams: Promise.resolve({ view: "needs" })`. Assert:
- `loadSignalChannels` is called with `view: "needs"`.
- `SignalBoard` receives the four data props.
- The manifest link contains `status=all&project=all`.

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' 'app/(board)/dashboard/page.test.tsx'`
Expected: FAIL.

- [ ] **Step 3: Implement the page**

Load the user and tenant, then call the four loaders in `Promise.all` with per-loader `try/catch` so one failure does not take down the board. Parse `view` and `project` from `searchParams`. Determine `canDecide` from the tenant membership role (owner/admin). Pass `pulse` from `searchParams`. Render `SignalBoard`. Keep the old dashboard components out of this page.

- [ ] **Step 4: Run the page test and typecheck**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' 'app/(board)/dashboard/page.test.tsx'`
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/'(board)'/dashboard/page.tsx app/'(board)'/dashboard/page.test.tsx
git commit -m "feat(signal): make the signal board the home"
```

---

### Task 7: Issues manifest signal skin

**Files:**
- Modify: `app/(app)/issues/(list)/page.tsx`
- Modify: `app/(app)/issues/(list)/issues.css`
- Create: `components/signal-lamp.tsx`
- Test: `components/signal-lamp.dom.test.tsx`
- Test: `app/(app)/issues/(list)/page.test.ts`

**Interfaces:**
- Consumes: `SignalState`; existing bug query data.
- Produces: `SignalLamp({ state, label }: { state: SignalState; label?: string })`.

- [ ] **Step 1: Write the failing lamp test**

```tsx
render(<SignalLamp state="working" />);
expect(screen.getByText("working")).toBeInTheDocument();
render(<SignalLamp state="offline" />);
expect(screen.getByText("offline")).toBeInTheDocument();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-lamp.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the lamp and manifest changes**

Add a lamp column at the start of each row, a worker column using the claim/assignee, and the state text beside the lamp on mobile. Keep votes, title, status, priority, selection, pagination, search, and all filters. Apply the signal CSS: enamel rows, brass controls, thin rules, no pill soup. Do not change the query logic or the project filter.

- [ ] **Step 4: Run the tests**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-lamp.dom.test.tsx 'app/(app)/issues/(list)/page.test.ts'`
Run: `pnpm exec tsc --noEmit`
Expected: PASS (existing 6 page tests + lamp test).

- [ ] **Step 5: Commit**

```bash
git add app/'(app)'/issues/'(list)'/page.tsx app/'(app)'/issues/'(list)'/issues.css components/signal-lamp.tsx components/signal-lamp.dom.test.tsx
git commit -m "feat(issues): signal manifest skin"
```

---

### Task 8: Issue detail signal channel

**Files:**
- Modify: `app/(app)/issues/[id]/page.tsx`
- Modify: `app/(app)/issues/[id]/issue-detail.css`
- Create: `components/signal-stage-track.tsx`
- Create: `components/signal-handoff-chain.tsx`
- Modify: `components/issue-approval-banner.tsx`
- Modify: `components/agent-summon-pad.tsx`
- Test: `components/signal-stage-track.dom.test.tsx`
- Test: `components/signal-handoff-chain.dom.test.tsx`

**Interfaces:**
- Consumes: `SignalStage`, `chainStageFor`.
- Produces: `SignalStageTrack({ stage }: { stage: SignalStage })`; `SignalHandoffChain({ channel }: { channel: Pick<SignalChannel, "stage" | "worker" | "state"> })`.

- [ ] **Step 1: Write the failing component tests**

Assert:
- `SignalStageTrack` renders all six labels and marks the active stage with `aria-current="step"`.
- `SignalHandoffChain` renders `Plan → Build → Verify`, the worker name when present, and “unassigned” when absent.

- [ ] **Step 2: Run them to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-stage-track.dom.test.tsx components/signal-handoff-chain.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the components and restyle the detail page**

Derive the stage from `signalStageFor` using the real bug fields. Place the six-stage track near the title. Place the handoff chain beside the assignee/claim. Restyle `IssueApprovalBanner` as the brass decision bar; keep its API calls. Restyle `AgentSummonPad` as a brass action; keep the modal behavior and the documented persistence gap. Keep comments, votes, PR links, activity, and keyboard behavior.

- [ ] **Step 4: Run the tests**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-stage-track.dom.test.tsx components/signal-handoff-chain.dom.test.tsx`
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/'(app)'/issues/'[id]'/page.tsx app/'(app)'/issues/'[id]'/issue-detail.css components/signal-stage-track.tsx components/signal-handoff-chain.tsx components/issue-approval-banner.tsx components/agent-summon-pad.tsx
git commit -m "feat(issue): signal channel detail"
```

---

### Task 9: Workforce roster

**Files:**
- Modify: `app/(app)/workers/page.tsx`
- Create: `components/workforce-roster.tsx`
- Modify: `app/(app)/workers/team.css`
- Test: `components/workforce-roster.dom.test.tsx`

**Interfaces:**
- Consumes: `SignalWorkforce[]`.
- Produces: `WorkforceRoster({ workers }: { workers: SignalWorkforce[] })`.

- [ ] **Step 1: Write the failing roster test**

Assert the roster renders worker name, role label, current work, state text, and no points/ranking text. Assert an offline worker links to `/settings/agents`.

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/workforce-roster.dom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the roster and replace the ranking panel on `/workers`**

Use `loadSignalWorkforce` for the data. Render the roster grid. Remove the points/ranking panel from the page. Keep the route and any team links that still make sense. Apply the signal materials and lamps.

- [ ] **Step 4: Run the test and typecheck**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/workforce-roster.dom.test.tsx`
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/'(app)'/workers/page.tsx components/workforce-roster.tsx app/'(app)'/workers/team.css
git commit -m "feat(workforce): relay roster, remove ranking"
```

---

### Task 10: New issue and login surfaces

**Files:**
- Modify: `app/(app)/issues/new/page.tsx`
- Modify: `app/(auth)/login/auth-split-frame.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/login/login.dom.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing form and auth logic.
- Produces: no new public interface.

- [ ] **Step 1: Add the login regression test**

Assert the login form still renders email/password, Google when configured, and the submit action. Do not assert the old visual copy.

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' app/(auth)/login/login.dom.test.tsx`
Expected: FAIL only on the new assertions.

- [ ] **Step 3: Restyle both surfaces**

Replace the login left panel with a static signal-board vignette labelled “Illustrative.” Keep the form and auth logic unchanged. Restyle the new-issue form as “File a signal” with brass submit and ruled inputs. Do not change validation or actions.

- [ ] **Step 4: Run the login test and typecheck**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' app/(auth)/login/login.dom.test.tsx`
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/'(app)'/issues/new/page.tsx app/'(auth)'/login/auth-split-frame.tsx app/'(auth)'/login/page.tsx app/'(auth)'/login/login.dom.test.tsx app/globals.css
git commit -m "feat(signal): new issue and login surfaces"
```

---

### Task 11: Dark board, motion, and finish review

**Files:**
- Modify: `app/theme-brand.css`
- Modify: `app/theme-dark.css`
- Modify: `components/signal-board/signal-board.css`
- Create: `DESIGN.md`
- Create: `.impeccable/design.json` if the documenter produces tokens
- Modify: `handoff/STATUS.md`, `handoff/DECISIONS.md`, `handoff/RUNBOOK.md`

**Interfaces:**
- Consumes: the built board.
- Produces: dark tokens, pulse motion, final documentation.

- [ ] **Step 1: Write the reduced-motion pulse test**

Add a DOM test or CSS assertion that the pulse class is applied only when `pulseId` is present and that `prefers-reduced-motion` removes the travel. If a DOM test is impractical, add a small pure helper `pulseClassFor(pulseId, reducedMotion)` and test it.

- [ ] **Step 2: Run it to verify it fails**

Run the focused test.
Expected: FAIL.

- [ ] **Step 3: Implement the dark tokens and pulse**

Add the dark board tokens from the spec. Add the handoff pulse and line-clear animation, gated by `pulseId` and `prefers-reduced-motion`. Do not add constant animation.

- [ ] **Step 4: Run the full verification**

Run:
- `pnpm exec tsc --noEmit`
- `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --exclude '.worktrees/**' components/signal-board components/signal-lamp.dom.test.tsx components/signal-stage-track.dom.test.tsx components/signal-handoff-chain.dom.test.tsx components/workforce-roster.dom.test.tsx 'app/(board)/dashboard/page.test.tsx' 'app/(app)/issues/(list)/page.test.ts'`
- `pnpm build` (if the environment has the required env vars)
- The Impeccable detector on the changed UI files.

- [ ] **Step 5: Capture screenshots and write DESIGN.md**

Capture desktop 1440 and mobile 390 in light and dark into `.impeccable/review/`. Run the finish review. Write `DESIGN.md` from the built world. Update the handoff files with the new status and deploy notes. Commit.

```bash
git add DESIGN.md .impeccable handoff
git commit -m "docs(signal): finish signal board design and handoff"
```

---

## Self-Review

- **Spec coverage:** Intent, goals, non-goals, enterprise positioning, no points, full-bleed home, all-issues tabs, handoff chain, decision queue, down recovery, full manifest, detail, workforce, login, new issue, dark mode, reduced motion, and accessibility each map to a task.
- **Type consistency:** `SignalStage`, `SignalState`, `SignalView`, `SignalChannel`, `SignalDecision`, `SignalWorkforce`, and `OperationsBrief` are defined in Task 1 and consumed by name in Tasks 2–9. `signalStageFor`, `chainStageFor`, `workerStateFor`, `parseSignalView`, `loadSignalChannels`, `loadSignalDecisions`, `loadSignalWorkforce`, and `loadSignalBrief` are defined before use.
- **Review Focus tests:** Tenant/project scope in Tasks 6–7; stage consistency in Tasks 1 and 8; rejection copy in Task 5; offline recovery in Tasks 5 and 9; dark/reduced-motion in Task 10.
- **No placeholders:** Every task names files, interfaces, test behavior, commands, and a commit.
