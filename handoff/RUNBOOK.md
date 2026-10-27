# Runbook

## Setup
```bash
cd /Users/mrroddy/issue-tracker
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:migrate
pnpm dev
```

## Run
```bash
pnpm dev # http://localhost:3001
Login with alice@zendor.dev / 12345678
Open any issue to see Summon Agent button
```

## Test
```bash
pnpm exec tsc --noEmit
pnpm test
# Manual: open issue, click Summon Agent, select agent, enter brief, Send
# Verify console logs "[Agent Summon] Create comment"
```

## Build
```bash
pnpm build
```

## Deploy
- Platform: Vercel
- Live production URL: https://issue-tracker-nu-nine.vercel.app
- Vercel project: aboki2/issue-tracker
- Build command: `prisma generate && next build --webpack`
- Database: Neon Postgres provisioned through the Vercel Marketplace (`ziki-preview`)
- Deploy command:
```bash
vercel --prod --yes --archive=tgz
```
- `.vercelignore` excludes `.env*`, `.next`, `.worktrees`, `node_modules`, `.git`
- Vercel env vars set: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`,
  `AUTH_PASSWORD_LOGIN=true`, `NEXT_PUBLIC_SITE_URL`
- Cron schedules are daily (`0 0 * * *`) to stay within the Hobby plan limits.
- Migrations are run manually against `DATABASE_URL_UNPOOLED`, not during the
  Vercel build:
```bash
export $(grep -E '^(DATABASE_URL_UNPOOLED|DATABASE_URL)=' .env.local | xargs)
DATABASE_URL="$DATABASE_URL_UNPOOLED" DIRECT_URL="$DATABASE_URL_UNPOOLED" pnpm exec prisma migrate deploy
DATABASE_URL="$DATABASE_URL_UNPOOLED" DIRECT_URL="$DATABASE_URL_UNPOOLED" pnpm db:seed
```

## Environment
- Required env vars: DATABASE_URL, AUTH_SECRET, AUTH_URL, NEXTAUTH_URL
- Where secrets live: .env (never commit) and Vercel project env vars
- Never commit: .env, secrets

## Troubleshooting
- Known issue: EMFILE during test run with many worktrees
- Fix: run tests with limited scope or clean worktrees
- If Vercel build fails on Prisma: confirm the build command does not run
  `prisma migrate deploy`; migrations are applied separately against Neon.
- If login fails on Vercel: confirm `AUTH_PASSWORD_LOGIN=true` and
  `AUTH_URL` / `NEXTAUTH_URL` point at the live deployment.
