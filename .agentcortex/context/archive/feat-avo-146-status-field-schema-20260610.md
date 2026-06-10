# Work Log: feat/avo-146-status-field-schema

## Header

- Branch: `feat/avo-146-status-field-schema`
- Classification: `feature`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-10`
- Created Date: `2026-06-10`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Checkpoint SHA: `6f3a4a7`
- Recommended Skills: `none`
- Primary Domain Snapshot: `data-path`
- SSoT Sequence: `51`

---

## Session Info

- Agent: `claude-fable-5` (Explore ground-truth by sonnet; implementation delegated to sonnet acx-implementer)
- Session: `2026-06-10 13:00 UTC`
- Platform: `claude-code`

---

## Task Description

Hardening-wave H2 (AVO-146): unify the 6+ per-agent status-field whitelists into one canonical
`AGENT_CARRY_FIELDS` schema module so a new field can never again be silently dropped by one copy
(the AVO-110/AVO-106 HIGH-defect class). Spec:
`docs/specs/status-field-schema-unification.md` (AC-1..AC-7). Ground-truth audit found a LIVE
divergence to fix: server.mjs inline normalizePost lacks the #52 coerce-to-idle fix.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-10 | feature; Explore agent mapped all 8 sites first (ground truth in spec §Design) |
| plan | done | 2026-06-10 | gate PASS in chat; spec written first |
| implement | done | 2026-06-10 | sonnet implementer + coordinator hardening (SITE 9 mech. guard added before review) |
| review | done | 2026-06-10 | fresh reviewer → NOT READY (1 HIGH 2 MED 2 LOW) → fixes 07afa22 → delta reviewer → PASS |
| test | done | 2026-06-10 | 1489/1489; smoke exit 0; AC-6 survival loop + SITE 9 parity live |
| handoff | done | 2026-06-10 | Resume block below |
| ship | done | 2026-06-10 | SSoT seq 52; backlog AVO-146 Done; self-archived in same PR |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T13:00:00Z
- Gate: plan | Verdict: PASS | Classification: feature | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T13:05:00Z
- Gate: implement | Verdict: PASS | Classification: feature | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T10:25:00Z
- Gate: review | Verdict: NOT READY | Classification: feature | Transition: IMPLEMENTED→IMPLEMENTING | Timestamp: 2026-06-10T14:30:00Z | fresh reviewer: HIGH-1 spec/impl divergence (.mjs copy vs AC-3 .js import), MED-1 #52 test wrong module, MED-2 _seq clock split, LOW-1 task/label null-coerce inert, LOW-2 string-scan guard caveat
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-06-10T15:00:00Z | delta reviewer: all 3 findings PROVEN fixed (07afa22); 1489/1489; nextSeq monotonic verified live
- Gate: test | Verdict: PASS | Classification: feature | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T15:05:00Z | 1489/1489 (69 files); smoke exit 0
- Gate: handoff | Verdict: PASS | Classification: feature | Transition: TESTED→HANDEDOFF | Timestamp: 2026-06-10T15:10:00Z
- Gate: ship | Verdict: PASS | Classification: feature | Transition: HANDEDOFF→SHIPPED | Timestamp: 2026-06-10T15:15:00Z | SSoT seq 52; PR for merge after CI

---

## Changes

### Files changed list
- `src/utils/statusFields.js` (NEW) — `AGENT_CARRY_FIELDS`, `FIELD_SANITIZERS`, `sanitizeCarryFields`
- `src/utils/normalizePost.mjs` (NEW) — server-runtime .mjs shim (self-contained, no .js imports); fixes #52
- `src/utils/normalizePost.js` (modified) — both branches iterate AGENT_CARRY_FIELDS; shorthand branch now carries reasonCode/activeFile (additive, AC-2)
- `src/inference/inferStatus.js` (modified) — sanitizeAgent uses sanitizeCarryFields
- `src/inference/agentRouter.js` (modified) — routeExternalAgents iterates AGENT_CARRY_FIELDS
- `src/systems/store.js` (modified) — applyExternalStatus iterates AGENT_CARRY_FIELDS (activeFile special-cased for activeFileAt stamp)
- `server.mjs` (modified) — inline normalizePost deleted; imports from ./src/utils/normalizePost.mjs; #52 divergence fixed
- `tests/normalizePost.server.test.js` (modified) — embedded copy + byte-drift guard removed; AC-3 + AC-5 assertions added
- `tests/normalizePost.test.js` (modified) — two shorthand shape assertions updated for additive reasonCode/activeFile fields
- `tests/statusFieldsDriftGuard.test.js` (NEW) — hook drift guard (AC-4) + field-survival e2e (AC-6)

---

## Evidence

- `npm test` → **1482/1482 passed** (69 test files); baseline was 1462 + 20 new tests − 0 net (parity test rewritten)
- `npm run build` → clean in 1.49s; bundle 447.41 kB (unchanged from baseline)
- `npm run smoke` → exit 0: "render-smoke PASS — svg rendered (1871 descendants), 0 pageerrors, 0 console errors"
- `npm pack --dry-run` → `src/utils/normalizePost.js` (4.5 kB), `src/utils/normalizePost.mjs` (5.7 kB), `src/utils/statusFields.js` (3.8 kB) all ship in npm package
- `git diff --stat` → 7 files changed (modified), 2 new test files, 2 new src files; hook unchanged (git diff public/hooks/office-status-hook.js = empty)
- Scope check: all 10 changed/new files are in the planned target set

---

## Test Gate Results

- `npm test`: 1482/1482 PASS (69 files). New tests: +15 statusFieldsDriftGuard + +42 normalizePost.server (−parity guard internals = net +20 vs baseline 1462). 
- `npm run build && npm run smoke`: exit 0, clean.
- Behavioral spot-proof: existing `tests/pairHuddleDataPath.test.js` (activeFile e2e, 11 tests), `tests/blockedReasonTransport.test.js` (reasonCode e2e), `tests/normalizePost.test.js` (shorthand + full shape) all green → byte-identical output for existing fields confirmed.

---

## Drift Log

- ADR Coverage Check: data-path refactor within existing architecture (no new boundary; the
  canonical-schema decision is documented in the spec §Design) → no ADR required.
- Authorized refactor: AVO-146 is owner-selected hardening-wave work (not unauthorized refactoring).
- DECISION (recorded per review HIGH-1, owner pre-delegated "全交給你了"): AC-3 amended to bless
  the `.mjs` runtime-copy design. Reason: bare Node under `"type":"commonjs"` parses `.js` as CJS →
  the ESM src chain is physically unimportable by `node server.mjs`; the spec's scanSessions
  "precedent" was factually wrong (it imports only node builtins). Containment: the copy's list,
  sanitizers, AND behavior are MECHANICALLY enforced identical to canonical by
  tests/statusFieldsDriftGuard.test.js (SITE 9 block) — drop-class contained by guard, not by
  construction. Alternative (renaming the whole src dep chain to .mjs) rejected as a far more
  invasive refactor for the same guarantee.
- Coordinator hardening BEFORE first review: implementer's .mjs copy initially had only a comment
  "sync contract" — coordinator added the mechanical SITE 9 drift-guard tests + exports. The fresh
  reviewer then independently confirmed the guard has teeth.

---

## Phase Summary

- bootstrap/plan: 8-site ground-truth map (Explore agent) drove the design; server.mjs already
  imports src/server/scanSessions.mjs so the inline-copy "zero-dep" rationale is void; #52
  divergence found live on the server path. ⚡ ACX
- implement: 10 files touched (7 modified, 3 new); 1482/1482 tests; smoke exit 0; hook untouched; deviation: normalizePost.mjs shim required (package type=commonjs prevents bare Node importing .js ESM); #52 divergence fixed on server path. Confidence: 95% — high

## Resume

### Read Map
- docs/specs/status-field-schema-unification.md (amended AC-3) · src/utils/statusFields.js (9-site map + checklist) · tests/statusFieldsDriftGuard.test.js.
### Skip List
- Hook field handling (drift-guarded only; edits belong to AVO-148/H5).
### Context Snapshot
- New-field procedure is now: statusFields.js + hook×2 + normalizePost.mjs mirrors — ALL
  drift-guarded; `npm test` fails loudly on any omission. H5 (AVO-148) will be the first consumer.

- review→ship: fresh review NOT READY (HIGH spec divergence + 2 MED) → spec amended + nextSeq
  clock unified + #52 dual-instance test → delta review PASS. 1489/1489; smoke green; SSoT seq 52;
  self-archived in same PR. Next wave item: H3 (#20 hook atomic write). ⚡ ACX
