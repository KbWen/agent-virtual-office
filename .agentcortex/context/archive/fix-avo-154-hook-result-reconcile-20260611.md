# Work Log: fix/avo-154-hook-result-reconcile

## Header

- Branch: `fix/avo-154-hook-result-reconcile`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `1c8aceb`
- Recommended Skills: `none`
- Primary Domain Snapshot: `hook-io`
- SSoT Sequence: `61`

---

## Session Info

- Agent: `claude-fable-5` (ground truth gathered first-hand via induced failures; implementation delegated to sonnet)
- Session: `2026-06-11 04:30 UTC`
- Platform: `claude-code`

---

## Task Description

AVO-154: reconcile the hook's result-field reads with the PROVEN runtime truth. Coordinator
re-enabled capture and INDUCED real failures (vitest no-match exit 1 · command-not-found ·
npm ENOENT via bash): on this runtime, failed commands arrive as ORDINARY PostToolUse with
`tool_response:{stdout,stderr,interrupted,isImage}` and **NO is_error / NO exit code** — and
NO PostToolUseFailure/PermissionDenied/StopFailure events exist (capture census: 219 PostToolUse,
204 PreToolUse, 3 Subagent*, 0 failure-class events). Also found: tool_name `PowerShell` (23
events), `Agent`, `Skill` — unmapped by toolToRole. Honest scope: dual-read normalization +
PowerShell mapping + fixture/pin refresh. The is_error honesty gate STAYS (no stdout regex —
fabrication refused, AVO-110 doctrine).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win (narrow hook reconcile + fixtures; no taxonomy change) |
| plan | done | 2026-06-11 | gate PASS in chat |
| implement | in-progress | 2026-06-11 | delegated to sonnet |
| review | pending | — | fresh reviewer (AVO-110 firewall adjacency) |
| test | pending | — | — |
| ship | pending | — | quick-win: no handoff |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T04:30:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T04:32:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T08:35:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T05:30:00Z | fresh reviewer: 8-point burden ALL PROVEN; honesty firewall intact end-to-end (specific reasons structurally unreachable without is_error===true); noted: heuristic path reactivated (was inert-by-accident; floor stays blocked-unknown)
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T05:32:00Z | 1810/1810; contract 248 ×2; blockedReason suites 52/52 byte-green
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T05:35:00Z | SSoT seq 62

---

## Changes

- `public/hooks/office-status-hook.js`:
  - Added `toolResultText(event)` helper (priority: tool_result → tool_response.stderr/stdout → ''); exported
  - `toolToRole`: added `PowerShell: 'ops'` mapping; added doc comments for Skill/ToolSearch (fallback 'dev', intentional)
  - PostToolUse block: replaced `event.tool_result || ''` + manual stringify with `toolResultText(event)`, removed redundant `typeof` guard
  - PostToolUse block: extended shell-cmd extraction to `tool === 'Bash' || tool === 'PowerShell'`
  - `extractContext`: added `case 'PowerShell':` alongside `case 'Bash':` so command gets a vibe label
  - `module.exports`: added `toolResultText`
- `scripts/sanitize-hook-capture.mjs`: added `PowerShell`, `Skill`, `ToolSearch` to `TOOL_NAMES` allow-list
- `tests/fixtures/hook-events/`:
  - New sanitizer-generated (11 new): PreToolUse/PostToolUse × PowerShell/Agent/Skill/ToolSearch, SubagentStart-generic, SubagentStop-generic, __noop__-generic
  - Hand-crafted: `PostToolUse-PowerShell-failed.json` (induced failure shape; no is_error)
  - `README.md`: updated with new shapes, hand-crafted note, corrected "not yet captured" list
- `tests/hookRuntimeContract.test.js`:
  - Import `toolResultText` from hook
  - Updated divergence-pin test to reflect AVO-154 proven ground truth: `tool_response` present, `tool_result` absent, `is_error` absent even on failures
  - New describe block: AVO-154 PowerShell behavior (toolToRole, PostToolUse behavior, failed fixture honesty, sensitivity check)
  - New describe block: `toolResultText` unit tests (12 cases: string/object/fallback/priority/runtime-shape/AVO-110-honesty)

---

## Evidence

- npm test → 1810/1810 PASS (+112 vs prior 1698 baseline)
- npx vitest run tests/hookRuntimeContract.test.js ×2 → 248/248 PASS, non-flaky
- npm run build → vite build clean (450KB bundle, 1.97s)
- npm run smoke → PASS (1871 svg descendants, 0 errors)
- Sensitivity check: removing PowerShell from toolToRole map → `toolToRole('PowerShell')` returns 'dev' instead of 'ops' → sensitivity test fails as designed

---

## Test Gate Results

- 1810/1810 PASS (npm test, 2026-06-11)
- hookRuntimeContract: 248 tests (was 143; +105 from new fixtures in loops + 11 unit tests + 4 behavior tests)

---

## Drift Log

- ADR Coverage Check: field-read normalization within the shipped AVO-110/148 contracts → no ADR.
- Honesty boundary: NO stdout/stderr text parsing for failure detection (fabrication). The
  is_error===true gate remains the only specific-reason trigger; on runtimes that never send it,
  specific reasons simply don't fire (honest inertness, documented).

---

## Phase Summary

- bootstrap/plan: runtime truth nailed by induced-failure capture; scope = dual-read + PowerShell
  mapping + fixture refresh + pin updates. ⚡ ACX
- implement: toolResultText helper + PowerShell ops mapping + extractContext PowerShell case +
  fixture refresh (11 new sanitizer + 1 hand-crafted) + 105 new tests. 1810/1810 green, build+smoke pass. Confidence: 97% — high
