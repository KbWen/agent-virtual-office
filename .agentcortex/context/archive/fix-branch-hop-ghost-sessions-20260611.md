# Work Log: fix/branch-hop-ghost-sessions

## Header

- Branch: `fix/branch-hop-ghost-sessions`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `1d76e6a`
- Recommended Skills: `none`
- Primary Domain Snapshot: `hook-io`
- SSoT Sequence: `63`

---

## Session Info

- Agent: `claude-fable-5` (coordinator-implemented after a course-correction)
- Session: `2026-06-11 07:00 UTC`
- Platform: `claude-code`

---

## Task Description

Owner-reported live bugs: (1) characters suddenly yanked to the TOP of the screen; (2) characters
vanish then reappear. Root cause: the hook's session slug embeds the git BRANCH → a mid-session
`git checkout` strands the old slug file, fresh for up to the scanner's 5-min window →
scanSessions merges the same checkout as TWO sessions → composite `slug~role` ghosts spawn at
OVERFLOW slots (top hallway, y≈50–80) and evict when the stranded file goes stale. 43 ghost files
had accumulated in ~/.claude during today's 16-branch session.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; root cause proven empirically (overflow coords y=50-80 = "top") |
| plan | done | 2026-06-11 | gate PASS in chat |
| implement | done | 2026-06-11 | COURSE-CORRECTED: scanner-side dedup attempt broke 11 multi-session tests → reverted; hook-side self-cleanup chosen |
| review | done | 2026-06-11 | fresh reviewer (deletion behavior + hook liveness) |
| test | done | 2026-06-11 | 1818/1818 (+8); LIVE proof on the real machine |
| ship | done | 2026-06-11 | SSoT seq 64; self-archived in same PR |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T07:00:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T07:02:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T07:25:00Z | +8 tests; live-proven
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T07:40:00Z | fresh reviewer: 8-point burden ALL PROVEN; mutation test executed (flip _cwd guard → collision test fails); wrongful deletion structurally impossible; Windows casing mismatch fails toward KEEP; 1 LOW advisory (test-isolation note)
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T07:42:00Z | 1818/1818; live 43→1 proof
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T07:45:00Z | SSoT seq 64

---

## Changes

- `public/hooks/office-status-hook.js` — `cleanupGhostAliases()` called at processEvent top:
  readdir prefilter on the filename's 4-hex cwd-hash suffix, then PARSE-PROOF
  `_cwd === process.cwd()` before unlink (hash-collision guard); bare file never touched;
  fully try/catch'd; exported for tests.
- `tests/hookGhostCleanup.test.js` (+8): delete same-suffix+same-cwd · keep different-cwd
  (collision guard) · keep different-suffix · bare untouched · own-file untouched · malformed
  tolerated · env-override skip · processEvent end-to-end.

---

## Evidence

- LIVE on the real machine: ~/.claude went from **43 ghost files → 1** (current branch only)
  the moment this session's next hook event fired (the hook runs from the working tree);
  GET /api/status: 4 agents, **0 composites**, single-session source.
- Suite 1810 → **1818** (+8); build + render-smoke green.

---

## Test Gate Results

- 1818/1818; ghost-cleanup suite 8/8; live verification above.

---

## Drift Log

- ADR Coverage Check: hook I/O hygiene, no boundary → no ADR.
- COURSE CORRECTION recorded: first attempt deduped same-_cwd sessions in scanSessions — broke
  11 multi-session merge tests AND would have killed the shipped merge machinery via the side
  door (strict pass admits only same-cwd sessions in production, so the scanner-side dedup made
  multi-session unreachable). Reverted; the honest discriminator lives hook-side: one checkout =
  one HEAD, so a slugged sibling claiming OUR cwd is provably our own pre-switch alias.

---

## Phase Summary

- Owner bugs (top-yank + vanish/reappear) root-caused to branch-hop ghost sessions; fixed at the
  SOURCE (hook self-cleans pre-switch aliases, parse-proof before unlink); scanner untouched;
  live-proven 43→1 files + 0 composites. ⚡ ACX
