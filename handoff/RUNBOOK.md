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
pnpm test
# Manual: open issue, click Summon Agent, select agent, enter brief, Send
# Verify console logs "[Agent Summon] Create comment"
```

## Build
```bash
pnpm build
```

## Deploy
- Platform: Coolify
- Command: Dockerfile build
- URL: https://ziki.dev

## Environment
- Required env vars: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
- Where secrets live: .env (never commit)
- Never commit: .env, secrets

## Troubleshooting
- Known issue: EMFILE during test run with many worktrees
- Fix: run tests with limited scope or clean worktrees
