/**
 * AVO-146 — Server-runtime entry point for normalizePost.
 *
 * This is the .mjs version of normalizePost for use in server.mjs and any other
 * Node.js runtime context where the package "type":"commonjs" would prevent
 * importing the .js source directly (which is transpiled by Vite/vitest but not
 * by bare Node).
 *
 * This file re-exports `normalizePost` with the SAME semantics as
 * src/utils/normalizePost.js (canonical). It inlines the minimal dependencies
 * (VALID_ROLES, VALID_STATUSES, VALID_MOODS, BLOCKED_REASONS, AGENT_CARRY_FIELDS)
 * that cannot be imported from .js files at Node runtime.
 *
 * Sync contract: if you change VALID_ROLES / VALID_STATUSES / VALID_MOODS /
 * MAX_MOOD_DURATION in src/systems/constants.js, OR BLOCKED_REASONS in
 * src/systems/classify.js, OR AGENT_CARRY_FIELDS / FIELD_SANITIZERS in
 * src/utils/statusFields.js, you MUST update the matching inline constants here.
 * The normalizePost.server.test.js behavioral suite exercises the canonical .js
 * module; the smoke gate exercises this .mjs at Node runtime.
 */

// ─── Inlined constants (mirrors src/systems/constants.js) ────────────────────
// 'planning' included per AVO-101
const VALID_ROLES    = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning']
const VALID_MOODS    = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
const MAX_MOOD_DURATION = 3_600_000

// ─── Inlined constants (mirrors src/systems/classify.js BLOCKED_REASONS) ──────
const BLOCKED_REASONS = ['test-run-failed', 'build-failed', 'deps-failed', 'blocked-unknown']

// ─── Inlined AGENT_CARRY_FIELDS + FIELD_SANITIZERS (mirrors src/utils/statusFields.js) ─
const AGENT_CARRY_FIELDS = ['task', 'label', 'hint', 'reasonCode', 'activeFile']
const FIELD_SANITIZERS = {
  task:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  label:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  hint:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  reasonCode: (v) => BLOCKED_REASONS.includes(v) ? v : null,
  activeFile: (v) => typeof v === 'string' ? v.slice(0, 200) : null,
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clampMoodDuration(raw) {
  if (raw == null) return null
  const n = Number(raw)
  return Math.min(Math.max(Number.isFinite(n) ? n : 60000, 1000), MAX_MOOD_DURATION)
}

function countActive(agents) {
  let n = 0
  for (const a of agents) if (a.status === 'working' || a.status === 'blocked') n++
  return n
}

// Single monotonic clock for the whole server process. Exported so server.mjs's
// /api/event writer shares THIS counter — two independent counters writing the same
// status file can emit a lower _seq after a same-ms burst, tripping the cross-channel
// stale-drop guard (inferStatus.js high-water mark). One process = one clock.
let _seqLast = 0
export function nextSeq() {
  const now = Date.now()
  _seqLast = now > _seqLast ? now : _seqLast + 1
  return String(_seqLast)
}

// ─── normalizePost ────────────────────────────────────────────────────────────

/**
 * Normalize POST body to the unified office-status format.
 * Handles both shorthand ({ dev: "working" }) and full format ({ type: "office-status", agents: [...] }).
 * Semantics are byte-identical to src/utils/normalizePost.js.
 */
export function normalizePost(body) {
  if (body == null || typeof body !== 'object') body = {}
  if (body.type === 'office-status') {
    const seen = new Set()
    const agents = (Array.isArray(body.agents) ? body.agents : [])
      .filter(a => {
        if (!a || typeof a !== 'object') return false
        if (!VALID_ROLES.includes(a.role)) return false
        if (seen.has(a.role)) return false
        seen.add(a.role)
        return true
      })
      .slice(0, 50)
      .map(a => {
        const carry = {}
        for (const f of AGENT_CARRY_FIELDS) carry[f] = FIELD_SANITIZERS[f](a[f])
        return {
          role: a.role,
          // #52 — coerce invalid status to 'idle' (fixes the server.mjs #52 divergence)
          status: VALID_STATUSES.includes(a.status) ? a.status : 'idle',
          ...carry,
        }
      })
    const mood = VALID_MOODS.includes(body.mood) ? body.mood : null
    return {
      type: 'office-status',
      agents,
      activeCount: countActive(agents),
      workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
      mood,
      moodDuration: mood == null ? null : clampMoodDuration(body.moodDuration),
      source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
      _seq: nextSeq(),
    }
  }
  const agents = []
  for (const key of VALID_ROLES) {
    const val = body[key]
    if (val == null) continue
    const isStatus = VALID_STATUSES.includes(val)
    if (!isStatus && typeof val !== 'string') continue
    const carry = {}
    for (const f of AGENT_CARRY_FIELDS) {
      if (f === 'task') continue
      carry[f] = FIELD_SANITIZERS[f](body[f])
    }
    agents.push({
      role: key,
      task: isStatus ? null : val.slice(0, 200),
      status: isStatus ? val : 'working',
      ...carry,
    })
  }
  const mood = VALID_MOODS.includes(body.mood) ? body.mood : null
  return {
    _seq: nextSeq(),
    type: 'office-status',
    agents,
    activeCount: countActive(agents),
    workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
    source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
    mood,
    moodDuration: mood == null ? null : clampMoodDuration(body.moodDuration),
  }
}

// Exported so the drift-guard test can mechanically compare these inlined mirrors
// against the canonical src/utils/statusFields.js — the sync contract above is
// ENFORCED by tests/statusFieldsDriftGuard.test.js, not by convention.
export { VALID_ROLES, VALID_STATUSES, VALID_MOODS, BLOCKED_REASONS, AGENT_CARRY_FIELDS, FIELD_SANITIZERS }
