# Zedu Bugs

Team **Zendor** fork of [`zeduchat/bug-tracker`](https://github.com/zeduchat/bug-tracker).

Report bugs, filter the board, triage status/assignee, vote, and leave comments.

Brand mark: `public/zedu-mark.svg`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind
- Auth.js v5 — email/password **and** optional Google OAuth
- Prisma + PostgreSQL
- pnpm
- Docker / Coolify deploy (`basePath` `/bug-tracker`)

## Live (upstream)

https://contributors.zedu.chat/bug-tracker

## Roles (RBAC)

| Role | Capabilities |
| --- | --- |
| `user` | Report bugs, comment, vote |
| `admin` | Everything `user` can do, plus triage (status / severity / assignee) |
| `super_admin` | Everything `admin` can do, plus `/admin/users` management (promote users to admin) |

Super-admin credentials come from `SUPER_ADMIN_*` env vars (see below). The seeder is idempotent and does not overwrite an existing super admin unless `SUPER_ADMIN_FORCE_UPDATE=true`.

## Demo accounts (credentials seed)

| Email | Password |
| --- | --- |
| `alice@zendor.dev` | `12345678` (admin) |
| `bob@zendor.dev` | `12345678` |
| `cara@zendor.dev` | `12345678` |

> Seed only on an **empty** database (or set `SEED_DEMO_DATA=true`). Never wipe a DB that already has real signups.

## Local setup

```bash
pnpm install
cp .env.example .env
docker compose up -d          # Postgres on localhost:5433
pnpm db:migrate
pnpm db:seed                  # empty DB only
pnpm dev                      # http://localhost:3001/bug-tracker
```

App is served under **`/bug-tracker`** (see `next.config.ts` `basePath`), matching Coolify.

### Env vars

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres URL |
| `AUTH_SECRET` | Session secret (`openssl rand -base64 32`) |
| `AUTH_URL` / `NEXTAUTH_URL` | App origin **including** `/bug-tracker` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google sign-in |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Idempotent super-admin seed (optional; password min 12 chars) |
| `SUPER_ADMIN_FORCE_UPDATE` | Set `true` to rotate password / promote an existing account |
| `SEED_DEMO_DATA` | Set `true` to wipe and load demo users/bugs |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Optional SMTP for password-reset email (logs reset URL to console when unset) |

Google redirect URI: `{AUTH_URL}/api/auth/callback/google`

## Deploy (Coolify)

- Build pack: **Dockerfile**. Container runs `prisma migrate deploy` on start.
- Set variables from `.env.example` in Coolify.
- GitHub secrets: `COOLIFY_WEBHOOK_URL` (and optionally `COOLIFY_TOKEN`).
- `Deploy (Coolify)` runs only after `Malware Scan (CI Gate)` passes on `main`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev server (port 3001) |
| `pnpm build` / `pnpm start` | Production build / start (`PORT`) |
| `pnpm test` | Vitest |
| `pnpm db:migrate` | Prisma migrate (dev) |
| `pnpm db:seed` | Seed demo users/bugs (**empty DB only**) |

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`AGENTS.md`](./AGENTS.md).

PRs target **`main`** on `Zedu-Endor/bug-tracker` (this fork). Sync from `upstream` (`zeduchat/bug-tracker`) as needed.

## Archive

Earlier standalone MVP history/issues origin: [`Zedu-Endor/bug-tracker-mvp`](https://github.com/Zedu-Endor/bug-tracker-mvp) (issues transferred here).
