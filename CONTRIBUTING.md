# Contributing to Ziki Issues

Team **Zendor (Zedu-Endor)** — lead: [@Goodnessmbakara](https://github.com/Goodnessmbakara).

This is Team Zendor's **Task 1** **Ziki Issues** project (HNG15) — a fork of [`zeduchat/bug-tracker`](https://github.com/zeduchat/bug-tracker). It is **not** part of `zedu-fe`, `zedu-mobile`, or `zedu-desktop`. All PRs target **this** repository's `main`.

## Default branch

- Default branch: **`main`**
- Always branch from an up-to-date `main`
- Open PRs against `main` in `Zedu-Endor/bug-tracker` — never against `zedu-hng` or other Zedu product repos

## Branch naming

Prefer a ticket when you have one:

```text
type/ENDOR-<ticket>-short-desc
```

Examples: `feat/ENDOR-12-issue-filters`, `fix/ENDOR-18-login-redirect`

For unticketed mini-project work:

```text
type/short-desc
```

Examples: `feat/create-issue-form`, `chore/seed-demo-data`

Allowed `type` prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

## Commits and PR titles

Use [Conventional Commits](https://www.conventionalcommits.org/):

- With a ticket: `type(ENDOR-xxx): summary`
- Without a ticket: `type: summary`

Examples:

- `feat(ENDOR-12): add status filter on issues list`
- `fix: prevent duplicate comment submit`
- `docs: clarify local Postgres port`

Keep the subject imperative and under ~72 characters. One logical change per commit when practical.

## Pull requests

1. One logical change per PR — keep diffs reviewable
2. Fill in the PR template (Summary + Test plan)
3. Target **`main`** on `Zedu-Endor/bug-tracker`
4. Do not mix unrelated refactors with feature work
5. Never force-push (`git push --force`, `-f`, or `--force-with-lease`)
6. Do not commit secrets (`.env`, keys, credentials)
7. Ensure all pre-push checks pass (`pnpm check`)

## Mandatory Pre-Push Verification

Before pushing code or opening a PR, always run:

```bash
pnpm check
```

This runs the trifecta of pre-push checks:
1. `pnpm lint` — ESLint static analysis
2. `pnpm typecheck` — TypeScript type checking (`tsc --noEmit`)
3. `pnpm test` — Vitest unit and integration test suite

All PRs must pass CI before they can be merged.

## Testing Guidelines

We prioritize high test confidence. Every new route, server action, API endpoint, or utility should have accompanying unit or integration tests.

```bash
pnpm test          # Run all Vitest suites
pnpm test:watch    # Watch mode for interactive TDD
pnpm e2e           # Run Playwright end-to-end tests
```

### Backend Endpoint Testing (`app/api/**`, `app/**/route.ts`)

When adding or modifying backend route handlers, write corresponding `*.test.ts` files:
- **Authentication & Authorization**: Verify that unauthenticated requests receive `401 Unauthorized` and role gates enforce `403 Forbidden` / `404 Not Found`.
- **Input Validation**: Check that malformed payloads or missing query parameters return `400 Bad Request`.
- **Rate Limiting**: Test rate-limited endpoints (e.g. `/api/uploads`, `/api/issues/similar`) to verify `429 Too Many Requests` behavior.
- **Database Interaction**: Mock `@/lib/prisma` calls cleanly with `vi.mock("@/lib/prisma")` to test both successful operations and DB failure handling (`500` / `503`).
- **Headers & Response Formatting**: Verify `Content-Type`, `Content-Disposition`, and cache control headers (e.g. for CSV export or attachment downloads).

### Server Actions Testing (`app/actions/**`)

- Test validation with invalid Zod payloads.
- Test permission checks (`requireUser`, `requireRole`, `requireAdmin`).
- Test cache revalidation (`revalidatePath("/issues")`).

### Validations & Schemas

Zod schemas live in `lib/validations/issue.ts`. Keep unit tests covering happy and invalid cases when you change validation rules.

## Continuous Deployment Flow

- **Staging / Team Testing (Vercel)**:
  Every merge into `main` on `Zedu-Endor/bug-tracker` automatically triggers `.github/workflows/deploy-vercel.yml`. This runs all checks and deploys a live preview to Vercel so the team can test changes end-to-end before promoting them.
- **Production (Coolify)**:
  The upstream repository `zeduchat/bug-tracker` deploys to production on Coolify (`issues.zedu.chat`). Only verified and peer-reviewed PRs from team branches are submitted upstream.

## Local development

Paths below assume the repo lives at `/Users/abba/Desktop/bug-tracker` (or your local clone of this repo).

### 1. Start Postgres

```bash
docker compose up -d
```

Postgres is mapped to **host port 5433**:

- User / password / db: `bugtracker` / `bugtracker` / `bugtracker`
- `DATABASE_URL=postgresql://bugtracker:bugtracker@localhost:5433/bugtracker`

### 2. Environment

```bash
cp .env.example .env
# set AUTH_SECRET (e.g. openssl rand -base64 32)
```

Never commit `.env`.

### 3. Install, migrate, seed

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

### 4. Run the app

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

Demo accounts and more detail: see [README.md](./README.md).

## Code hygiene

- Prefer small, focused PRs
- Match existing TypeScript / Next.js App Router patterns in this repo
- Do not commit `.env`, `.pem`, or credential files
- Do not force-push to any branch shared with the team
