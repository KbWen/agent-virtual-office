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
export const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning', 'awaiting-approval']
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
export const MAX_AGENT_ID_LENGTH = 80

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

export function sanitizeAgentId(raw) {
  if (typeof raw !== 'string') return null
  const id = raw.trim().slice(0, MAX_AGENT_ID_LENGTH)
  if (!id) return null
  if (id === '__proto__' || id === 'prototype' || id === 'constructor') return null
  return /^[A-Za-z0-9][A-Za-z0-9._~:-]*$/.test(id) ? id : null
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clampMoodDuration(raw) {
  if (raw == null) return null
  const n = Number(raw)
  return Math.min(Math.max(Number.isFinite(n) ? n : 60000, 1000), MAX_MOOD_DURATION)
}

function countActive(agents) {
  let n = 0
  for (const a of agents) if (a.status === 'working' || a.status === 'blocked' || a.status === 'planning' || a.status === 'awaiting-approval') n++
  return n
}

function allowedIdSet(allowedAgentIds) {
  if (allowedAgentIds == null) return null
  const ids = Array.isArray(allowedAgentIds) || allowedAgentIds instanceof Set
    ? allowedAgentIds
    : []
  return new Set([...ids].map(sanitizeAgentId).filter(Boolean))
}

function genericAgentFromFull(agent, seen, allowed) {
  if (!agent || typeof agent !== 'object') return null
  const agentId = sanitizeAgentId(agent.agentId ?? agent.id ?? agent.role)
  if (!agentId || seen.has(agentId) || (allowed && !allowed.has(agentId))) return null
  seen.add(agentId)
  const carry = {}
  for (const field of AGENT_CARRY_FIELDS) carry[field] = FIELD_SANITIZERS[field](agent[field])
  return {
    agentId,
    status: VALID_STATUSES.includes(agent.status) ? agent.status : 'idle',
    ...carry,
  }
}

function genericAgentFromShorthand(agentId, value, body, multiAgent) {
  const isStatus = VALID_STATUSES.includes(value)
  if (!isStatus && typeof value !== 'string') return null
  const carry = {}
  for (const field of AGENT_CARRY_FIELDS) {
    if (field === 'task' || field === 'activeFile') continue
    carry[field] = FIELD_SANITIZERS[field](body[field])
  }
  const update = {
    agentId,
    task: isStatus ? null : value.slice(0, 200),
    status: isStatus ? value : 'working',
    ...carry,
  }
  update.activeFile = multiAgent ? null : FIELD_SANITIZERS.activeFile(body.activeFile)
  return update
}

// Additive generic normalizer for package consumers. The legacy normalizePost() below remains
// AVO-roster strict for server compatibility; this entry produces status-runtime-shaped updates
// (`agentId`) and can accept arbitrary safe agent IDs such as "frontend" or "reviewer-2".
export function normalizeAgentStatusUpdates(body, { allowedAgentIds = null } = {}) {
  if (body == null || typeof body !== 'object') body = {}
  const allowed = allowedIdSet(allowedAgentIds)
  let updates
  if (body.type === 'office-status') {
    const seen = new Set()
    updates = (Array.isArray(body.agents) ? body.agents : [])
      .map((agent) => genericAgentFromFull(agent, seen, allowed))
      .filter(Boolean)
      .slice(0, 50)
  } else {
    const reserved = new Set(['type', 'agents', 'activeCount', 'workflow', 'mood', 'moodDuration', 'source', '_seq', ...AGENT_CARRY_FIELDS])
    const ids = []
    for (const key of Object.keys(body)) {
      if (reserved.has(key)) continue
      const id = sanitizeAgentId(key)
      if (!id || (allowed && !allowed.has(id))) continue
      ids.push(id)
    }
    const multiAgent = ids.length !== 1
    updates = ids
      .map((id) => genericAgentFromShorthand(id, body[id], body, multiAgent))
      .filter(Boolean)
      .slice(0, 50)
  }
  const mood = VALID_MOODS.includes(body.mood) ? body.mood : null
  return {
    type: 'agent-status-updates',
    updates,
    activeCount: countActive(updates),
    workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
    mood,
    moodDuration: mood == null ? null : clampMoodDuration(body.moodDuration),
    source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
    _seq: nextSeq(),
  }
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
    // task is set specially (the role value when not a status); activeFile is applied post-loop.
    const carry = {}
    for (const f of AGENT_CARRY_FIELDS) {
      // AVO-183b: never broadcast a single top-level `activeFile` to MULTIPLE roles — it would make
      // them all "share" a file and fabricate a pair-huddle co-edit. Handled once, post-loop.
      if (f === 'task' || f === 'activeFile') continue
      carry[f] = FIELD_SANITIZERS[f](body[f])
    }
    agents.push({
      role: key,
      task: isStatus ? null : val.slice(0, 200),
      status: isStatus ? val : 'working',
      ...carry,
    })
  }
  // AVO-183b: a top-level `activeFile` in shorthand belongs to a SINGLE agent only (one editor, no
  // fabricated co-edit pair). With 2+ roles it is dropped — use the full per-agent format for that.
  const _af = agents.length === 1 ? FIELD_SANITIZERS.activeFile(body.activeFile) : null
  for (const a of agents) a.activeFile = _af
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
