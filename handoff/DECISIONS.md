# Decisions

Record choices that the next agent should not re-litigate without a reason.

## 2026-10-27 — Agent Summon Pad implementation

- Context: Need whimsical UI for summoning agents on issue page
- Options considered:
  - Server action for comment creation vs console.log simulation
  - Fetch agents via API /api/dashboard/agents vs direct loadOwnAgents
- Chosen:
  - Client component fetching agents via fetch('/api/dashboard/agents')
  - Console.log simulation for comment creation (placeholder)
- Why:
  - API route already exists and handles auth/tenant scoping
  - Avoids server-only restriction of loadOwnAgents in client
  - Fastest path to meet acceptance criteria
- Trade-off:
  - Comment creation not persisted yet
- Revisit if:
  - Requirement moves from simulation to real persistence

## 2026-10-27 — Field Guide specimen plate CSS

- Context: Improve whimsical Field Guide design for issues list per request
- Options considered:
  - Change CSS variables globally vs scoped overrides
  - Use SVG noise vs CSS radial gradients for paper grain
  - Add stamp badges via pseudo-elements vs class styling
- Chosen:
  - Scope changes to issues.css and issue-detail.css only
  - Page background var(--zk-bg) cream #f1ece1, table background var(--zk-surface) #fbf7f1
  - Paper grain via radial-gradient CSS, ruled lines via repeating-linear-gradient
  - Title Fraunces serif, metadata small caps, plate number monospace
  - Stamp-style .issue-row-status with border, background mix, rotate, reduced-motion guard
- Why:
  - Keeps changes CSS-only and non-breaking
  - Leverages existing theme tokens for WCAG AA contrast
  - Follows Field Guide aesthetic without component changes
- Trade-off:
  - Stamp rotation may affect visual density on small screens
- Revisit if:
  - Design team requests different grain intensity or stamp colors

## 2026-10-27 — Vercel + Neon deployment

- Context: Need a live preview of the field-guide redesign
- Options considered:
  - Vercel Hobby with the repo's original build command (prisma migrate deploy + every-minute crons)
  - Vercel preview-only config without migrations/crons
  - Provision a managed Postgres through the Vercel Marketplace
- Chosen:
  - Vercel production deployment on the Hobby plan
  - Neon Postgres via Vercel Marketplace (`ziki-preview`)
  - Build command: `prisma generate && next build --webpack`
  - Cron schedules changed to daily (`0 0 * * *`)
  - Migrations and demo seed run manually against the Neon unpooled URL
- Why:
  - Hobby rejects `* * * * *` cron expressions
  - The original build tried to reach local Postgres at `localhost:5433`
  - Neon gives the preview a real database without touching the production DB
- Trade-off:
  - Migrations are no longer automatic during deploy; they must be run in the
    release step before promoting a build
- Revisit if:
  - The project moves to Vercel Pro (restore per-minute crons) or Coolify
    (restore the Dockerfile/migrate-on-boot flow)

## Open questions
- Should Send button actually create BugComment record with [Agent Brief] prefix?
- Should agent be mentioned via @mention syntax?
