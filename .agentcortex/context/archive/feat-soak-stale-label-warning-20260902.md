# Work Log: feat/soak-stale-label-warning

## Header

- Branch: `feat/soak-stale-label-warning`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `e27b48a`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion, red-team-adversarial`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `123`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 07:00 UTC`
- Platform: `claude-code`
- Files Read: `70`

---

## Task Description

Implement the detection half of AVO-195: the soak gate cannot see an agent whose displayed activity
went stale, because all four invariants read position and the `moving` flag and none reads
`behavior`. Lands as a non-failing warning plus an always-printed observed maximum.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | AVO-195, filed earlier the same day with the measured range |
| plan | skipped | - | quick-win fast-path |
| implement | done | 2026-09-02 | detector moved into `soakInvariants`, shared with `officeRhythm` |
| review | done | 2026-09-02 | self-review; two designs rejected on evidence |
| test | done | 2026-09-02 | +5 tests, mutation-verified; two real soak runs |
| handoff | n/a | - | quick-win exempt |
| ship | done | 2026-09-02 | closure in this same PR — a single branch, so no chain collision |

---

## Phase Summary

**implement** — the detector lives in `soakInvariants.mjs`, not in `officeRhythm.mjs` where it was
first written, and `officeRhythm` now imports it. Dependency direction on purpose: a gate should not
import from a report module. One definition, one threshold, and a mutation proves the sharing is
real — removing the group-event exemption fails a test in BOTH files.

**review — two designs were rejected on evidence, not taste.**

*First design: threshold 90s.* Set from control runs whose worst case was 74-78s. It
**false-positived on the very first real soak**, flagging `arch` at 100.5s and `designer` at 94.9s
on healthy `main`. A number fitted to a small sample is not a threshold.

*Second design: flag only event-set behaviours.* The reasoning was that `doSchedule` never picks
`eat-snack` / `nap` / `stretch`, so holding one is anomalous by construction. **Measured and
refuted**: those behaviours are all in the `doSchedule` pools, and of the twelve behaviours the
event handlers set, only `meeting` is event-only. The behaviour name cannot separate the two cases.

*Shipped design.* The threshold is derived from the ceiling instead: a behaviour lasts at most 65s
and a walk adds ~10-20s, so two consecutive identical picks reach ~170s — `pickBehavior` CAN pick
the same behaviour twice because the anti-repeat ring guards messages, not behaviours. **180s**
therefore requires three consecutive identical picks to fire legitimately. The limitation is
documented in the module rather than papered over: this is a smoke signal, not a proof, which is
why it warns rather than fails, following the `groupStack` warn-then-promote precedent.

`maxStaleLabelMs` is printed **every run regardless of the threshold**, because a binary verdict
hides the trend — on healthy `main` it reads 57-99s against the 254s that motivated the check.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T07:05:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T07:20:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T07:30:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | - | quick-win |
| ADR | - | - |
| Issue | docs/specs/_product-backlog.md AVO-195 | detection half; the row is marked Shipped here |
| PR | - | this branch |

---

## Known Risk

- **R1 — a false-positive gate.** Realised on the first real run at the 90s threshold, which is why
  the shipped number is derived from the behaviour-duration ceiling and why this warns rather than
  fails. Verified after the change: a real 3-minute soak reports `staleLabel: []` with an observed
  maximum of 98.6s, and a 1-minute soak prints `57s` and PASSes.
- **R2 — the new sampled field degrading coverage.** Ruled out by control: a 1-minute soak with
  `beh` sampling returns **236/240 samples, sufficient=true, PASS** — unchanged from before.
- **R3 — mistaking this signal for proof of a stuck scheduler.** It is not, and the module says so:
  an unchanged label cannot be distinguished from repeated identical picks.

---

## Decisions

### D-1: warn, do not fail

- **Decision**: `staleLabel` is a warning; the soak's exit code is unaffected.
- **Reason**: the evidence that it does not false-positive is a handful of runs, and it already
  false-positived once. `groupStack` is the repo's own warn-then-promote precedent.
- **Impact**: `soakInvariants.warnings`, `sim-soak` output.

### D-2: report the observed maximum every run

- **Decision**: `maxStaleLabelMs` prints regardless of the threshold.
- **Reason**: a threshold answers one question badly; the number answers it well. Healthy `main` at
  57-99s versus 254s is legible without any verdict at all.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- The detector was written in `officeRhythm.mjs` earlier the same day and is MOVED here rather than
  copied. `officeRhythm` re-exports `REST_STEP_PX` / `STALE_LABEL_MS` so its callers are unaffected.

---

## Review Feedback

none

---

## Red Team Findings

- The first threshold was fitted to the sample that motivated it and failed on first contact with a
  real run. Recorded because the failure mode — deriving a limit from the data that suggested the
  problem — is easy to repeat.

---

## Design Reference

none

---

## Observability

none

---

## Resume

none

---

## Test Gate Results

- `npx vitest run` — **2362 passed / 119 files / 0 failed** (+5).
- Mutation-verified twice: unwiring the detector from `evaluateSoak` fails the warning test;
  removing the group-event exemption fails a test in **both** `soakInvariants.test.js` and
  `officeRhythm.test.js`, which is what proves they share one definition.
- `npm run build` PASS.

---

## Evidence

- Real 3-minute soak, hermetic: `staleLabel: []`, `maxStaleLabelMs: 98627` (98.6s), 0 violations.
  The rejected 90s threshold would have fired here; 180s does not.
- Real 1-minute soak: `sim-soak INFO longest unchanged behaviour label outside an event: 57s` then
  `sim-soak PASS — 236 samples`, coverage `sufficient: true`.
- The 3-minute run exits non-zero on a **pre-existing** coverage gate (`706 < 715`), unrelated to
  this change: `allowedMisses` is `max(5, ceil(expected * 0.005))`, a flat 5 below 1000 expected
  samples, so the gate tightens as duration grows — 5/240 (2.1%) at one minute versus 5/720 (0.7%)
  at three. The report JSON is written before that throw, which is how the numbers above were read.
  Left alone deliberately: it is not this change's defect and fixing it needs its own unit.
