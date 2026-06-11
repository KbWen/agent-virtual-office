# Work Log: fix/wedged-endpoint-routing

## Header

- Branch: `fix/wedged-endpoint-routing`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5`
- Guardrails Mode: `Quick`
- Current Phase: `implement`
- Checkpoint SHA: `7239e9a`
- Recommended Skills: `none`
- Primary Domain Snapshot: `office-runtime/movement`
- SSoT Sequence: `77`

---

## Session Info

- Agent: `claude-fable-5`
- Session: `2026-06-11 12:30 UTC`
- Platform: `claude-code`

---

## Task Description

Issue #27 (confirm-first, owner-directed): harden `calculatePath` for endpoints wedged against furniture (< 8px — the band the fuzz test deliberately excludes). Probe CONFIRMED the defect is real and reaches the everyday path: wedge distances 1–7px produce ~5% desk-crossing routes (40–52 of ~880 pairs), including d=6 = `OBSTACLE_PUSH_PX`, the exact standoff `clampToFloor` emits. Root cause: desk-canyon endpoints are unreachable from the 9 fixed Dijkstra nodes → `findSafePolyline` returns null → `routeWithinMainOffice` last-resort emits `[CORRIDORS[2], to]` (self-documented hole). Same class in `routeWithinLounge` (lane descent column crosses top-side wedges).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; SSoT read in-session; issue body + probe characterization |
| plan | done | 2026-06-11 | Fix A: findSafePolyline node augmentation (wedge-escape candidates, never-worse). Fix B: lounge clearColumn per research precedent. Regression matrix incl. d=6. |
| implement | done | 2026-06-11 | wedgeEscapeNodes (Dijkstra augmentation) + lounge two-lane graph w/ convex-rect gate + lane fallback. |
| review | done | 2026-06-11 | Fresh adversarial (no implementer context): NOT READY → 1 HIGH (lounge graph emitted off-floor diagonals for door-strip endpoints, 104/720 measured) → fixed with reviewer's minimal gate; counterexample pinned ×25. Findings 3–7 all verified-PASS incl. never-worse in mainOffice, node legality, test honesty, perf. |
| test | done | 2026-06-11 | Suite 1905 → 1912 (+7). Probe matrix 52/880 → 0/880 every d∈1..7. 2-min soak PASS pre-gate (469 samples, 0 violations) + final soak on gated code. |
| ship | done | 2026-06-11 | PR + SSoT + archive same PR; issue #27 closed with evidence. |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T12:20:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T12:30:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T12:55:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T13:15:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T13:20:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T13:30:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Issue | https://github.com/KbWen/agent-virtual-office/issues/27 | wedged-endpoint hardening |
| ADR | docs/adr/ADR-004-no-per-frame-agent-separation.md | routing-time fix, not per-frame — compliant |

---

## Known Risk

- `movementSystem.js` is a protected surface — change is algorithmic-additive only (no coordinate edits): escape nodes are EXTRA Dijkstra candidates validated by the existing edge checks; lounge columns reuse the shipped research `clearColumn` pattern. Both degrade to exactly today's behavior when no candidate validates.
- Rollback: revert the single commit; fallback paths preserved verbatim.

---

## Drift Log

none

---

## Evidence

- Probe (temp `tests/__probe27.test.js`, seeded mulberry32): pre-fix violations by wedge distance — d=1: 52/880, d=2: 52/880, d=4: 40/850, d=6: 44/870, d=7: 44/870; endpoint-slack 8px does NOT remove them (mid-segment crossings). Sample: (60,300)→(224,238) [archDesk west canyon] crosses archDesk at (254.7,259.0) via path [(300,290),(224,238)] — the last-resort relay.
- Post-fix probe: 0 violations across the entire matrix (every d, both slacks). Probe file deleted after characterization.
- Regression suite `tests/movementPathingWedged.test.js` (7 tests): sensitivity PROVEN — 5/5 wedge-distance tests FAIL pre-fix (reviewer independently reproduced 154/3516 on HEAD, 0/3516 post-fix); door-strip gate counterexample (218,418.5)→(430,470) pinned ×25 + 16+ pair grid.
- Full suite 1912/1912 pass; `npm run soak -- --minutes 2` PASS (469 samples, 0 invariant violations).
- Fresh review verdict after fix: HIGH resolved via reviewer's own minimal-fix option (convex-rect gate); Finding 2 (PRE-EXISTING early-return door-strip gap, 130/720, identical old/new) spawned as follow-up chip task_2b246e48.
