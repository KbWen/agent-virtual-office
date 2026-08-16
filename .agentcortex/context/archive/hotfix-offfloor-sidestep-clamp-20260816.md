# Work Log: hotfix/offfloor-sidestep-clamp

## Header

- Branch: `hotfix/offfloor-sidestep-clamp`
- Classification: `hotfix`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-16`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Diff Base SHA: `cb6a76e`
- Checkpoint SHA: `f47707a`
- Recommended Skills: `verification-before-completion (auto), systematic-debugging (auto), red-team-adversarial (auto, Lite), karpathy-principles (auto), frontend-patterns (scope-detected)`
- Primary Domain Snapshot: `office-runtime`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5` · Session: `2026-08-16 12:00 UTC` · Platform: `claude-code`
- Override: `none` · Downstream-Capabilities: carried (`kb-main→OK`, Read-Once)

---

## Task Description

Fix the nightly `sim-soak` catch on `main` (run 31925068076, `cb6a76e`): a group event freezing a
react-in-place participant mid-transit **inside furniture** left it standing there for the event's
duration, tripping both `offFloorRest` and — because it landed 25px from `gate` at its HOME —
`sustainedStack`.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-16 | `hotfix`; Protected Surface (position semantics) |
| plan | done | 2026-08-16 | MFR-first; clamp before side-step at both chokepoints |
| implement | done | 2026-08-16 | 2 call sites; RED→GREEN proven |
| review | done | 2026-08-16 | 5-lens panel + 4-lens game-design pass |
| test | done | 2026-08-16 | 2309/2309 + 4× soak + visual |
| ship | done | 2026-08-16 | — |

---

## Phase Summary

- **Three successive root causes, the first two wrong — recorded because the correction pattern is
  the lesson.** (1) "the fallback lacks `clampToFloor`" — wrong, `avoidOverlap` clamps internally.
  (2) "the agent is off the walkable floor" — wrong, `isOnFloor(89,103)` is **true**; the soak's
  `offFloor` flag is `!isOnFloor || isOnObstacle`, so it was standing *inside furniture*. (3) The
  actual cause: the react-in-place branch validated the resting spot **only when the frozen agent
  happened to overlap another agent**; with nobody nearby it left `groupTarget` null and froze the
  agent exactly where it stood. Each correction came from reading code/instruments rather than from
  re-asserting the previous guess. | Confidence: 95%.
- Fix: clamp first, then side-step, at both chokepoints — mirroring the adjacent `groupTarget`
  branch. **No-op for an already-valid position** (pinned by a third test), so this is not
  "nudge everyone". `clampToFloor` itself is untouched: transit-time furniture clipping remains the
  accepted trade-off (AVO-183a).
- **Expert panel (5 lenses) + game-design pass (4 lenses)**: unanimous keep. The decisive argument
  is UI/UX — an agent half-buried in a desk is the single most obviously-wrong thing on a small
  ambient screen and it persists for the whole event, whereas the correction is a sub-second 11px
  shuffle that adds no new visual vocabulary.
- **A measurement I refused to use.** An in-page probe reported "0 hits / 73 moving samples", but it
  had only run ~6 s of the intended 200 s — the Browser pane freezes timers when hidden. Reporting
  that as "0%" would have been a false all-clear. Replaced with a bound from real constants:
  `DAILY_EVENT_INTERVAL [60s,180s]` + `SEED_COOLDOWN_MS 120s` ⇒ **upper bound of one 11px shuffle
  per 1–3 min**, and far less in practice (gather events carry a `groupTarget` and never reach this
  path). Negligible against the ambient out-trip rate the owner actually notices.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-16T12:00:00+08:00
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-16T12:10:00+08:00
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-16T12:30:00+08:00
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-16T13:05:00+08:00
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-16T13:20:00+08:00
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-16T13:40:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| CI | sim-soak run 31925068076 | the catch, on `main` `cb6a76e` |
| PR | https://github.com/KbWen/agent-virtual-office/pull/214 | this fix |
| Code | `src/systems/store.js` (both group-event chokepoints) | the two call sites |
| Test | `tests/reactInPlaceRestValidity.test.js` | MFR, RED before the fix |

---

## Known Risk

- **R1 exposure widened, and the guarantee was already weaker than the code claims.** The comment at
  the fixed site says "R1-safe: pickParticipants never selects tracked working/blocked agents", but
  `pickParticipants` falls back to **all** agent ids when fewer than 2 are available
  (`available.length >= 2 ? available : agentIds`, twice). So a genuinely-working agent CAN be taken
  over by an event, and this fix can now move it 11px. **Pre-existing hole, not introduced here** —
  the overlap branch could already relocate such an agent. Filed to the backlog rather than fixed
  inside a hotfix.
- **Sub-5px invalid rests are still not corrected.** `AgentCharacter.jsx`'s `sameSpot` guard
  (`< 5px`) means a shallow furniture overlap produces no journey. Pre-existing mechanism limit;
  the fix is not 100% coverage and is not claimed to be.

---

## Red Team Findings

### RT-1 (accepted) — "you widened R1 to fix a cosmetic issue"

Strongest counter-argument raised in review. Rejected on the grounds that ADR-005 governs **user**
repositioning of agents (`position = state` honesty against human interference), whereas this is the
system moving an agent out of a physically impossible spot after an event has already taken it over.
Standing inside a desk is itself a position-lie, and the larger of the two. The real R1 hole is the
`pickParticipants` fallback (see Known Risk), which exists with or without this change.

---

## Conflict Resolution

none

---

## Drift Log

- Skip Attempt: NO · Gate Fail Reason: N/A · Token Leak: NO
- Two root causes stated publicly before the correct one was established. Both were withdrawn with
  the evidence that refuted them rather than quietly replaced.
- Recovered stale Work Log lock on 2026-08-16T07:19:15.238978+00:00; prior_owner=KbWen; prior_session=2026-08-16T12:00:00+08:00; reason=stale-time; lock=hotfix-offfloor-sidestep-clamp.lock.json

---

## Evidence

- **MFR RED before fix**: `tests/reactInPlaceRestValidity.test.js` → 2 failed / 1 passed, both
  failures `rests inside furniture at (89,103): expected true to be false`, on
  `setAgentGroupEvent` and `setMultipleAgentGroupEvents`. GREEN after: 3/3.
- Probe of the caught coordinate: `(89,103)` → `isOnFloor=true`, `isOnObstacle=true`,
  `clampToFloor → (78,103)`, `obstacleAfterClamp=false`.
- `tests/agentSeparationInvariants.test.js` **9/9 unchanged** (agent-vs-agent half untouched).
- Full suite **115/115 files, 2309/2309 tests** (+1 file, +3 tests). Build PASS; bundle
  **496,263 bytes**, budget gate PASS at −0.05%.
- `sim-soak` on this branch: **4 × 10 min, all green**. Weighted honestly as corroboration only —
  at the observed ~25 % hit rate, 4 clean runs have **p ≈ 0.32** under the null hypothesis, so the
  load-bearing evidence is the deterministic MFR, not this.
- Visual: headless capture at 1200×820 shows the office intact; `render-smoke` PASS across 4
  viewports, 0 pageerrors, 0 console errors.
