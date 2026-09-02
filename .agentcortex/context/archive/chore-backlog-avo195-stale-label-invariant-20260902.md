# Work Log: chore/backlog-avo195-stale-label-invariant

## Header

- Branch: `chore/backlog-avo195-stale-label-invariant`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Lite`
- Current Phase: `ship`
- Diff Base SHA: `2375478`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `120`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 05:00 UTC`
- Platform: `claude-code`
- Files Read: `56`

---

## Task Description

File AVO-195: `sim-soak` has no invariant for a stale behaviour label, so the office can narrate the
wrong activity for minutes and the gate cannot see it. Backlog row only — no code.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | gap exposed by a rejected prototype on `experiment/ambient-rhythm-window` |
| plan | skipped | — | quick-win fast-path; row only |
| implement | done | 2026-09-02 | one table row |
| review | pending | — | — |
| test | done | 2026-09-02 | validator clean |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-09-02 | merged as PR #224; SSoT Ship History + this archive + INDEX.jsonl chain entry |

---

## Phase Summary

**implement** — one row. The row is written to be actionable rather than a note: it carries the
measured healthy range from two control runs (event-set behaviours clear in 2–27s, longest
unchanged label 74–78s) so whoever picks it up already has the threshold, and it states plainly
that this is a DETECTION gap rather than a live `main` defect, so nobody re-derives that.

Why the four shipped invariants miss it: `teleport`, `sustainedStack`, `frozenWalker` and
`offFloorRest` all read POSITION and the `isMoving` flag; none reads `behavior`. In the observed
case `isMoving` was `false` for the whole 254s, so `frozenWalker` — which requires the flag to be
TRUE while pixels are still — could not fire by construction, and the position-based checks saw a
perfectly healthy walker. The gate was not wrong; it was blind to this axis.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T05:02:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T05:06:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | — | row only |
| ADR | docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md | narrating the wrong activity is this class |
| Issue | docs/specs/_product-backlog.md AVO-195 | the row added here |
| PR | — | — |

---

## Known Risk

- **R1 — off-mission infra creep.** Weighed rather than waved through: this is a guard on status
  legibility, which the product treats as its core value, not observability tooling. It adds no
  user-facing surface. If it were framed as "more soak metrics" it would be off-mission under
  ADR-006; framed as "the office must not narrate the wrong activity" it is on-mission.

---

## Decisions

none

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

none

---

## Review Feedback

none

---

## Red Team Findings

none

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

- `validate.ps1` — exit 0, `pass=114 warn=5 fail=0 skip=5`, unchanged by the row.

---

## Evidence

- Observed case: `res`, `gate`, `designer` held `eat-snack` for the identical t=133–391s window
  with `isMoving` false for 100% of samples and rendered `positionSpan` 260–551px.
- Healthy range from two control runs on `main`: event-set behaviours cleared in 2s / 3s / 4s /
  23s / 27s; longest unchanged label 74s and 78s.
- Therefore a threshold near 90s separates the two populations without touching anything `main`
  currently produces.
