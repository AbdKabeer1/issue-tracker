# ENDOR-579 evidence

Issue: https://ziki.dev/issues/579

Contributor: Ukiwa Henry · Team Yoda · Zedu username henryuks.

- `issue-report.jpg`: genuine screenshot of the signed-in production issue report, captured 22 October 2026. It documents the issue and assignment; it does not demonstrate a deployed fix.
- `regression-results.jpg`: genuine browser screenshot of `regression-evidence.html`, which displays excerpts from actual Vitest runs.
- `before-test-excerpt.txt`: six #579 cases fail against original `validation.ts` from base `06df868` with the new test file. Other cases were skipped deliberately for this red check.
- `after-test-excerpt.txt`: all 48 validation tests pass against the changed source.

The regression tests use mocked Prisma fixtures. They model later claim/assignment relationships, including bid beneficiaries and dispatchers, and verify `isConfirmed` remains true. They also verify a conflict arising between preflight and the transactional write is rejected. They do not execute a live browser award or prove production deployment.

The report records the runtime and SHA-256 of the tested source. Baseline harness and complete raw logs are saved locally under `/private/tmp/579-red-green` and `/private/tmp/579-*.log`; only concise output excerpts are committed.

## Reproduce

Use Node 22 and pnpm 10.14.0, prepare the existing dependencies and generated Prisma client, then run:

```sh
pnpm exec vitest run lib/agent-api/validation.test.ts --reporter=verbose
pnpm check
```

The captured red/green runs use Node 22.13.1 and pnpm 10.14.0. Node 22 was located at `/Users/henryuks/Library/Caches/ms-playwright-go/1.50.1/node`; it was selected through the process PATH, without changing project configuration.

## Review provenance

Ruflo MCP initialized swarm `swarm-1792707439285-h0pbjv` and registered `endor579-reviewer` and `endor579-tester`. Its response explicitly says registration requires an external worker to execute the task. Codex collaboration workers performed the independent review and regression-test additions; no Ruflo-hosted model execution is claimed. An attempt to execute the registered reviewer role through the installed Claude CLI (tools disabled, scoped diff only) returned HTTP 401: OAuth access token revoked; no Claude verdict was produced. Review identified an award/submission race, which was fixed by repeating independence checks after the shared issue row lock. A second independent review found no blocking issue.

Code Review MCP's exposed review schemas require an existing PR identity. Its review remains deferred until the user pushes and a PR exists. No push, PR creation, issue update, merge, or deployment was performed.

Historical records continue to rely on existing submission-time independence enforcement; this change does not reconstruct past claim snapshots or repair independently corrupted data. Report-side independence, revision invalidation, undone audits and distinct-owner quorum still apply.

## Final required checks

Passed under Node 22.13.1 / pnpm 10.14.0:

```sh
PATH="/Users/henryuks/Library/Caches/ms-playwright-go/1.50.1:$PATH" VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 pnpm check
```

ESLint and TypeScript passed; Vitest passed 439 files and 4,389 tests (330.74 seconds for the test phase). Worker counts were limited through environment variables; no checked-in timeout or test configuration was changed. Earlier Node 24 full-suite attempts had form-test timeouts; the final supported-runtime aggregate check passed without increasing the default timeout.

Local preparation regenerated Prisma Client and current Next.js route types. A stale generated `.next/dev/types` tree referring to an obsolete catch-all route was moved to a temporary backup. No database migration, seeding, or reset was run. Build and live database/browser award tests were not run.

## PR review follow-up (23 October 2026)

PR [#1293](https://github.com/Zedu-Endor/issue-tracker/pull/1293) was created after the user manually pushed `23b023e`, and linked to Ziki #579 with a structured delivery comment. All GitHub CI jobs passed for that published commit after one Playwright retry; the initial failed Playwright build had a transient Next.js Google font-loader error before browser tests started.

Code Review MCP diagnostics succeeded. Private review run `80dfae17-a983-4753-8c8f-0f87f1ff3285` failed with an account/session error and produced no verdict. This is separate from the completed independent Codex reviews and the CodeRabbit review.

Two CodeRabbit findings were reproduced and addressed locally:

- [Standing awards](https://github.com/Zedu-Endor/issue-tracker/pull/1293#discussion_r4354359627): recomputation now uses the same recorded-review view as confirmation, preserving standing triage/duplicate awards after later claims or assignment.
- [Deletion race](https://github.com/Zedu-Endor/issue-tracker/pull/1293#discussion_r4354359633): the locked reload selects `isDeleted`; deleted or missing issues return 404 before validation, point, or event writes.

Seven new test cases cover these changes and missing-row/reporter-conflict controls. Before the fixes, 4 targeted cases failed and 76 passed; afterward all 80 targeted cases passed under Node 22.13.1. An independent Codex reviewer found no blocking issue in the follow-up diff.

The screenshots above document the initial fix at `23b023e`; they were not regenerated to imply the follow-up was deployed. Review threads remain open until remote verification completes. The follow-up is pushed manually on its feature branch; no automatic merge or resolution is performed.

Before merging latest main, the follow-up required gate passed under Node 22.13.1 / pnpm 10.14.0: lint, typecheck, 439 test files and 4,396 tests. Test phase: 195.22 seconds. See `review-followup-checks.txt` for those historical output excerpts.

## Previous latest-main verification (40e761a, superseded)

This section records the older `40e761a` base and is not evidence for the current branch state.

Merged fetched `origin/main` at `40e761a30d530e7bb61d2aeaa74abf4ca766811c` into local merge commit `800378e2ca7c6e827ecff2c2fd783a8a016b8c7b`, then restored the scoped review follow-up without staging it. The branch is zero commits behind that main revision. Upstream configurable reward logic and its tests were preserved.

Under Node 22.13.1, the focused validation, backfill and platform-reward tests pass (85/85). The aggregate `pnpm check` is blocked by upstream lint errors in `create-agent-form.tsx` and `display-name-form.tsx`. A separate typecheck, after refreshing generated route types, fails on the missing `ViewerProps` type and related implicit-any errors in `comment-thread.tsx`. The full suite reports 439 passing files and two failing files: 4,432 passing tests and two failing tests, in `issue-filters.test.ts` (search placeholder) and `page-container.test.ts` (description width class).

The affected UI source and test files match fetched `origin/main` exactly; no unrelated repairs were included. Earlier passing aggregate results do not verify this merged base. The review follow-up remained unstaged and uncommitted at that time.

## Integrated latest main (e33ba53a, 23 October 2026)

Fetched `origin/main` at `e33ba53a99cfcecd29b77734bb38e27d68e86c9e` and merged it normally into the feature branch as `832973d48b907fa4c4ebe4524fa80ad8ae04022f` (parents `800378e2` and `e33ba53a`); `origin/main` is an ancestor of the branch. The scoped follow-up was restored from recovery stash `ENDOR-579 follow-up before merging origin/main e33ba53a (2026-10-23)` without touching the older backup stash. Upstream #493 stale-revision replacement behavior and configurable reward logic are preserved.

PR [#1311](https://github.com/Zedu-Endor/issue-tracker/pull/1311) (`feat/ziki-redesign`) is still **OPEN** (`mergedAt` null) and its head `f3bb1f4c` is not an ancestor of main. The earlier failures were fixed on main by PR #1321 (`fix/ENDOR-640-main-green`, commit `b5b678e6`), not by #1311: `setLevel` is derived during render, `setJustSaved` is cleared in the action callback, and `ViewerProps` is restored in `comment-thread.tsx`.

Verification on detached main `e33ba53a` under Node 22.23.4 / pnpm 10.14.0 with a frozen lockfile: lint passed, typecheck passed, `components/issue-filters.test.ts` passed 12/12, `components/page-container.test.ts` passed 4/4, and `pnpm check` passed 441 files / 4,437 tests (214.12 seconds test phase).

Verification on the integrated branch under Node 22.23.4 / pnpm 10.14.0: focused `lib/agent-api/validation.test.ts` plus `lib/points/backfill.test.ts` passed 85/85; platform/project reward tests passed 6/6; and `VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 pnpm check` passed 441 files / 4,448 tests (231.18 seconds test phase, rerun after the final credited-person guard). `pnpm build` also passed (190 seconds), and the standalone `packages/mcp-server` install/typecheck/test/build passed 207/207 tests. See `review-followup-checks.txt` for the captured output and the historical pre-integration run.

An independent read-only subagent review of the integrated diff returned **PASS** with no blocking findings. It raised three low-severity items: standing duplicate/triager awards did not recheck the credited person; severity comparison used the pre-lock issue snapshot; and the canonical duplicate target was checked only before the lock. The credited-person item was fixed in this follow-up by applying `reviewerCreditConflict` to the recorded view, and the reporter-credit test was corrected to use an independent reviewing agent; a re-review of that differential returned **PASS**. The severity and canonical-target races are pre-existing and outside #579 scope, so they were not changed.

Tooling note: the Ruflo CLI (v3.10.31) is installed, but `providers list` reports Anthropic, OpenAI, Google and Ollama as not configured, so no Ruflo-hosted model review was executed. `opencode mcp list` reports no MCP servers configured, so the Code Review MCP was unavailable in this run. No tooling registration is presented as a completed review.

No database migration, seed, reset, live award test, or deployment was run for this verification. The feature branch is pushed normally; the pull request is not merged.
