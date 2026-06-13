/**
 * AVO-146 — Canonical per-agent carry-field schema.
 *
 * AGENT_CARRY_FIELDS: the transport fields that every normalizer/router/store site
 * must pass through unchanged (modulo sanitization). Adding a field here is the
 * SINGLE change required to register it — every consumer iterates this list.
 *
 * Fields deliberately NOT in this list (bespoke validation per site):
 *   role    — allowlist checked per site (VALID_ROLES); no safe fallback for unknowns
 *   status  — enum + coerce-to-idle (#52) logic differs per site
 *   session — slug-capped, multi-worktree identity field
 *
 * Data-path map (all 8 whitelist sites):
 *   SITE 1  public/hooks/office-status-hook.js  ~line 948  payload-build
 *   SITE 2  public/hooks/office-status-hook.js  ~line 900  merge re-map
 *   SITE 3  src/utils/normalizePost.js           ~line 49   full branch .map()
 *   SITE 4  src/utils/normalizePost.js           ~line 82   shorthand branch push()
 *   SITE 5  src/inference/inferStatus.js         ~line 63   sanitizeAgent
 *   SITE 6  src/inference/agentRouter.js         ~line 122  routeExternalAgents push
 *   SITE 7  src/server/scanSessions.mjs          (spread-through, self-updating — document only)
 *   SITE 8  src/systems/store.js                 ~line 811  applyExternalStatus ext write
 *   SITE 9  src/utils/normalizePost.mjs          bare-Node runtime copy for server.mjs
 *           (package "type":"commonjs" makes src ESM .js unloadable by bare Node, so the
 *           server runtime needs a self-contained .mjs; its inlined constants + behavior
 *           are MECHANICALLY drift-guarded against this module by the tests below)
 *
 * Hook sites (SITE 1 + SITE 2) CANNOT import this module (standalone CJS, zero-dep).
 * The drift-guard test (tests/statusFieldsDriftGuard.test.js) reads the hook source
 * and asserts every field here appears in both hook sites, AND asserts the SITE 9
 * .mjs copy's exported field list / sanitizers / normalizePost behavior are identical
 * to the canonical exports here.
 *
 * New-field checklist (when adding a field):
 *   1. Add to AGENT_CARRY_FIELDS below.
 *   2. Add a sanitizer entry in FIELD_SANITIZERS (or null for passthrough).
 *   3. Hook: manually update BOTH hook sites (SITE 1 payload-build + SITE 2 merge).
 *   4. Runtime copy: update src/utils/normalizePost.mjs inlined list + sanitizer.
 *   5. Run `npm test` — the drift-guard test fails immediately if the hook OR the
 *      .mjs runtime copy is out of sync.
 */

import { BLOCKED_REASONS } from '../systems/classify.js'

/**
 * Ordered list of per-agent carry fields.
 * Consumers that need the list for iteration import this.
 * Consumers that need sanitization call sanitizeCarryFields().
 */
export const AGENT_CARRY_FIELDS = ['task', 'label', 'hint', 'reasonCode', 'activeFile', 'skill']

/**
 * Per-field sanitizer functions.
 * null means passthrough (e.g. if a consumer does its own check).
 * Each function takes the raw source value and returns the sanitized value.
 *
 * Semantics must match current per-site behavior EXACTLY (AC-1 byte-equal requirement):
 *   task / label / hint / activeFile — capStr(200): string→sliced, non-string→null
 *   reasonCode                       — enum-validate: valid enum member→passthrough, else→null
 *                                      (mirrors sanitizeAgent in inferStatus.js:73)
 */
export const FIELD_SANITIZERS = {
  task:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  label:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  hint:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  reasonCode: (v) => BLOCKED_REASONS.includes(v) ? v : null,
  activeFile: (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  // AVO-104: raw skill / subagent name, set only on SubagentStart. capStr(200) like task/label —
  // untrusted-length bound; client re-derives the localized bubble from this raw name.
  skill:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
}

/**
 * Apply per-field sanitizers from src to target (or a new object if target is omitted).
 * Only the AGENT_CARRY_FIELDS are written — other keys are untouched.
 *
 * Usage (sanitizeAgent style — write to a new object):
 *   const out = sanitizeCarryFields(incoming)
 *
 * Usage (normalizePost style — write into an existing map literal):
 *   const entry = { role, status, ...sanitizeCarryFields(a) }
 */
export function sanitizeCarryFields(src, target = {}) {
  for (const field of AGENT_CARRY_FIELDS) {
    target[field] = FIELD_SANITIZERS[field](src == null ? undefined : src[field])
  }
  return target
}
