---
status: draft
title: AVO-146 — Status-field schema unification (kill the N-whitelist drop class)
created: 2026-06-10
last_updated: 2026-06-10
---

# AVO-146 — Status-Field Schema Unification

## Problem

A per-agent external-status field (`reasonCode`, `activeFile`, next: AVO-148's error payload) must
survive 6+ independently-maintained whitelists: hook payload-build + hook merge
(`public/hooks/office-status-hook.js`), `src/utils/normalizePost.js` (2 branches), the **inline
copy** of normalizePost in `server.mjs` (2 branches) guarded by a byte-drift parity test with a
**third embedded copy** (`tests/normalizePost.server.test.js`), `sanitizeAgent`
(`src/inference/inferStatus.js`), `routeExternalAgents` (`src/inference/agentRouter.js`), and
`applyExternalStatus` (`src/systems/store.js`). Two HIGH review defects (AVO-110, AVO-106) came
from one copy silently dropping a new field. Ground-truth audit (2026-06-10) also found a LIVE
divergence: the server.mjs inline copy never received the **#52 fix** — `src` normalizePost
coerces an invalid status to `'idle'`, the server copy still **drops the whole agent**.

## Design (ground-truth-based)

- **One canonical module `src/utils/statusFields.js`**: `AGENT_CARRY_FIELDS` — the free-carry
  per-agent transport fields (`task`, `label`, `hint`, `reasonCode`, `activeFile`) with a per-field
  sanitizer descriptor (string-cap etc.). `role` / `status` / `session` stay bespoke (each site has
  load-bearing validation: role allowlist, status enum/coercion, session slug) — the module
  documents this explicitly. Header carries the full data-path map + new-field checklist.
- **src ESM sites import it** (all 4 already live in `src/`): `normalizePost.js`, `sanitizeAgent`,
  `routeExternalAgents`, `applyExternalStatus` iterate `AGENT_CARRY_FIELDS` instead of hand-listing.
- **server.mjs imports `src/utils/normalizePost.js` and deletes its inline copy.** Precedent: it
  ALREADY imports `src/server/scanSessions.mjs` at runtime, and `src/` ships in the npm `files`
  whitelist — the "zero deps on src/" comment is already false in reality. This change also FIXES
  the #52 divergence (server path now coerces invalid status → idle).
- **The hook cannot import** (standalone CJS run inside user projects, zero-dep by design) → a
  **drift-guard test** driven by the canonical list: reads the hook source and asserts every carry
  field appears in BOTH hook whitelist sites (payload build + merge); failure message names the
  exact site to update.

## Acceptance Criteria

- **AC-1** `src/utils/statusFields.js` exports `AGENT_CARRY_FIELDS` (ordered list) +
  `sanitizeCarryFields(src, target?)` applying per-field sanitizers (preserve current semantics:
  200-char `capStr` for task/label/hint/activeFile; reasonCode preserved as-is matching current
  `sanitizeAgent` behavior — verify against current code, byte-equal output for current fields).
- **AC-2** `normalizePost.js` (BOTH branches), `sanitizeAgent`, `routeExternalAgents`,
  `applyExternalStatus` consume the shared list — zero hand-maintained carry-field name lists
  remain in those sites. Existing behavior byte-identical for current fields (regression-proven by
  the untouched existing tests). Documented additive change: the POST **shorthand** branch now
  carries the same fields as the full branch (previously silently dropped reasonCode/activeFile).
- **AC-3** `server.mjs`: inline normalizePost DELETED, replaced by
  `import { normalizePost } from './src/utils/normalizePost.js'`. The #52 behavior unification
  (drop→coerce-idle on the server path) gets an explicit regression test.
- **AC-4** Hook drift-guard test: walks `AGENT_CARRY_FIELDS`, asserts each field name appears in
  the hook's payload-build site AND merge site (source-level check); failing output names
  field + site. Hook file itself UNCHANGED in this PR.
- **AC-5** `tests/normalizePost.server.test.js`: embedded third copy + byte-drift guard removed;
  replaced by (a) identity assertion that server.mjs resolves the same normalizePost as src (or
  behavioral cases against the server's imported instance), (b) the existing behavioral cases kept.
- **AC-6 (load-bearing)** New end-to-end field-survival test: for EVERY field in
  `AGENT_CARRY_FIELDS`, push a synthetic value through
  normalizePost → sanitizeAgent → routeExternalAgents → applyExternalStatus and assert it lands in
  `store.externalStatus[agentId]`. A future field added to the list is automatically covered — a
  silent drop anywhere in the chain fails this test by construction.
- **AC-7** Full suite green (only the parity test intentionally rewritten); `npm run smoke` exit 0;
  no change to `public/hooks/office-status-hook.js`.

## Non-Goals

- Changing the hook's field handling (drift-guard only; hook edits are AVO-148's concern).
- Unifying role/status/session validation (bespoke, load-bearing per site).
- SITE 7 `scanSessions.mjs` (spread-through, self-updating — document, don't change).

## Risks & Rollback

- **Risk**: subtle sanitizer-semantics drift (cap lengths, type checks) → mitigated by AC-1
  byte-equal requirement + existing per-field tests (pairHuddleDataPath, blocked-reason e2e).
- **Risk**: server.mjs import changes npm-pack runtime surface → `src/` already shipped + already
  imported (scanSessions); `npm pack --dry-run` + smoke gate verify.
- **Rollback**: single PR revert; no data-format change on the wire.
