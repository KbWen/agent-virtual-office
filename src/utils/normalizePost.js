export const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate']
export const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']
export const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
export const MAX_MOOD_DURATION = 3_600_000 // 1 hour

/**
 * Normalize POST body to the unified office-status format.
 * Handles both shorthand ({ dev: "working" }) and full format ({ type: "office-status", agents: [...] }).
 */
export function normalizePost(body) {
  if (body.type === 'office-status') {
    if (Array.isArray(body.agents)) {
      body.agents = body.agents.filter(a =>
        VALID_ROLES.includes(a.role) && VALID_STATUSES.includes(a.status)
      ).map(a => ({ ...a, hint: a.hint || null }))
    }
    if (body.mood) body.mood = VALID_MOODS.includes(body.mood) ? body.mood : null
    if (body.moodDuration) body.moodDuration = Math.min(Number(body.moodDuration) || 60000, MAX_MOOD_DURATION)
    // Ensure _seq is always set (used for dedup + staleness)
    if (!body._seq) body._seq = String(Date.now())
    return body
  }
  const agents = []
  for (const key of VALID_ROLES) {
    const val = body[key]
    if (val == null) continue
    const isStatus = VALID_STATUSES.includes(val)
    agents.push({
      role: key,
      task: isStatus ? null : val,
      status: isStatus ? val : 'working',
      label: body.label || null,
      hint: body.hint || null,
    })
  }
  return {
    _seq: String(Date.now()),
    type: 'office-status',
    agents,
    activeCount: agents.filter(a => a.status !== 'done').length,
    workflow: body.workflow || null,
    source: body.source || 'api',
    mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
    moodDuration: body.moodDuration ? Math.min(Number(body.moodDuration) || 60000, MAX_MOOD_DURATION) : null,
  }
}
