# Work Log: feat/office-rhythm-measurement

## Header

- Branch: `feat/office-rhythm-measurement`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `2375478`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion, red-team-adversarial`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `120`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 05:30 UTC`
- Platform: `claude-code`
- Files Read: `60`

---

## Task Description

Graduate this session's throwaway measurement harness into the repo so the *analysis* — the half
that is hard and was living only in a scratch directory — is reusable. Adds a pure rhythm-analysis
module, a hermetic runner, and the dev-server flag that makes hermeticity real rather than nominal.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | prompted by "確認這個基底也是讓人可以重複利用的" — the base was NOT reusable |
| plan | skipped | - | quick-win fast-path |
| implement | done | 2026-09-02 | pure module + runner + `OFFICE_DISABLE_FILE_WATCHER` + docs |
| review | pending | - | - |
| test | done | 2026-09-02 | 17 unit tests, mutation-verified; runner proven end-to-end twice |
| handoff | n/a | - | quick-win exempt |
| ship | done | 2026-09-02 | merged as PR #225; SSoT Ship History + this archive + INDEX.jsonl chain entry |

---

## Phase Summary

**bootstrap** — the gap was real: everything that made this session's conclusions possible (the
exact independent model, the stale-label detector, the hermetic sampling) lived in a session
scratch directory. Only the soak's `OFFICE_STATUS_DIR` fix had reached the repo. The analysis would
have been lost.

**implement** — checked for prior art before adding anything, and found some: `zone-audit.mjs`
already samples rendered transforms and reports simultaneous-walker share. So this does NOT
duplicate it. What is genuinely new is (a) the exact Poisson-binomial *independent model*, without
which a stillness percentage cannot be interpreted at all, (b) stale-label detection (AVO-195), and
(c) isolation that does not touch the operator's files. `zone-audit`'s `--organic` achieves
isolation by RENAMING the real `~/.claude/office-status*.json` and restoring them in an exit
handler — a hard kill strands them. That hazard is now documented in the script and the README,
pointing at the safe path rather than silently competing with it.

**the hermeticity claim was wrong, and the tool caught it on its first real run** — see Evidence.
`OFFICE_STATUS_DIR` alone is NOT enough. `vite.config.js` registers a file-watcher fallback that
manufactures agent status from edits to the PROJECT ITSELF and writes it into whatever status dir
it was given. `OFFICE_DISABLE_FILE_WATCHER=1` is added with the same blast radius as its
`OFFICE_STATUS_DIR` precedent (`configureServer` only; never reaches a built or packaged office).

**This means PR #221's isolation claim is incomplete** and is being corrected on that branch rather
than left to ship as written.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T05:35:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T05:55:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | - | tooling quick-win |
| ADR | - | - |
| Issue | docs/specs/_product-backlog.md AVO-195 | the stale-label detector is this ticket's measurement half |
| PR | https://github.com/KbWen/agent-virtual-office/pull/221 | its isolation claim is corrected as part of this work |

---

## Known Risk

- **R1 — a third overlapping tool.** Checked rather than assumed: `zone-audit.mjs` covers zone
  occupancy and room visits, this covers the independent model and stale labels. Neither is a
  superset. The README now states which to reach for, and the redundant-and-dangerous `--organic`
  path is deprecated in place rather than deleted (it still works for a reused `:5173`).
- **R2 — a hermetic claim that is not.** Realised, then fixed: the first run aborted on real
  contamination. The guard is what turned an overclaim into a finding.
- **R3 — quoting an unreproducible number.** The stillness LEVEL varies run to run (1.4% / 11.8% /
  13.8% measured). Both the module's report and the README carry the caveat inline, and a test
  asserts the caveat is present in the formatted output so it cannot be quietly dropped.

---

## Decisions

### D-1: report, never gate

- **Decision**: `office-rhythm` exits 0 whenever it measured, and 1 only when it could NOT measure.
- **Reason**: a rhythm threshold is a product judgement, not a correctness one, and the level is not
  reproducible enough to gate on. `sim-soak` remains the gate for correctness.
- **Alternatives**: fail on a negative gap (rejected — would fail `main` today, which is the very
  thing under discussion rather than an agreed defect).

### D-2: deprecate `zone-audit --organic` in place rather than delete it

- **Decision**: keep it working, warn at runtime and in the README.
- **Reason**: it is the only isolation available when reusing a live `:5173`, which this tool does
  not support. Deleting it would remove a capability; warning preserves it honestly.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Scope grew by one file (`vite.config.js`) after the first real run proved `OFFICE_STATUS_DIR`
  insufficient. Surfaced rather than absorbed silently, and it invalidates a claim in an already-open
  PR (#221), which is being corrected rather than left.

---

## Review Feedback

none

---

## Red Team Findings

- The tool's own hermeticity claim was false on first run. It was caught by the tool's assume-failure
  guard rather than by review, which is the argument for that guard existing.

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

- `npx vitest run` — **2336 passed / 117 files / 0 failed** (baseline 2319; +17).
- **Mutation-verified in two directions.** Replacing the pixel-delta motion test with the `moving`
  store flag fails **6** tests — the rendered-truth discipline is genuinely enforced, not just
  commented. Removing the `!a.group` guard from stale detection fails the group-event exemption.
  Restored, 17 pass.
- `npm run build` PASS; `bundle-budget` PASS at 495983 vs baseline 496504 (**-0.10%**).

---

## Evidence

- **Run 1 (the useful failure).** `node scripts/office-rhythm.mjs --minutes 3` with only
  `OFFICE_STATUS_DIR` isolated aborted: `run was NOT hermetic — external agent status arrived
  during sampling (dev, res)`. Cause traced to `vite.config.js` `fileWatcherFallbackPlugin`, whose
  `server.watcher.on('change')` maps any edited project file to a role via `fileToRole`. Tests and
  docs were being edited beside the run.
- **Run 2 (clean, both isolations, no files touched during sampling).** 705 intervals, 8 agents:
  `stillness 13.8% vs independent 24.2% -> gap -10.4 pts (trips SPREAD into the quiet gaps)`,
  `>=3 moving 0.4% vs independent 10.4%`, `motion CV 0.68`, `dead frames 0.3%`,
  `stale labels none over 90s`.
- **Third independent reproduction of the session's core finding.** Stillness gap across three
  hermetic runs on unmodified `main`: **-10.5, -12.3, -10.4**. Stillness LEVEL across the same three:
  **11.8%, 1.4%, 13.8%**. The gap reproduces; the level does not — which is exactly the caveat the
  tool prints, now demonstrated rather than asserted.
- Stale-label threshold does not false-positive on healthy `main`: `none over 90s`, against the
  74-78s worst case measured earlier and the 254s the rejected prototype produced.
