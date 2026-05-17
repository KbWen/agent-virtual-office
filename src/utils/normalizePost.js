import { VALID_ROLES, VALID_STATUSES } from '../systems/constants.js'
export { VALID_ROLES, VALID_STATUSES }
export const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
export const MAX_MOOD_DURATION = 3_600_000 // 1 hour

/**
 * Normalize POST body to the unified office-status format.
 * Handles both shorthand ({ dev: "working" }) and full format ({ type: "office-status", agents: [...] }).
 */
export function normalizePost(body) {
  if (body == null || typeof body !== 'object') body = {}
  if (body.type === 'office-status') {
    const agents = (Array.isArray(body.agents) ? body.agents : [])
      .filter(a => a && typeof a === 'object'
        && VALID_ROLES.includes(a.role)
        && VALID_STATUSES.includes(a.status))
      .slice(0, 50)
      .map(a => ({
        role: a.role,
        status: a.status,
        task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
        label: typeof a.label === 'string' ? a.label.slice(0, 200) : null,
        hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : null,
      }))
    return {
      type: 'office-status',
      agents,
      activeCount: agents.filter(a => a.status === 'working' || a.status === 'blocked').length,
      workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
      mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
      moodDuration: body.moodDuration == null ? null
        : Math.min(Math.max(Number.isFinite(Number(body.moodDuration)) ? Number(body.moodDuration) : 60000, 1000), MAX_MOOD_DURATION),
      source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
      _seq: String(Date.now()),
    }
  }
  const agents = []
  for (const key of VALID_ROLES) {
    const val = body[key]
    if (val == null) continue
    const isStatus = VALID_STATUSES.includes(val)
    agents.push({
      role: key,
      task: isStatus ? null : (typeof val === 'string' ? val.slice(0, 200) : null),
      status: isStatus ? val : 'working',
      label: typeof body.label === 'string' ? body.label.slice(0, 200) : null,
      hint: typeof body.hint === 'string' ? body.hint.slice(0, 200) : null,
    })
  }
  return {
    _seq: String(Date.now()),
    type: 'office-status',
    agents,
    activeCount: agents.filter(a => a.status === 'working' || a.status === 'blocked').length,
    workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
    source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
    mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
    moodDuration: body.moodDuration == null ? null : Math.min(Math.max(Number.isFinite(Number(body.moodDuration)) ? Number(body.moodDuration) : 60000, 1000), MAX_MOOD_DURATION),
  }
}
