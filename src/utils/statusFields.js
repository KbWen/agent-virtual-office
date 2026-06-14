/**
 * AVO-146 — Per-agent carry-field schema (human-facing site map).
 *
 * #122 update: the DEFINITIONS (AGENT_CARRY_FIELDS / FIELD_SANITIZERS / sanitizeCarryFields)
 * now live ONCE in the node-safe transport contract `src/utils/statusContract.mjs` and are
 * re-exported here, so every existing `import { ... } from './statusFields.js'` site is
 * unchanged. The former bare-Node runtime MIRROR (an inlined copy inside normalizePost.mjs) is
 * GONE — normalizePost.mjs now re-exports the same contract. This file remains the human-facing
 * map of every whitelist site so a new field's blast radius stays documented in one place.
 *
 * Fields deliberately NOT in AGENT_CARRY_FIELDS (bespoke validation per site):
 *   role    — allowlist per site (VALID_ROLES); no safe fallback for unknowns
 *   status  — enum + coerce-to-idle (#52) logic differs per site
 *   session — slug-capped, multi-worktree identity field
 *
 * Data-path map (all whitelist sites):
 *   SITE 1  public/hooks/office-status-hook.js  ~line 948  payload-build
 *   SITE 2  public/hooks/office-status-hook.js  ~line 900  merge re-map
 *   SITE 3  src/utils/normalizePost.js  full branch .map()      (logic now in statusContract.mjs)
 *   SITE 4  src/utils/normalizePost.js  shorthand branch push() (logic now in statusContract.mjs)
 *   SITE 5  src/inference/inferStatus.js   ~line 63   sanitizeAgent
 *   SITE 6  src/inference/agentRouter.js   ~line 122  routeExternalAgents push
 *   SITE 7  src/server/scanSessions.mjs    (spread-through, self-updating — document only)
 *   SITE 8  src/systems/store.js           ~line 811  applyExternalStatus ext write
 *   SITE 9  src/utils/statusContract.mjs   THE single source of truth (was an inlined mirror in
 *           normalizePost.mjs; #122 collapsed it — bare Node imports this .mjs directly)
 *
 * Hook sites (SITE 1 + SITE 2) CANNOT import this module (standalone CJS, zero-dep). The
 * drift-guard test (tests/statusFieldsDriftGuard.test.js) reads the hook source and asserts
 * every field in AGENT_CARRY_FIELDS appears in BOTH hook sites.
 *
 * New-field checklist (when adding a field):
 *   1. Add to AGENT_CARRY_FIELDS + a FIELD_SANITIZERS entry in src/utils/statusContract.mjs
 *      (ONE place — every importer, including bare-Node server.mjs, picks it up).
 *   2. Hook: manually update BOTH hook sites (SITE 1 payload-build + SITE 2 merge) — these stay
 *      separate because the hook is a standalone zero-dependency CJS file.
 *   3. Run `npm test` — the drift-guard test fails immediately if a hook site is out of sync.
 */

export { AGENT_CARRY_FIELDS, FIELD_SANITIZERS, sanitizeCarryFields } from './statusContract.mjs'
