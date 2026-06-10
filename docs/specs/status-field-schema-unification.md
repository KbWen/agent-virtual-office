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
- **server.mjs deletes its inline copy and imports `src/utils/normalizePost.mjs` — a bare-Node
  runtime copy that is MECHANICALLY drift-guarded.** *(Amended at review: the original AC-3 said
  "import `normalizePost.js`", but that is physically impossible — `package.json`
  `"type":"commonjs"` makes bare Node parse `.js` as CJS, so the ESM `.js` src chain cannot be
  imported by `node server.mjs`. The earlier-cited `scanSessions.mjs` "precedent" was wrong: that
  file imports only node builtins, never `src/*.js`. Decision: keep ONE canonical schema
  (`statusFields.js`) and ship a self-contained `.mjs` runtime copy whose inlined constants,
  sanitizers, AND full normalizePost behavior are enforced identical to the canonical module by
  tests — list equality, a sanitizer probe table, and a multi-payload behavioral parity suite in
  `tests/statusFieldsDriftGuard.test.js`. The drop-class is contained by mechanical guard rather
  than eliminated by construction; this is the strongest design `type:commonjs` permits without a
  build step for the server.)* This change also FIXES the #52 divergence (server path now coerces
  invalid status → idle), and `/api/status` + `/api/event` share ONE `_seq` clock (exported
  `nextSeq`) so cross-endpoint writes cannot stale-drop each other.
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
- **AC-3** *(amended at review — see §Design)* `server.mjs`: inline normalizePost DELETED,
  replaced by `import { normalizePost, nextSeq } from './src/utils/normalizePost.mjs'` (bare-Node
  runtime copy; `.js` import impossible under `"type":"commonjs"`). The `.mjs` copy MUST be
  mechanically drift-guarded against the canonical module (field list + sanitizer probes +
  behavioral payload parity). The #52 behavior unification (drop→coerce-idle on the server path)
  gets an explicit regression test asserting BOTH the canonical `.js` AND the server-runtime
  `.mjs` instances. `/api/event` and `/api/status` share the exported `nextSeq` clock.
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
