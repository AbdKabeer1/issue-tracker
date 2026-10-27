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

## Open questions
- Should Send button actually create BugComment record with [Agent Brief] prefix?
- Should agent be mentioned via @mention syntax?
