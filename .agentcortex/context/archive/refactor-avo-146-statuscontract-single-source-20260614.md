---
description: Work Log — AVO-146 follow-up / issue #122 — eliminate normalizePost.mjs runtime mirror
---

# Work Log: refactor/avo-146-statuscontract-single-source

## Header

- Branch: `refactor/avo-146-statuscontract-single-source`
- Classification: `architecture-change`
- Classified by: `claude-opus-4-8`
- Frozen: `2026-06-15`
- Created Date: `2026-06-15`
- Owner: `KbWen / claude-opus-implement-122`
- Guardrails Mode: `Full`
- Current Phase: `review`
- Checkpoint SHA: `ada451377f50db602572066e450b6715d343ec79`
- Recommended Skills: `none`
- Primary Domain Snapshot: `runtime / status-transport contract`
- SSoT Sequence: `n/a (local)`

---

## Session Info

- Agent: `claude-opus-4-8[1m]`
- Session: `2026-06-15 (implement)`
- Platform: `claude-code`
- Files Read: `~14`

---

## Task Description

Issue #122 (tech-debt follow-up to AVO-146): `src/utils/normalizePost.mjs` is a hand-maintained runtime MIRROR (constants + sanitizers + normalizePost logic) of the canonical `.js` modules, needed because `package.json type:commonjs` makes bare-Node unable to import the ESM `.js` sources. The duplication is drift-guarded but is a structural maintenance cost (every new carry field touches two places). Goal: collapse to a single node-safe source of truth.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-15 | classified architecture-change (chat) |
| plan | done | 2026-06-15 | design presented + gate PASS (chat); see ## External References |
| implement | done | 2026-06-15 | commit ada4513; 7 files; net -224 lines |
| review | done | 2026-06-15 | 3 parallel expert lenses → all READY, 0 findings |
| test | done | 2026-06-15 | full suite 2029 green; AC-2 bare-node + live server proven |
| handoff | done | 2026-06-15 | Resume block written |
| ship | done | 2026-06-15 | PR #163 SQUASH-MERGED to main as 27c1161 (2026-06-14T16:48Z); CI green on updated base; merged-main full suite 2036 green |

---

## Phase Summary

- plan: single node-safe ESM module `src/utils/statusContract.mjs` becomes the sole source for VALID_ROLES/STATUSES/MOODS, MAX_MOOD_DURATION, BLOCKED_REASONS (ordered codes), AGENT_CARRY_FIELDS, FIELD_SANITIZERS, sanitizeCarryFields, normalizePost (+ nextSeq/clampMoodDuration/countActive). Existing modules re-export from it (import paths unchanged). classify.js keeps its rich BLOCKED_REASON_TABLE (UI metadata) but imports the ordered code list from the contract + a keys-equality guard. normalizePost.mjs/.js become thin shims. drift guard → single-source consistency check + bare-node import smoke.
- implement: commit ada4513. Created statusContract.mjs; constants/classify/statusFields/normalizePost.js/.mjs rewired to re-export; drift guard reframed + classify-table-keys guard + spawned-node bare-load smoke added. Left enum arrays UNFROZEN to match pre-#122 (byte-identical). 7 files, net -224 lines. Full suite 2029 green; bare-node import + live server POST verified. Scope = exactly planned.
- review (owner-requested multi-lens, 3 parallel experts): (1) correctness/equivalence [acx-reviewer] → READY: byte-identical across 7 adversarial payloads incl. key-order + _seq position, export surface complete, single nextSeq counter, no cycles, frozen-ness correct, table-codes ordering deterministic. (2) security/A04 → READY: sanitizers byte-identical, no prototype-pollution (fixed allowlist, no {...body} spread), enum integrity, subprocess test injection-safe, no secrets, server.mjs untouched. (3) bare-node/ESM → READY: zero transpile-dep .mjs chain, valid re-export syntax, server boots + live POST {ok:true,agents:2}, casing correct, no import.meta/TLA/browser API in new modules. 0 findings → nothing to address.
- test: coverage delta = none-uncovered. statusContract.mjs is the same logic moved; fully exercised by the retained AC-6 field-survival e2e + .js/.mjs parity + sanitizer probe table, PLUS the new spawned-node bare-load smoke (AC-2) and the classify-table-keys guard (AC-3). Full suite 95 files / 2029 tests PASS.

---

## Gate Evidence

- Gate: plan | Verdict: PASS | Classification: architecture-change | Timestamp: 2026-06-15
- Gate: implement | Verdict: PASS | Classification: architecture-change | Timestamp: 2026-06-14T16:35:11Z
- Gate: review | Verdict: PASS | Classification: architecture-change | Timestamp: 2026-06-14T16:40:00Z
- Gate: test | Verdict: PASS | Classification: architecture-change | Timestamp: 2026-06-14T16:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/status-field-schema-unification.md | AVO-146 canonical spec; this is its tech-debt follow-up (Phase 2: eliminate runtime mirror) |
| Issue | https://github.com/KbWen/agent-virtual-office/issues/122 | the tech-debt finding + acceptance criteria |
| PR | https://github.com/KbWen/agent-virtual-office/pull/163 | open — awaiting owner review/merge |

---

## Plan (gate-passed, from chat)

**Target Files (planned):**
1. NEW `src/utils/statusContract.mjs` — single node-safe source of truth.
2. `src/systems/constants.js` — re-export VALID_ROLES/STATUSES/MOODS/MAX_MOOD_DURATION from contract (replace inline defs).
3. `src/systems/classify.js` — import BLOCKED_REASONS (ordered codes) from contract; keep rich BLOCKED_REASON_TABLE; add `Object.keys(table) === BLOCKED_REASONS` guard; re-export BLOCKED_REASONS.
4. `src/utils/statusFields.js` — re-export AGENT_CARRY_FIELDS/FIELD_SANITIZERS/sanitizeCarryFields from contract.
5. `src/utils/normalizePost.js` — re-export normalizePost + constants from contract (thin shim).
6. `src/utils/normalizePost.mjs` — re-export from contract (thin shim; server.mjs import path unchanged).
7. `tests/statusFieldsDriftGuard.test.js` — replace multi-mirror comparison with single-source consistency check + classify-table-keys guard; keep AC-6 field-survival e2e.

**Acceptance Criteria (issue #122):**
- AC-1: Adding a new carry field has ONE source of truth (or generated mirror).
- AC-2: Bare `node server.mjs` still works without Vite/transpile assumptions.
- AC-3: Existing drift-guard tests remain or are replaced by a generator/consistency check.

**Invariant (non-negotiable):** normalizePost output + FIELD_SANITIZERS semantics must stay byte-identical (security: A04 input sanitization at the trust boundary). Verified by the unchanged AC-6 survival e2e + full suite + bare-node smoke.

---

## Known Risk

- A04 (security): normalizePost sanitizes untrusted POST bodies at the server trust boundary. The refactor MUST preserve sanitizer semantics byte-for-byte. Mitigation: behavior is unchanged (same functions, moved location); AC-6 survival e2e + statusContract equivalence test + bare-node boot/POST smoke.
- Global Lesson [shell-dependency/validation-runtime-dependency, HIGH]: must NOT add a new hard runtime dependency to the bare-node path. Mitigation: statusContract.mjs is pure JS, zero deps, `.mjs` so bare Node loads it directly.
- Re-export rewiring risk: constants.js/classify.js are widely imported. Only the DEFINITION SITE moves; values + public export names are unchanged, so consumers are unaffected. Mitigation: full suite (2034 tests) + scope-breach check.

---

## Drift Log

- 2026-06-15: Spec home = extend existing `docs/specs/status-field-schema-unification.md` with a Phase-2 section rather than a new spec file (one-topic-one-canonical-file; this is the same contract's follow-up). Logged per architecture-change spec requirement.
- 2026-06-15: Ship closure done in a SEPARATE PR (chore/ship-closure-162-163), NOT the same feature PR — #163 was already merged before closure, and main is branch-protected so SSoT/archive must go through a PR. SSoT ship-history + Spec Index + backlog written via direct Edit (NOT guard_context_write.py) to avoid the documented stale-cache hazard (guard reuses cached receipts → can write stale content despite status:ok); verified by re-read. INDEX.jsonl used the chain-aware append_chain_entry.py (prev_sha 026bcda3).

---

## Skill Notes

none

---

## Evidence

- Full suite: `npx vitest run` → 95 files / 2029 tests PASS (incl. statusFieldsDriftGuard AC-6 e2e, parity, new bare-node smoke).
- AC-2 bare-node import: `node --input-type=module -e "import('./src/utils/normalizePost.mjs')…"` → roles 8, reasons 7, dev.status working, nextSeq string; statusContract.mjs loads standalone.
- AC-2 live server: booted real `server.mjs --no-open --port=5199` (bare Node, prod build) → POST {dev:working, qa:blocked, reasonCode:build-failed, bogus:DROP_ME} → `{ok:true, agents:2}` (bogus dropped by carry-field whitelist).
- Scope: `git diff --name-only` = exactly the 7 planned files; net -224 lines (mirror eliminated).
- Security quick-scan (A01–A03 + secrets): clean — pure definition-site move; no secrets; test subprocess uses process.execPath + array args (no shell).
- Review (3 parallel experts, all READY/0 findings): correctness/equivalence (7-payload byte-identical incl. _seq position), security/A04 (no prototype-pollution, sanitizers identical), bare-node/ESM (server boots + live POST, .mjs-only chain).

---

## Observability

Sink: n/a (no error-emitting code paths added; pure definition-site move). Scope: src/utils/statusContract.mjs + 5 re-export shims. Verified: yes (behavior byte-identical; full suite + live server).

---

## Resume

- State: review PASS + test PASS; shipping (PR open).
- Completed: implement (ada4513), 3-lens expert review (all READY/0 findings), test (2029 green + AC-2 live server).
- Next: ship closure (PR, SSoT ship-history line, worklog archive); merge after owner review.
- Context: #122 collapsed the normalizePost.mjs runtime mirror into `src/utils/statusContract.mjs` (single node-safe source). Byte-identical; AVO-146 SITE-9 follow-up.

### Read Map
- `src/utils/statusContract.mjs` — the single source of truth (read first).
- `tests/statusFieldsDriftGuard.test.js` — single-source wiring guard + classify-table-keys guard + bare-node smoke.
- `docs/specs/status-field-schema-unification.md` — AVO-146 spec (Phase-2 = this work).

### Skip List
- `server.mjs` — UNCHANGED (import path `./src/utils/normalizePost.mjs` stable).
- The re-export shims (constants/classify/statusFields/normalizePost.js/.mjs) — mechanical; logic lives only in statusContract.mjs.

### Context Snapshot
- Branch `refactor/avo-146-statuscontract-single-source` @ ada4513, base main @ 0ee1b0e.
- ACs met: AC-1 (one source), AC-2 (bare node — live server POST proven), AC-3 (drift guard → single-source wiring + table-keys guard, AC-6 retained).
