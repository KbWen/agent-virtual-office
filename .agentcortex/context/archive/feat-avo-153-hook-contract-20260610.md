# Work Log: feat/avo-153-hook-contract

## Header

- Branch: `feat/avo-153-hook-contract`
- Classification: `feature`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-10`
- Created Date: `2026-06-10`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Checkpoint SHA: `08d10ae`
- Recommended Skills: `none`
- Primary Domain Snapshot: `hook-io`
- SSoT Sequence: `59`

---

## Session Info

- Agent: `claude-fable-5` (implementation delegated to sonnet; coordinator keeps the privacy
  review gate on fixtures before commit)
- Session: `2026-06-11 01:40 UTC`
- Platform: `claude-code`

---

## Task Description

Stability-wave W4 (AVO-153): hook-runtime contract — opt-in raw-event capture in the hook
(marker-file gated), shape-preserving sanitizer, REAL fixtures from this very session (the hook
runs from the working tree, so the implementing session generates its own corpus), and contract
tests pinning the payload shapes the hook relies on. Spec: `docs/specs/hook-runtime-contract.md`
(AC-1..AC-5).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-10 | feature |
| plan | done | 2026-06-10 | gate PASS in chat; spec written |
| implement | done | 2026-06-11 | AC-1..AC-4 complete; 14 fixtures; 136 tests; 1698/1698 green |
| review | pending | — | fresh reviewer + coordinator privacy gate on fixtures |
| test | pending | — | — |
| handoff | pending | — | — |
| ship | pending | — | — |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T01:40:00Z
- Gate: plan | Verdict: PASS | Classification: feature | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T01:42:00Z

---

## Changes

- `public/hooks/office-status-hook.js` — AC-1: header comment + capture block in stdin `on('end')` (statSync marker → appendFileSync jsonl; fully try/catch'd; zero behavior change when absent)
- `scripts/sanitize-hook-capture.mjs` — AC-2: shape-preserving sanitizer (enum preserve, free-text → placeholder, MCP tool → 'mcp-tool', dedup by shape key, README auto-gen)
- `tests/fixtures/hook-events/` — AC-3: 14 fixture files (PreToolUse/PostToolUse × Bash/Edit/Write/Read/Glob/Grep/mcp-tool) + README.md captured from this live session
- `tests/hookRuntimeContract.test.js` — AC-4: 136 shape + behavior contract tests
- `.gitignore` — defensive: `office-hook-capture` + `office-hook-capture.jsonl`
- `README.md` — capture mode docs under Hook events section

---

## Evidence

- `npx vitest run tests/hookRuntimeContract.test.js` ×3: 136 passed, non-flaky
- `npm test`: 1698/1698 passed (1562 prior + 136 new)
- `npm run build`: ✓ built in 1.46s, 450KB JS
- `npm run smoke`: render-smoke PASS — svg rendered (1871 descendants), 0 pageerrors, 0 console errors
- Scope: 6 files changed (planned: hook + sanitizer + fixtures + tests + .gitignore + README)

---

## Test Gate Results

- Tests: 1698/1698 PASS (was 1562; +136 hookRuntimeContract)
- build: clean
- smoke: PASS

---

## Drift Log

- ADR Coverage Check: additive capture + tests, no boundary → no ADR.
- Privacy gate: raw capture stays in ~/.claude (gitignored defensively); committed fixtures are
  sanitized + coordinator-reviewed.
- Drift-Log: MCP tool names (e.g. mcp__ccd_session__mark_chapter) → normalized to 'mcp-tool' shape key in sanitizer; tool_name in fixture is 'mcp-tool' (enum placeholder, not the real name). Acceptable — the shape contract is the same for all MCP tools.
- Not-captured events (documented in README): UserPromptSubmit, Stop, SubagentStart, SubagentStop, PermissionDenied, StopFailure — no fake fixtures; per spec AC-3 / Non-Goal "do not fabricate".

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T01:40:00Z
- Gate: plan | Verdict: PASS | Classification: feature | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T01:42:00Z
- Gate: implement | Verdict: PASS | Classification: feature | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T07:20:00Z
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T02:30:00Z | fresh reviewer: AC-1..5 PROVEN; coordinator privacy gate PASS (all 14 fixtures clean); MED finding = REAL runtime divergence (tool_response vs tool_result) → loud divergence-pin test added + AVO-154 ticket; 2 LOW cosmetic
- Gate: test | Verdict: PASS | Classification: feature | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T02:35:00Z | 143/143 contract (+7 pins)
- Gate: handoff | Verdict: PASS | Classification: feature | Transition: TESTED→HANDEDOFF | Timestamp: 2026-06-11T02:40:00Z
- Gate: ship | Verdict: PASS | Classification: feature | Transition: HANDEDOFF→SHIPPED | Timestamp: 2026-06-11T02:45:00Z | SSoT seq 60; capture marker removed at closure

---

## Phase Summary

- bootstrap/plan: W4 spec'd; live-session self-capture design (hook runs from working tree). ⚡ ACX
- implement: AC-1..AC-4 delivered; 14 real fixtures from live session; 136 contract tests; 1698/1698 green; build+smoke PASS. Confidence: 97% — high. ⚡ ACX
