# Issues reference comparison

final result: blocked

## Scope and evidence

- Target: supplied `photo_2026-10-23_17-30-03.jpg`, 1137 × 1280 pixels, Open selected.
- Implementation: `/issues?status=open`, viewport 1137 × 1280 CSS pixels, device scale factor 1.
- Captures: `outputs/issues-latest-before.png`, `outputs/issues-final-desktop.png`, `outputs/issues-final-375.png`, `outputs/issues-final-768.png`, `outputs/issues-final-1440.png`.
- Side-by-side evidence: `outputs/issues-comparison.png` (reference left, implementation right).
- The source and rendered images were opened and visually compared. A populated-row comparison cannot be completed: the local database has zero issues and the demo account has no workspace membership. No issue records were fabricated or inserted.

## Findings and changes

- Added the rounded white content panel, inset heading, outlined New issue action, circular toolbar controls and blue selected capsule treatment.
- Kept the approved Overview shell, Manrope font and semantic color tokens. The approved sidebar occupies horizontal space absent from the supplied screenshot; changing it would exceed the assigned scope.
- Reworked row markup for compact type icons, priority bars, stage segments, outlined chevron vote controls, inline platform/time metadata, and avatar fallback. Rows use an 88px minimum height and aligned narrow secondary columns. Unit-render coverage passes; populated browser geometry remains unverified.
- Preserved platform shortcuts, detailed filters, milestone progress, deleted views, bulk selection, query preservation, pagination, search suggestions, voting and unwatch controls.
- The source's Inbox/Review/Approved/Attention tabs do not map directly to the app's status model. Tabs use All issues/Open/In progress/Resolved/Closed with live scoped counts rather than invented status transitions or reference counts. Intake-stage filtering remains in the filter panel.
- Refined the Open-selected state to avoid a redundant active-filter summary when status is the only selection. Other filter summaries remain available.

## Verification

- Browser: search and sort update the real URL while preserving other filters; filter dialog opens and dismisses with Escape; Open navigation preserves search/sort and resets paging/intake.
- Browser: 375px, 768px and 1440px captures have zero document horizontal overflow. Desktop captured at the exact reference viewport.
- Browser: no uncaught page errors during the verified flows.
- Focused tests: 70 passed across Issues rendering, filter interactions and vote behavior, including optimistic rollback.
- ESLint: modified TSX files passed.
- App TypeScript: passed using an output-only validation config excluding standalone packages, old audit probes and obsolete generated build types. The ordinary root typecheck remains blocked by those pre-existing workspace artifacts/dependencies.
- Full `pnpm test --maxWorkers=4`: failed on documentation examples, Windows migration-script tests, untracked audit probes and one query-selection assertion affected by the added status-count query. That Issues assertion was corrected to identify the platform query explicitly; all 70 focused tests passed on rerun. The unrelated failures were not changed.
- Issue creation submission, populated issue navigation/status updates, visual row density and live pagination have not been exercised because there are no real issues in this database.

## Required before visual approval

Use a populated existing workspace to verify real issue rows and pagination against the target at 1137 × 1280. Recheck long titles, type variations, priority/stage alignment, avatars, bulk selection, vote reconciliation, issue creation and status changes. Do not label this pixel-perfect or visually approved until that comparison is complete.

No Overview, shell, authentication, issue-action, schema or unrelated route source files were modified by this UI change.
