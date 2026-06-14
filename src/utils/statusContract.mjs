/**
 * AVO-146 (#122) — Single source of truth for the office-status TRANSPORT CONTRACT.
 *
 * This is a `.mjs` ESM module with ZERO imports, so it loads identically in:
 *   - bare Node (server.mjs runtime — `package.json` "type":"commonjs" makes the ESM
 *     `.js` sources unloadable by Node, but a `.mjs` is always ESM), and
 *   - Vite / vitest (app + tests).
 *
 * Before #122, the same constants + sanitizers + normalizePost logic were INLINED a
 * second time in `src/utils/normalizePost.mjs` and drift-guarded by a test. That mirror
 * is now eliminated: this module is the ONLY definition site, and the canonical domain
 * modules (constants.js / classify.js / statusFields.js / normalizePost.js) plus the
 * server entry (normalizePost.mjs) re-export FROM here. Adding a new carry field is a
 * one-line change to AGENT_CARRY_FIELDS + FIELD_SANITIZERS below.
 *
 * Semantics are intentionally byte-identical to the pre-#122 normalizePost — this path
 * sanitizes untrusted POST bodies at the server trust boundary (security A04), so the
 * normalizePost output and every FIELD_SANITIZER must not change.
 */

// ─── Enum constants (was: src/systems/constants.js) ──────────────────────────
// 'planning' included per AVO-101; 'idle' mood per the mood engine. Left UNFROZEN to
// stay byte-identical to the pre-#122 definitions (constants.js exported plain arrays);
// this refactor changes the definition SITE only, never runtime behavior.
export const VALID_ROLES    = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
export const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning']
export const VALID_MOODS    = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
export const MAX_MOOD_DURATION = 3_600_000  // 1 hour in ms

// ─── Blocked-reason codes (was: keys of classify.js BLOCKED_REASON_TABLE) ─────
// ORDERED to match the canonical BLOCKED_REASON_TABLE key order in classify.js, which
// re-exports THIS list and pins equivalence with an Object.keys()-equality guard. Only
// the code list lives here (transport contract); the per-reason UI metadata (iconId /
// hue / a11yKey) stays in classify.js where the presentation layer owns it.
export const BLOCKED_REASONS = Object.freeze([
  'test-run-failed', 'build-failed', 'deps-failed', 'blocked-unknown',
  'permission-denied', 'api-rate-limit', 'api-auth-failed',
])

// ─── Per-agent carry-field schema (was: src/utils/statusFields.js) ───────────
// The transport fields every normalizer/router/store site passes through (modulo
// sanitization). Adding a field here + a FIELD_SANITIZERS entry registers it everywhere
// that iterates this list.
export const AGENT_CARRY_FIELDS = ['task', 'label', 'hint', 'reasonCode', 'activeFile', 'skill']

// Per-field sanitizers. Semantics must match prior per-site behavior EXACTLY (AC-1
// byte-equal): capStr(200) for free strings (string→sliced, non-string→null);
// reasonCode enum-validates against BLOCKED_REASONS (valid member→passthrough, else→null).
// Unfrozen to match the pre-#122 statusFields.js definition (definition site moves only).
export const FIELD_SANITIZERS = {
  task:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  label:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  hint:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  reasonCode: (v) => BLOCKED_REASONS.includes(v) ? v : null,
  activeFile: (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  // AVO-104: raw skill / subagent name, capStr(200) like task/label.
  skill:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
}

/**
 * Apply per-field sanitizers from src to target (or a new object if target is omitted).
 * Only AGENT_CARRY_FIELDS are written — other keys are untouched.
 */
export function sanitizeCarryFields(src, target = {}) {
  for (const field of AGENT_CARRY_FIELDS) {
    target[field] = FIELD_SANITIZERS[field](src == null ? undefined : src[field])
  }
  return target
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

// Single monotonic clock for the whole server process. server.mjs's /api/event writer
// shares THIS counter — two independent counters writing the same status file can emit a
// lower _seq after a same-ms burst, tripping the cross-channel stale-drop guard
// (inferStatus.js high-water mark). One process = one clock.
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
 */
export function normalizePost(body) {
  if (body == null || typeof body !== 'object') body = {}
  if (body.type === 'office-status') {
    const seen = new Set()
    const agents = (Array.isArray(body.agents) ? body.agents : [])
      .filter(a => {
        if (!a || typeof a !== 'object') return false
        // Role is the agent's IDENTITY — no safe fallback for an unknown role, so an
        // invalid/unknown role is dropped. Status degrades safely (see map): #52 — a
        // valid-role agent with a missing/null/invalid status is kept and coerced to 'idle'.
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
          // #52 — null/undefined/non-string/unknown status falls back to 'idle'.
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
    // task is set specially (the role value when not a status); apply sanitizers for the rest.
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
