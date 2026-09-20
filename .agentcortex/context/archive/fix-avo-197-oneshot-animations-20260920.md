# Work Log: fix/avo-197-oneshot-animations

## Header

- Branch: `fix/avo-197-oneshot-animations`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-20`
- Created Date: `2026-09-20`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `26e8cfc`
- Checkpoint SHA: `26e8cfc`
- Recommended Skills: `verification-before-completion, systematic-debugging, karpathy-principles`
- Primary Domain Snapshot: `game-feel`
- SSoT Sequence: `132`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-20 01:30 UTC`
- Platform: `claude-code`
- Files Read: `4`

---

## Task Description

Backlog AVO-197. Six one-shot SMIL animations in the office never play. SMIL resolves `begin="0s"` against the DOCUMENT timeline, so an element mounted after page load is already past its active duration and snaps to its end value. Measured: the AVO-135 done flash is mounted for 60 frames and visible on exactly 1. Restore the animations that were designed and approved when those features shipped — this is repair, not new design.

Sites: `AgentCharacter.jsx` — AVO-158 poke bob, AVO-136 desk-slam jitter, AVO-135 done flash (2 elements), AVO-110 reason-badge pop, AVO-134 behavior pop. `PixelOffice.jsx` — the event-banner fade-in.

Chain: `/plan → /implement → (light review) → /test → owner sight → /ship`.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-09-20 | Branch from `main`@26e8cfc. |
| plan | complete | 2026-09-20 | Mechanism chosen by measurement, not preference — see Decisions. |
| implement | complete | 2026-09-20 | 3 src files + 1 new component; 6 sites wrapped. |
| review | complete | 2026-09-20 | Self-review; two instrument errors caught and corrected before any claim. |
| test | complete | 2026-09-20 | 2512/133 green; browser matrix before vs after; frame strips captured. |
| handoff | n/a | — | quick-win exempt |
| ship | complete | 2026-09-20 | Owner saw the frame strips and approved. PR #244; SSoT 132 → 133. |

---

## Phase Summary

- bootstrap/plan: `quick-win`. The backlog row estimates `feature`; I am classifying this work item as `quick-win` and recording the divergence rather than silently following either. Reason: the code change is 3 files in one module (office UI) with no new import edges and no behaviour design — every animation here was already designed and approved when its own feature shipped, so there is no spec to write. What the `feature` estimate was really protecting is the OWNER-SIGHT requirement on visuals, and that is a separate gate which I am keeping: ship is blocked until the owner sees before/after frame strips. Classification sets ceremony; it does not waive that gate. | Confidence: 88% — high

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T01:30:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T01:30:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Backlog | docs/specs/_product-backlog.md AVO-197 | review-finding, P2, filed with the measurement |
| Precedent | .agentcortex/context/archive/feat-avo-193-coffee-busy-feedback-20260920.md | Where the defect was found; its steam uses CSS and is unaffected |

---

## Decisions

- **Mechanism: `begin="indefinite"` + `beginElement()` on mount, NOT a CSS rewrite.** Both were measured working in a controlled experiment (CSS: `r` animates, 61 distinct widths; a CSS transform on a nested `<g>` animates and the parent's base transform survives. SMIL: `beginElement()` → 40 positions). CSS was the tempting choice because AVO-193 used it and because SSR tests can assert a `style` string. It loses on three counts:
  1. **AVO-136 and AVO-158 are `additive="sum"` transforms on the agent's root `<g>`, which already carries `translate(x,y) scale(CHAR_SCALE)`.** A CSS `transform` would REPLACE that base transform (the existing code comment says exactly this). The CSS `translate` property composes instead of replacing, but it applies OUTSIDE the base transform, so the bob distance would no longer be scaled by `CHAR_SCALE` — a silent change in motion magnitude. Avoiding that needs an extra wrapper `<g>` around every agent's entire subtree: a large re-indentation diff for a repair.
  2. **A markup assertion proves nothing here anyway.** The whole finding is that shipped markup looked correct and did not animate. Verification has to be a real browser either way, so CSS's SSR-testability advantage is illusory for THIS defect.
  3. `begin="indefinite"` keeps every `values`, `keyTimes`, `dur` and `additive` exactly as designed and approved. Nothing about the motion changes except that it happens.
- **Not touching the `repeatCount="indefinite"` animations** (glow rings, the pet's tail, the coffee indicator). Measured unaffected — they are always mid-cycle.
- **Not re-tuning any animation.** Restoring them is already a feel change across five features; changing durations or curves at the same time would make the owner's before/after comparison meaningless.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- Classification diverges from the backlog row's `feature` estimate; rationale in Phase Summary. The backlog Tier field is a planning estimate written before this work item was bootstrapped, not a frozen classification, so this is not a reclassification and needs no rollback.

---

## Review Feedback

Self-review (quick-win: review optional):
- **Two of my own measurements were wrong before any of them were right, and both would have produced a false claim.** (1) The first pass sampled `document.querySelector(...)`, i.e. the first matching element in the DOCUMENT, while triggering a different agent — so it reported FROZEN for elements it was not watching. (2) The second pass read `getScreenCTM()`, which does not reflect SMIL transform animation at all, so every transform verdict was an artifact. Fixed by scoping every probe to its agent and measuring `getBoundingClientRect` — what the eye sees — validated each time against a known-playing control.
- **A third false signal was a scenario flake, not a defect**: AVO-134 read DEAD deterministically for the behaviour `thinking`. `BehaviorIndicator` has no `case 'thinking'`, so it renders null and the scaled group is empty — the instrument was measuring an empty box. Re-run with two behaviours that actually render an indicator: PLAYS. No production change was made on the strength of that reading.
- Scope check: only the six one-shot sites and one new component. No timing value, curve or `values` list was changed; `repeatCount="indefinite"` animations were deliberately not touched.
- `reducedMotion` gating is untouched at every site — the wrapper sits INSIDE the existing `!reducedMotion` conditions.

---

## Red Team Findings

none

---

## Design Reference

- Tool: other (frame strips) · Link: three before/after contact sheets (done flash · poke bob · behaviour pop), 6 frames each, sent 2026-09-20 · Approved: yes (owner, 2026-09-20, "合併 ＋ 收尾")

---

## Observability

none

---

## Resume

- State: SHIPPED (quick-win) — PR #244. Closes the last item opened by the 2026-09-19 review chain (AVO-193 → AVO-197).
- Open question deliberately NOT acted on: AVO-134's pop fires on EVERY behaviour change across 8 agents and is the likeliest to read as noise. Flagged to the owner at ship time; they approved all six as-is. If the office later feels busy, that one is the first lever, and removing it is a one-line change (unwrap it and let it stay a snap, or drop the animation).

---

## Test Gate Results

- `npx vitest run` → Test Files **133 passed (133)** · Tests **2512 passed (2512)** (+10, +1 file: `tests/oneShotSmil.test.jsx`).
- Build, `smoke` (4 viewports, 0 pageerrors, 0 console errors) and `smoke:panel` PASS.
- The unit tests deliberately do NOT claim the animations play — that cannot be shown in SSR, and believing markup was the original mistake. They hold the wrapper's markup contract and a **regression guard** that fails if any one-shot is ever left unwrapped again (with a self-test proving the guard can fail).

---

## Evidence

- **Browser matrix, same instrument on both sides** (headless Chromium, `getBoundingClientRect` / computed opacity — never a transform API, see Review Feedback):

| animation | before | after |
|---|---|---|
| AVO-135 done flash | DEAD (2 distinct) | PLAYS (43) |
| AVO-158 poke bob | DEAD (2) | PLAYS (21) |
| AVO-136 desk-slam jitter | DEAD (1) | PLAYS (26) |
| AVO-134 behavior pop | DEAD (2) | PLAYS (19) |
| AVO-110 reason pop | DEAD (2) | PLAYS (22) |
| event banner fade-in | DEAD (1) | PLAYS (24) |

- The done flash specifically: **mounted 60 frames / visible 1** → **mounted 61 / visible 39**, radii ramping 16.33 → 30.00 across 42 distinct values.
- Frame strips (6 frames per animation, before over after) captured for the owner: the done flash shows a ring expanding and fading where before there was nothing; the poke bob lifts the agent on frames 2-3; the behaviour pop scales the indicator in over frames 1-4.
- Pre-change measurement (headless Chromium, controlled): late-inserted one-shot `animateTransform` static while its indefinite control moved 52 positions; one-shot on a plain attribute showed 2 values (a snap) while its control showed 73; `begin="indefinite"` + `beginElement()` moved 40 positions. AVO-135 done flash: mounted 60 frames, visible on 1, opacity 0.393 → 0.000, radii 22.58 → 30.00.

## Known Risk

- R1: `beginElement()` is imperative and runs in an effect; it must fire on every REMOUNT (the poke bob is keyed per poke). Covered by keying the wrapper and starting in a mount effect.
- R2: making five animations play at once ADDS motion to an office whose stated law is REDUCE-not-add. The behavior pop (AVO-134) fires on EVERY behavior change across 8 agents and is the one most likely to read as noise. Flag it to the owner explicitly rather than burying it in a list.
- R3: reduced motion must stay honoured — all sites are already gated on `!reducedMotion`; the repair must not bypass that gate.
- Rollback: single commit, `git revert`. No data or status change.
