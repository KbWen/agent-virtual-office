import { VALID_ROLES, VALID_STATUSES, VALID_MOODS, MAX_MOOD_DURATION } from '../systems/constants.js'
import { BLOCKED_REASONS } from '../systems/classify.js'
export { VALID_ROLES, VALID_STATUSES, VALID_MOODS, MAX_MOOD_DURATION }

// Monotonic integer seq — prevents duplicate _seq when called multiple times per ms
let _seqLast = 0
function nextSeq() {
  const now = Date.now()
  _seqLast = now > _seqLast ? now : _seqLast + 1
  return String(_seqLast)
}

function clampMoodDuration(raw) {
  if (raw == null) return null
  const n = Number(raw)
  return Math.min(Math.max(Number.isFinite(n) ? n : 60000, 1000), MAX_MOOD_DURATION)
}

// Count working/blocked agents without allocating a throwaway filtered array
// just to read its .length — normalizePost runs on every POST.
function countActive(agents) {
  let n = 0
  for (const a of agents) if (a.status === 'working' || a.status === 'blocked') n++
  return n
}

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
        // Role is the agent's IDENTITY — there's no safe fallback for an unknown role, so an
        // invalid/unknown role is still dropped. Status, by contrast, degrades safely (see map):
        // #52 — an agent with a valid role but a missing/null/invalid status used to be dropped
        // here, which blanked it from the roster/office entirely. We now keep it and coerce the
        // status to 'idle' below instead of discarding the whole agent.
        if (!VALID_ROLES.includes(a.role)) return false
        if (seen.has(a.role)) return false
        seen.add(a.role)
        return true
      })
      .slice(0, 50)
      .map(a => ({
        role: a.role,
        // #52 — null/undefined/non-string/unknown status falls back to 'idle' (a known-safe enum
        // value), so a valid-role agent always renders. The store/roster never receive a raw null.
        status: VALID_STATUSES.includes(a.status) ? a.status : 'idle',
        task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
        label: typeof a.label === 'string' ? a.label.slice(0, 200) : null,
        hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : null,
        // AVO-110: carry the enum-validated blocked-reason through the POST ingest hop too
        // (parity with sanitizeAgent); anything else → null (render coerces → blocked-unknown).
        reasonCode: BLOCKED_REASONS.includes(a.reasonCode) ? a.reasonCode : null,
        // AVO-106: carry the per-agent active file through the POST /api/status ingest (parity
        // with sanitizeAgent). String, capped; anything else → null.
        activeFile: typeof a.activeFile === 'string' ? a.activeFile.slice(0, 200) : null,
      }))
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
    agents.push({
      role: key,
      task: isStatus ? null : val.slice(0, 200),
      status: isStatus ? val : 'working',
      label: typeof body.label === 'string' ? body.label.slice(0, 200) : null,
      hint: typeof body.hint === 'string' ? body.hint.slice(0, 200) : null,
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
