---
title: "ADR-008 — No fabricated need: the ambient/companion honesty rule"
date: 2026-06-19
status: accepted
applies_to:
  - "src/systems/petState.js"
  - "src/components/OfficePet.jsx"
  - "src/systems/officeLife.js"
  - "src/systems/eventJuice.js"
  - "src/systems/ambientSound.js"
  - "src/systems/lighting.js"
  - "src/systems/theme.js"
  - "src/systems/behaviorEngine.js"
  - "src/inference/desktopNotifier.js"
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "any new ambient / pet / companion / notification / charm feature, or any proposal that would reward keeping the app open, add a decay/streak/urgency mechanic, or light an ambient channel without a backing signal"
  supersedes: null
  superseded_by: null
---

# ADR-008: No fabricated need — the ambient/companion honesty rule

- **Status**: Accepted (2026-06-19)
- **Context**: AVO is an ambient companion you leave open — the value is "chill + fun" (you *want* to
  open it) layered on **honesty** (the on-screen state reflects real agent signals, never fabrication).
  Charm work is core, not decoration. But the chill/cozy/companion genre is full of **dark patterns
  that manufacture need or engagement** — Tamagotchi decay (it "dies" if you leave), streaks, "your
  agents miss you", loot-for-time-open (the Bongo Cat / NFT-adjacent pattern), fake urgency, and
  affective theatrics decoupled from any real signal. The project has repeatedly re-derived the same
  boundary from scratch: the pet barometer's hide-on-blocker guarantee (#39/AVO-121), the AVO-120
  leaderboard rejection, the eureka-cascade rejection (AVO-112), drag-to-move (ADR-005), the dialogue
  relationship-memory gate (ADR-007 §G4), and most recently **AVO-171** — where the pet could
  CELEBRATE with confetti while an agent was genuinely stuck at a permission prompt, because
  `awaiting-approval` wasn't counted as a blocker. Each was caught case-by-case. This ADR **codifies
  the shared rule once** so the boundary is enforceable, not re-litigated per feature.

## Decision

**No AVO feature may fabricate a NEED, an ENGAGEMENT incentive, or an EMOTIONAL/STATE reading that a
real signal does not back.** Every new ambient / pet / companion / charm / notification feature MUST
pass all of the following before it ships (the "no-fabricated-need" checklist):

- **N1 — No fabricated need.** No decay, no streak, no "your agents miss you", no penalty or guilt for
  leaving. Closing the tab costs the user nothing. An all-idle office renders a deliberate, honest
  *"all quiet / all caught up"* state — a feature, not a dead screen. (Anti-Tamagotchi.)
- **N2 — No fabricated engagement reward.** No mechanic that rewards keeping the tab/app open
  *independent of real agent activity* — no loot drops on a timer, no time-in-tab counters, no
  collectibles/economy. (Anti-Bongo-Cat / anti-NFT-adjacent.)
- **N3 — No fabricated emotional/state reading.** Pet mood, agent expression, celebrations, and rings
  derive ONLY from real signals. The pet **HIDES on any real "needs-you" blocker** — `blocked` AND
  `awaiting-approval` (the AVO-171 guarantee) — and never celebrates over a stuck agent. A positive
  beat (confetti/eureka) requires a real done/eureka edge.
- **N4 — No unbound decorative channel.** Every ambient visual/audio channel (ring, glow, lamp,
  weather, soundscape, juice, breathing) must either encode a genuine state OR stay neutral. A channel
  that lights up / animates without a backing signal is banned — adding a *new* decorative channel
  requires a real signal to bind it to, or it does not ship.
- **N5 — Degrade to honest neutral.** When a signal is missing/ambiguous, render the honest
  `unknown / quiet / idle` floor, NEVER a fabricated positive. (Calm-tech "still works when it fails";
  the gated clickable objects fall to a non-conclusive `deploy-idle`/`eureka-idle` neutral reaction.)
- **N6 — Real-clock only for ambient variety.** Time-of-day, seasonal, and weather variety follow the
  viewer's REAL local clock/calendar (a window onto reality), never a simulated or accelerated cycle
  that manufactures liveliness. (AVO-111 lighting; the AVO-162 retraction.)
- **N7 — No engagement notification.** A push/ping fires only on a REAL signal transition
  (blocked / awaiting-approval / done / idle), gated to tab-hidden + granted permission, deduped per
  episode. Never on a timer, never to "pull the user back".

The honest test (mirrors ADR-007 §G1): **delete the feature and the user has lost zero true
information and gained zero false belief.** If deleting it would remove a fabricated pull, it fails.

## Alternatives Considered

1. **Keep enforcing honesty case-by-case** (status quo). Rejected: it works but the same rule is
   re-derived every feature (pet, eureka-cascade, leaderboard, drag, dialogue, AVO-171) — costly and
   error-prone; AVO-171 shipped a hole for weeks precisely because the guarantee lived in one module's
   selector, not a shared rule.
2. **A softer "prefer honest" guideline.** Rejected: dark patterns are attractive precisely because
   they work on engagement metrics; a non-binding preference would erode under "just a little streak".
   The rule is a hard gate, like the secrets/destructive-command gates.
3. **Allow opt-in fake-need mechanics behind a toggle** (e.g. an optional Tamagotchi mode). Rejected:
   it contradicts the product's one differentiator (honesty) and there is no signal to make it honest;
   it would also normalize the pattern for the next feature.

## Consequences

**Positive**
- The honesty boundary the project keeps re-deriving is now one referenceable rule; new charm
  proposals are gated against N1–N7 instead of re-argued.
- It would have flagged AVO-171 at design time (N3) and the AVO-162 dup-as-fake-variety risk (N6).
- It protects the product's single moat: people can trust what the office shows.

**Negative / costs**
- It rules out the cheapest engagement tricks (streaks, decay, loot) — AVO must earn want-to-open via
  *honest* charm (real-clock ambience, idle micro-life, honest quiet states), which is harder.
- One more gate for charm features to clear; the chill/office-sim panel now also checks N1–N7.

## Compliance / re-open

- Enforcement is design-time review (the per-visual-feature chill panel checks N1–N7) + code review.
  Where a rule is mechanically checkable (N3 pet-hides-on-blocker, N7 notification gating, N6
  real-clock), a unit test pins it (e.g. `petState.test.js` AVO-171 regression).
- This ADR **consolidates, does not supersede**: ADR-004/005 (position = state), ADR-006 (scope
  honesty), ADR-007 (voice/relationship honesty) remain; ADR-008 is the ambient/companion-fabrication
  sibling. Backlog item **AVO-166** is closed by this ADR.
- **Re-open** only if AVO gains a genuinely new real signal that makes a previously-banned mechanic
  honest (e.g. a real, observable user-commitment signal) — recorded as a superseding ADR, never as a
  silent exception.
