# Work Log: feat/avo-141-comms-rail-optimization

## Header

- Branch: `feat/avo-141-comms-rail-optimization`
- Classification: `quick-win`  *(reclassified from `feature` after the expert panel collapsed scope to a contained 2-file honesty/dedup change — see Drift Log + Decisions D-1)*
- Classified by: `claude (Opus 4.8)`
- Frozen: `true`
- Created Date: `2026-06-19`
- Owner: `claude`
- Guardrails Mode: `Quick`  *(review + test NOT skipped despite quick-win — honesty-critical feed surface; same posture as AVO-184)*
- Current Phase: `ship`
- Checkpoint SHA: `482cb75`
- Recommended Skills: `karpathy-principles (non-trivial UI), frontend-patterns (rail component states), verification-before-completion (visual proof, not DOM claims), red-team-adversarial (review/test), systematic-debugging, test-driven-development (legibility/density guards are testable even if look is visual)`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `98`

---

## Session Info

- Agent: `claude (Opus 4.8)`
- Session: `2026-06-19 AVO-141`
- Platform: `Antigravity / Claude Code`
- Guardrails loaded: `§1, §2, §4 (incl §4.4 Design-First), §5, §6, §7, §8.1, §10 (core + testing for UI feature)`
- Override: `none`

---

## Task Description

AVO-141 — Comms / vertical (☰ roster) living-presence rail DEEPER optimization. The ☰ roster →
living-presence rail (PR #44, AVO-140 family) left "still lots of room". Goal: tighter/denser use of
the vertical comms column (more presence + activity legibility per pixel) **WITHOUT adding new chrome**.
Backlog P2, `feature`, vibe-rebalance theme. Components: `src/components/NarrowRoster.jsx`,
`ActivityFeed.jsx`, `ControlPanel.jsx` (+ controlPanelLabels.js). Spec context (historical):
`docs/specs/living-office-events.md`.

**Vague-by-design** ("still lots of room", "denser") → MUST `/brainstorm` first (define WHAT to densify)
with a **chill/office-sim game-design panel** gating on "does it help the small visual game screen", and
an **adversarial pass** (challenge the additive instinct — clutter rule = REDUCE not ADD). Then `/spec`
→ `/plan` (Design-First §4.4: DSoT artifact required for the UI change) → implement → review → test →
handoff → ship. Visual proof via headless Playwright / getBoundingClientRect (preview_screenshot is
broken in this project), NOT DOM/code claims.

Phase chain: `/brainstorm → /spec → /plan → /implement → /review → /test → /handoff → /ship`.

---

## Phase Sequence

- bootstrap
- brainstorm
- plan
- implement
- review
- test
- ship

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Backlog | docs/specs/_product-backlog.md (AVO-141 row + §AVO-141 detail) | "still lots of room"; denser presence+activity, no new chrome |
| Spec (historical) | docs/specs/living-office-events.md | AVO-140 living-office context; status draft |
| Domain Doc L2 | docs/architecture/ui-rendering.log.md | ui-rendering primary domain |
| Components | src/components/{NarrowRoster,ActivityFeed,ControlPanel}.jsx | the comms rail surface |
| ADR | ADR-008 (ambient-honesty) | governs no-fabricated-presence; density must stay honest |

---

## Known Risk

- **Clutter regression**: "densify" easily becomes "add", violating the owner's #1 lever (REDUCE not ADD;
  [[project_avo_clutter_levers]]). Mitigation: brainstorm gates every idea on "removes noise / raises
  legibility per pixel", not "adds info". Automated legibility guard before/after.
- **Honesty**: denser presence must not fabricate activity/presence (ADR-008). Density = better use of
  REAL signals only.
- **Visual-proof trap**: preview_screenshot is broken here; DOM/code "looks fine" is NOT proof
  ([[feedback_visual_proof_not_dom_claims]]). Mitigation: headless Playwright / getBoundingClientRect
  measurement + owner visual confirmation; adversarially verify the MERGED main live.
- **Protected surface**: LABEL_SCALE_MAX / responsive layout are protected (SSoT §Protected Surfaces) —
  measure label rects at small widths if touched.

---

## Decisions

- **D-1 (2026-06-19, panel-driven reframe + owner-confirmed)**: AVO-141 pivots from "densify the ☰ rail"
  to **"comms feed honesty + dedup"**. A 4-expert panel (chill/office-sim · honesty/calm-tech · density/
  legibility · adversarial skeptic) independently converged:
  - **Decision**: ship **B+** — (1) repoint the floating `ActivityFeed.jsx` from `activityLog` (ALL
    origins incl organic theater + the decorative `activeEvent` banner unshift'd as "live" + an unread
    badge counting theater) to the real-events `eventFeed` (or FEED_ORIGINS filter), so OFFICE mode (the
    primary view) stops fabricating liveliness; (2) hide that floating widget in `rosterMode` (the inline
    real-events feed already covers it). Touches `ActivityFeed.jsx` + `App.jsx` (mount guard) only.
  - **Rationale**: honesty IS the product value (ADR-008); the rail already fixed this internally
    (eventFeed/team-status-strip) but the floating feed was never migrated — B+ closes an un-migrated
    honesty gap + removes roster-mode redundancy. REDUCE-not-ADD, no protected-surface risk.
  - **Rejected**: **A (condense idle into mini-rows)** — density expert showed the real pixel waste is the
    UNIFORM card chrome (46×56 sprite ~448px + py-3 + gap-2), not the idle tier; A harvests ~90–120px,
    adds a 2nd row morphology, touches protected responsive/label/sprite surfaces. 2 KILL / 1 refine.
    **C (density-adaptive feed height)** — unanimous KILL: feed is already `flex-1 min-h-0`; adding a
    "few-active grows" trigger = fake-liveliness motion + REDUCE violation. **"densify to fill room"
    framing** — rejected outright (empty space in calm-tech is a feature, not a defect).
  - **Deferred (out of scope, optional follow-up)**: uniform chrome trim (shrink sprite/padding for all
    rows, ~250px) — panel leans against (protected surfaces, thrash-sensitive, needs visual proof + owner).

## Conflict Resolution

none

---

## Skill Notes

none

## Review Feedback

- Fresh adversarial reviewer (acx-reviewer, agentId ad6f95, diff-only, no implementer rationale —
  Freshness Invariant). Verdict **READY**. All 6 claims PROVEN: honesty (entries + unread badge source
  ONLY eventFeed; all 4 eventFeed writers FEED_ORIGINS-gated → organic can never enter) · production
  reactivity (pushFeed returns new array → useShallow ref change → memo recompute → fresh getState();
  rosterMode reactive re-renders on toggle) · rosterMode gate correct + hooks before returns · eventFeed/
  ActivityEntry shape compatible (status/event/handoff all render safely; charName null-guarded; color
  optional-chained) · App.jsx provably untouched (git diff empty) · test non-tautology + test-the-test
  discriminating. Security clean; no trust boundary.
- Findings: **L1 (FIXED, commit 482cb75)** — test `NOW` frozen at module load → latent flake if a slow
  runner lapses the 30s badge window; resolved timestamp per call. **L2 (out of scope, noted)** — no
  jsdom/happy-dom in repo so live-mount reactivity isn't unit-verifiable (pre-existing project constraint,
  matches the shipped NarrowRoster dual-read precedent); **mitigated by the /test headless-Playwright
  visual proof**. Info (not a defect): a real officeLife `origin:'event'` set-piece still surfaces once as
  a genuine event (same as the roster shows) — only the fake live re-injection was dropped. Correct.

## Security Findings

- 2026-06-19 /review: 0 findings. UI-only render repoint — no endpoint/auth/external-input/injection/secret.

## Red Team Findings

- 2026-06-19 /review: n/a (UI cosmetic dedup; no trust boundary). Fresh adversarial honesty pass run anyway
  (honesty-critical surface) — 0 Critical/High.

---

## Phase Summary

- bootstrap: classified `feature` (UI/visual rail optimization, vibe-rebalance). ADR coverage =
  no_covering_adr; recommend SKIP ADR (visual density polish, not an architectural decision; honesty/
  clutter already governed by ADR-008 + clutter rule) pending /brainstorm. Next: /brainstorm (define
  densification angle + game-design panel before any code).
- brainstorm: ran a 4-expert panel (chill/office-sim · honesty/calm-tech · density/legibility · adversarial
  skeptic). Panel REFRAMED the feature (see Decisions D-1): killed A (idle condense — wrong target, real
  waste is uniform chrome; touches protected surfaces) + C (adaptive height — already flex-1); the win is
  **B+ comms-feed honesty + dedup** (owner-confirmed). Reclassified feature→quick-win (scope collapsed to
  2 files). ADR skip stands. Next: /plan. | Confidence: 92% — high (contained, no protected-surface touch).
- plan: 4 steps (ActivityFeed repoint activityLog->eventFeed + drop activeEvent injection · App.jsx
  rosterMode mount guard · honesty+dedup tests w/ test-the-test · headless visual proof). Target files:
  src/components/ActivityFeed.jsx, src/App.jsx (+new test). eventFeed shape verified compatible with
  ActivityEntry. Mode Normal. | Confidence: 92% — high; one impl uncertainty = event-type message render
  (eventName mapping, like NarrowRoster FeedRow), resolved at implement.
- implement: 1 source file (ActivityFeed.jsx — repoint activityLog→eventFeed, drop activeEvent injection,
  eventName for events, rosterMode self-hide guard) + new honesty test (5, test-the-test verified). App.jsx
  untouched (guard moved inside per Drift Log deviation). Hit + solved the zustand SSR-reads-initial-snapshot
  gotcha via the getState() idiom. Full suite 2219 pass, build clean. Checkpoint 9992528. | Confidence: high.
- review: fresh adversarial reviewer (diff-only) = READY, all 6 claims PROVEN, 0 Critical/High/Medium.
  Fixed L1 (test timestamp flake, commit 482cb75); L2 (no jsdom) out-of-scope, mitigated by /test. | high.
- test: headless Playwright visual proof PASS (office shows floating feed; roster hides it + shows inline
  rail; 0 errors) — real browser, mitigates review L2. Full suite 2219, render-smoke PASS (4 viewports).
  Checkpoint 482cb75. | Confidence: high.
- ship: SSoT Ship History appended (guard, new_sha db8962f) + heartbeat seq 98→99; backlog AVO-141
  Pending→Shipped (reframed note) + detail section updated; work log archived + INDEX chained. PR opened +
  CI-gated squash-merge to main. | Confidence: high.

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-19
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-19
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-19
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-19
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-19
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-19

> Reclassification note: bootstrap originally classified `feature`; reclassified to `quick-win` after the
> /brainstorm panel collapsed scope (Drift Log + Decisions D-1). Receipts reflect the final, effective
> classification so the validator reads one clean quick-win progression (per Global Lesson 6c281ae5).

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- 2026-06-19: **Reclassification feature → quick-win** (explicit, NOT silent). After the /brainstorm
  expert panel, scope collapsed from the vague "densify the rail" feature to a contained 2-file honesty/
  dedup change (ActivityFeed.jsx data source + App.jsx mount guard) — 1–2 modules, clear scope, low
  cross-module impact = quick-win per §10.1. Rolled back to CLASSIFIED, set Classification: quick-win,
  Guardrails Mode: Quick. review + test retained (honesty-critical surface). No code written pre-reclass
  (still at bootstrap/brainstorm), so no stash needed. ADR /skip stands (no architectural decision; B+ is
  subtractive honesty, governed by ADR-008). Design-First §4.4: subtractive change (remove theater + hide
  redundancy), no new visual design → no DSoT mockup; backed by before/after visual proof at /test.
- 2026-06-19: /ship heartbeat (Update Sequence 98→99 + Last Updated) via direct python edit, NOT guard
  replace — Ship History already went through the guard (append, new_sha db8962f); a guard replace of the
  whole SSoT for a 2-field bump is disproportionate. Append + heartbeat verified by re-read.
- 2026-06-19: **Plan deviation (logged before code)**: the rosterMode dedup guard moves from App.jsx into
  ActivityFeed.jsx as an early-return (`const rosterMode = useOfficeStore(s=>s.rosterMode); if (rosterMode)
  return null`), mirroring the existing `if (mode==='panel') return null`. Rationale: (a) more testable —
  SSR-render ActivityFeed with rosterMode=true → null (renderToStaticMarkup is the project's render-test
  tool; NO jsdom); (b) simpler — App.jsx stays UNTOUCHED, scope shrinks to ONE source file. Tests use
  renderToStaticMarkup (per tests/narrowRosterOrder.test.jsx pattern), asserting the collapsed unread
  badge sources eventFeed (honesty) + null on rosterMode. Target files now: src/components/ActivityFeed.jsx
  + tests/activityFeedHonesty.test.jsx (App.jsx dropped from scope).
- 2026-06-19: ADR coverage check = no_covering_adr (ADR-007/008 applies_to don't cover the rail
  components). Recommending SKIP /adr — AVO-141 is a visual density polish, not a new architectural
  decision; honesty/clutter constraints already governed by ADR-008 + the clutter-levers rule. To be
  confirmed at /brainstorm; if a real architectural fork appears, route to /adr then.
- 2026-06-19: ADR-001..006 flagged missing `applies_to:` frontmatter (retrofit opportunity, out of scope).

---

## Evidence

- **Implement (commit 9992528, ActivityFeed.jsx + new test; App.jsx untouched)**:
  - `npx vitest run tests/activityFeedHonesty.test.jsx` → 5/5 PASS. **test-the-test verified**: reverting
    the source `eventFeed`→`activityLog` made exactly the 2 honesty assertions FAIL (eventFeed→badge,
    organic-activityLog→no-badge), then reverted. Proves the guard catches the honesty regression.
  - Full suite **2219 PASS** (104 files, +5); `npm run build` clean (442ms); `git diff --check` clean.
  - SSR-correctness probe: confirmed zustand reactive selectors read the INITIAL snapshot under
    react-dom/server while `getState()` reads current — so the component reads via getState() (NarrowRoster
    idiom); subscriptions stay reactive for production toggle.
- **Security quick-scan** (touched src/components/ActivityFeed.jsx): no endpoint/auth/secret/injection
  surface — a UI component sourcing store state + rendering. Clean (A01–A03 + §3).
- **Rollback**: single commit 9992528 on feat/avo-141-comms-rail-optimization; revert it. Branch isolated
  from main; nothing ships until visual proof (/test) + fresh adversarial /review.
- **Test (review L1 fix at 482cb75)**:
  - **Headless Playwright visual proof (REAL browser, mitigates review L2)**: drove the live app via
    localStorage `office-view` + reload (the app boots its own state — not an imported store instance).
    OFFICE mode → floating feed present (📋 count=1), inline rail absent. ROSTER mode → floating feed
    **ABSENT (count=0 — dedup confirmed live)**, inline presence rail present (count=1). **0 console/page
    errors** both modes. Screenshots delivered to owner (then cleaned up — untracked).
  - Full suite **2219 PASS** (104 files); `npm run smoke` (render-smoke) PASS — 4 viewports, min svg
    descendants 2158, 0 pageerrors, 0 console errors; build clean.
  - The honesty SOURCE (eventFeed-only) is locked by tests/activityFeedHonesty.test.jsx (5, test-the-test
    verified); the live visual proof confirms the DEDUP behavior in a real browser.
