# Contributing to Zedu Bugs

Team **Zendor (Zedu-Endor)** — lead: [@Goodnessmbakara](https://github.com/Goodnessmbakara).

This is Team Zendor's **Task 1** **Zedu Bugs** mini-project (HNG15) — a fork of [`zeduchat/bug-tracker`](https://github.com/zeduchat/bug-tracker). It is **not** part of `zedu-fe`, `zedu-mobile`, or `zedu-desktop`. All PRs target **this** repository's `main`.

## Default branch

- Default branch: **`main`**
- Always branch from an up-to-date `main`
- Open PRs against `main` in `Zedu-Endor/bug-tracker` — never against `zedu-hng` or other Zedu product repos

## Branch naming

Prefer a ticket when you have one:

```text
type/ENDOR-<ticket>-short-desc
```

Examples: `feat/ENDOR-12-bug-filters`, `fix/ENDOR-18-login-redirect`

For unticketed mini-project work:

```text
type/short-desc
```

Examples: `feat/create-bug-form`, `chore/seed-demo-data`

Allowed `type` prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

## Commits and PR titles

Use [Conventional Commits](https://www.conventionalcommits.org/):

- With a ticket: `type(ENDOR-xxx): summary`
- Without a ticket: `type: summary`

Examples:

- `feat(ENDOR-12): add status filter on bugs list`
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

## Package manager

**pnpm only.** Do not use npm or yarn, and do not commit `package-lock.json` or `yarn.lock`.

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test        # Vitest — run before opening a PR
pnpm test:watch
```

Zod schemas live in `lib/validations/bug.ts`. Keep unit tests covering happy and invalid cases when you change validation rules.

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
