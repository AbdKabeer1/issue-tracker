# Surface brief — Ziki Field Guide

## Direction contract (locked with owner)

One world, printed on paper, split across two artifacts.

**World:** an entomologist's field guide — the object you carry into the field to identify a specimen — bound together with its companion collector-card album. Both are the same press, the same paper stock, the same ink. The pun is the point: a *bug* tracker cataloguing *bugs* as *specimens*.

**Primary artifact — the Field Guide.** Every screen in the working app: issues list, issue detail, triage, filters, forms, dialogs. Cream laid paper ground, ink linework, small-caps labels, one stamp color for state.

**Secondary artifact — the Collector Album.** The agent-facing surfaces: leaderboard, worker ranking, agent profiles, points and levels. Same paper, same ink, same type — these are just another plate from the same press, not a second brand.

## What each artifact lends

Field Guide lends:
- **Palette/material:** unbleached cream paper `#F4EEE0`, deep ink `#1B1A16`, a single stamp red `#B8432F`, plus moss `#4A6B3F` and ochre `#C08A2E` for state. Paper is flat, never gradient. Grain is a faint repeating dot, not a texture overlay.
- **Type/composition:** a sturdy text serif for titles and body (issue titles read like catalogue entries), a plain grotesque in small caps for labels, and a monospace for plate numbers, IDs and metadata. Hierarchy comes from small-caps label vs serif value, and from hairline rules — never from coloured panels.
- **Topology/navigation:** the guide's running head (plate number + section) across the top, a fore-edge index down the side, entries in a single dense column of ruled rows.
- **Controls/state:** rubber stamps. A status is a stamp impression — outlined, slightly irregular, one ink. Selected filters read as a stamped date on the plate head.
- **Responsive/motion:** motion is a page turn or a stamp landing — short, weighted, no easing theatrics. Under `prefers-reduced-motion` every stamp and page-turn snaps to its end state.

Collector Album lends:
- **Palette/material:** same stock, with a rarity ribbon in the stamp colors — Common (ink), Uncommon (moss), Rare (stamp red), Legendary (ochre).
- **Type/composition:** a name plate, a stat block set as a two-column table, and one line of character note beneath.
- **Controls/state:** the rarity ribbon is the only saturated element on a card. Whole cells reflow together; the focused card lifts by a hair and settles with one small bounce.

## Signature moves (two, one per artifact)

1. **Triage as an identification key.** On the issues board and in triage, routing an issue to its status is a hand-ruled dichotomous key: *Does it reproduce on main? → yes/no*. Each fork is a ruled branch. This is the thing someone describes to a colleague.
2. **The stat block album.** Agents, ranked, as collector cards whose points read as power and whose level reads as rarity.

## Discipline raised from other systems

- **Magnitude ramp, not hue alone** (raised from the star atlas challenger): priority reads as the *size* of the plate mark, so severity survives greyscale and print.
- **One ink per state, never labelled twice** (raised from the Saville catalog challenger): a state colour appears once per row — if it is coloured, its word is dropped; if the word is present, the colour is a hairline, not a fill.
- **Monospace metadata line** (raised from the Ikeda challenger): every entry carries a mono line of plate number, collector and date — the dense marginalia that makes a guide feel real.
- **Hierarchy by scale and rule, not panel** (raised from the variable-font specimen challenger): no tinted section backgrounds; separation is a hairline rule and a change of type voice.

## Ruled out (the incumbent, explicitly replaced)

Navy/chrome SaaS chrome. Inter on grey with soft rounded cards and diffuse shadows. Blue-tinted panels used as section headers. Gradient headlines. Pill-shaped everything. Any dark dashboard with a neon accent.

## Non-negotiables carried over

Skip link, focus management, `prefers-reduced-motion`, WCAG AA on every pair, ≥40px targets, keyboard shortcuts and the `?` dialog unchanged. Print styles keep working — a field guide *should* print well; that is now a feature rather than a constraint.

## Entry file

`app/(app)/issues/(list)/page.tsx` — the issues list is the core screen and the first surface to carry the full language.
