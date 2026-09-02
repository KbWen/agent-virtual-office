# Work Log: fix/rhythm-record-run-context

## Header

- Branch: `fix/rhythm-record-run-context`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Lite`
- Current Phase: `ship`
- Diff Base SHA: `338fcde`
- Checkpoint SHA: `097a4b1`
- Recommended Skills: `verification-before-completion, red-team-adversarial`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `121`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 06:00 UTC`
- Platform: `claude-code`
- Files Read: `64`

---

## Task Description

Self-correction on a metric shipped hours earlier in #225 and on the claim made about it in the
Ship History: the absolute stillness point-gap is not comparable across runs at different motion
levels. Record run context (`mood` / `hour`) and report a comparable ratio.

**Written retroactively at closure** — this branch was opened as an immediate correction to a
just-merged defect and no log was created up front. Recorded here rather than skipped, because a
shipped quick-win without a log is exactly the gap this file exists to close.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | triggered by a run that failed to reproduce a claim I had already shipped |
| plan | skipped | - | quick-win fast-path |
| implement | done | 2026-09-02 | ratio metric + run context + three docs surfaces corrected |
| review | done | 2026-09-02 | self-review; two candidate explanations tested and rejected before touching the metric |
| test | done | 2026-09-02 | +1 test pinning the arithmetic bound; suite 2357 |
| handoff | n/a | - | quick-win exempt |
| ship | done | 2026-09-02 | merged as PR #227 (squash `097a4b1`) |

---

## Phase Summary

**bootstrap** — #225 shipped claiming the stillness gap was "a third independent reproduction" at
`-10.5 / -12.3 / -10.4`. Two further runs on merged `main` did not reproduce it: 8 minutes at
`-0.5` (mean motion 21.1%) and 1 minute at `-3.7` (motion 23.5%), against the baselines' 16.8%.

**review** — two explanations were tried and **both were rejected on evidence** before any code
changed, which is what turned this from an interpretation argument into a metric fix.
*Time-of-day*: refuted — the 8-minute run sat at hour 13, outside every `getHourModifiers` window,
exactly like the `-10.5` baseline at hour 9. *Office mood*: insufficient — mood genuinely swings
the ambient out-trip share 26% (`normal`) → 35% (`idle`) → 40% (`smooth`) and genuinely was not
being recorded, but the 1-minute run recorded `mood: normal` and still showed 23.5% motion.

**implement** — the defect is in the metric. An absolute point-gap is **bounded by** the independent
level: at 16.8% mean motion independent stillness is 22.3% and a `-10` point gap is possible; at
23.5% it is 9.2% and the same gap is arithmetically impossible. Two equally-spread offices at
different motion levels report very different gaps, so the four runs that looked contradictory were
never comparable. `stillnessRatio` (observed / independent) now drives the SPREAD / near-independent
/ CLUSTER verdict; the runner records `mood`, `hour` and agent count in both the printed output and
the report JSON; README, the module header and the #225 Ship History entry were all corrected to say
the same thing rather than leaving the old claim standing in three places.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:05:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:20:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:35:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | - | corrective quick-win |
| ADR | - | - |
| Issue | - | - |
| PR | https://github.com/KbWen/agent-virtual-office/pull/227 | merged 2026-09-02 |
| PR | https://github.com/KbWen/agent-virtual-office/pull/225 | the shipped defect this corrects |

---

## Known Risk

- **R1 — correcting the wording instead of the metric.** Actively avoided: the two interpretation
  candidates were tested and rejected first, so the change is arithmetic rather than rhetorical.
- **R2 — a third overclaim.** The finding's status is now stated as **not established** rather than
  re-scoped to a narrower claim that would need its own defence: by ratio the four runs read
  0.53 / 0.10 / 0.97 / 0.61, still unstable.

---

## Decisions

### D-1: correct the #225 Ship History entry rather than add an eighth entry

- **Decision**: the correction is written into the entry it corrects; no separate Ship History entry
  for this branch.
- **Reason**: a reader who finds the original claim must find the correction in the same place. A
  separate entry would leave the false claim standing in isolation and force the reader to assemble
  two records. It also avoids rotating an unrelated entry out of the cap to make room.
- **Alternatives**: an eighth entry (rejected, above); silent edit (rejected — the entry now says
  explicitly that it was corrected, and why, twice).
- **Impact**: `current_state.md` Ship History, `Ship-feat-office-rhythm-measurement-2026-09-02`.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- This log was written at closure rather than at bootstrap. Surfaced, not hidden.
- The SSoT was corrected **twice** in one session: the first correction over-attributed the
  discrepancy to office mood and had to be corrected again once a `mood: normal` run still failed to
  match. Both passes went through `guard_context_write.py` and both were verified by re-reading.

---

## Review Feedback

none

---

## Red Team Findings

- A metric that cannot compare two runs is worse than no metric, because it produces confident
  numbers. This one shipped and was used to make a claim in the SSoT before the flaw was found.

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

- `npx vitest run` — **2357 passed / 119 files / 0 failed** (+1).
- The new test is the point: it builds a light-motion and a heavy-motion office, asserts the heavy
  one **cannot** show the light one's point gap (arithmetic, not behaviour), and asserts the ratio
  calls both spread.
- `npm run build` PASS; `bundle-budget` PASS at 496392 vs baseline 496504 (**-0.02%**).
- `validate.ps1` exit 0, `pass=114 warn=5 fail=0 skip=5`.

---

## Evidence

- Non-reproduction, merged `main`: 8 min → `stillness 14.1% vs independent 14.5%, gap -0.5`, mean
  motion 21.1%; 1 min → `5.6% vs 9.2%, gap -3.7`, mean motion 23.5%, `run context mood=normal hour=13`.
- Baselines, pre-merge, both `mood: normal`: `11.8% vs 22.3%` and `1.4% vs 13.7%`, mean motion 16.8%.
- The bound that explains it: independent stillness is 22.3% at 16.8% motion and 9.2% at 23.5%, so a
  `-10` point gap is available in one regime and impossible in the other.
- By ratio: 0.53 / 0.10 / 0.97 / 0.61 — reported so the instability is visible rather than hidden
  behind a number that moves for arithmetic reasons.
