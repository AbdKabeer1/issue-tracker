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
