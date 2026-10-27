# Project Handoff

## Goal
Improve whimsical Field Guide design for issues list in issue-tracker.

## Deliverables
- [x] Updated app/(app)/issues/(list)/issues.css with specimen plate styling
- [x] Page background cream #f1ece1 with paper grain, cards #fbf7f1
- [x] Ruled paper background on issues table rows, hairline rules, no tinted backgrounds
- [x] Issue rows styled as catalogue entries: plate number monospace, title Fraunces serif, metadata small caps
- [x] Stamp-style status badges and severity indicators
- [x] Optional specimen plate framing on issue detail via app/(app)/issues/[id]/issue-detail.css

## Acceptance criteria
- Page background cream #f1ece1, table/card background #fbf7f1
- Ruled lines visible on table rows via subtle horizontal lines
- Issue number in monospace, title in Fraunces serif, metadata in small caps
- Stamp-style badges for status/severity using existing stamp colors
- Faint paper grain/dot pattern via CSS background-image
- No tinted section backgrounds, separation via hairline rules
- WCAG AA contrast maintained, prefers-reduced-motion respected
- Existing tests pass, changes scoped to CSS only

## Deadline
- Date/time: 2026-10-27
- Timezone: UTC
- Hard or soft deadline: soft

## Constraints
- Stack: Next.js App Router, React 19, Tailwind CSS
- Changes scoped to CSS files only, no component changes
- Do not break existing tests
- Preserve responsive behavior
