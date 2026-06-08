/**
 * Agent Router — maps arbitrary task/skill/workflow names to office characters
 * Three-tier routing: explicit role → keyword match → round-robin fallback
 */

import { VALID_STATUSES } from '../systems/constants.js'

const ROLE_KEYWORDS = {
  pm:       [/plan/i, /spec/i, /bootstrap/i, /manage/i, /schedule/i, /roadmap/i, /sprint/i, /standup/i, /priorit/i, /backlog/i],
  arch:     [/architect/i, /brainstorm/i, /decide/i, /diagram/i, /pattern/i, /\brfc\b/i, /structur/i, /schema/i, /system.design/i, /design.system/i],
  dev:      [/implement/i, /code/i, /develop/i, /build/i, /feature/i, /refactor/i, /\bfix\b/i, /write/i, /program/i, /commit/i, /merge/i],
  qa:       [/test/i, /review/i, /\blint\b/i, /check/i, /verify/i, /validate/i, /quality/i, /bug/i, /assert/i, /coverage/i],
  ops:      [/deploy/i, /ship/i, /release/i, /\bci\b/i, /\bcd\b/i, /infra/i, /monitor/i, /handoff/i, /docker/i, /publish/i],
  res:      [/research/i, /search/i, /explore/i, /learn/i, /analyze/i, /investigate/i, /\bread\b/i, /study/i, /survey/i],
  gate:     [/gate/i, /guard/i, /security/i, /\bauth(?:entication?|enticat\w*|oriz\w*|[nz])?\b/i, /permission/i, /approve/i, /compliance/i, /audit/i, /policy/i],
  designer: [/\bdesign\b/i, /\bui\b/i, /\bux\b/i, /style/i, /\bcss\b/i, /layout/i, /visual/i, /brand/i, /icon/i, /figma/i, /sketch/i, /color/i, /font/i, /spacing/i, /typography/i],
}

// Stable fallback order for activeCount distribution. The ARRAY's job is ordered
// iteration (tier-3 `.find`, routeTaskToAgent's priority loop, distributeFallbackCount's
// slice). Membership tests belong on a Set: isExplicitRoleId runs once per routed agent
// on the SSE/poll hot path, and an O(roles) Array.includes is the wrong primitive for an
// "is this a known role" check — FALLBACK_ROLE_SET makes it O(1).
const FALLBACK_ORDER = ['dev', 'qa', 'pm', 'ops', 'arch', 'res', 'designer', 'gate']
const FALLBACK_ROLE_SET = new Set(FALLBACK_ORDER)

// A role id is "explicit" if it is a bare VALID_ROLE or a multi-session composite
// 'slug~role' whose base (segment after the last '~') is a VALID_ROLE. Composite
// ids are produced by scanAndMerge for multi-worktree sessions and MUST be routed
// to their own dynamic character — not keyword-rerouted to a base role, which
// would collapse every worktree's agent onto a single shared character.
function isExplicitRoleId(role) {
  if (typeof role !== 'string' || role.length === 0) return false
  const sep = role.lastIndexOf('~')
  if (sep === -1) return FALLBACK_ROLE_SET.has(role)
  return sep > 0 && FALLBACK_ROLE_SET.has(role.slice(sep + 1))
}

// Legacy command→agent mapping (from old inferStatus.js)
const COMMAND_TO_AGENT = {
  '/bootstrap': 'pm', '/plan': 'pm', '/spec': 'pm', '/spec-intake': 'pm',
  '/brainstorm': 'arch', '/decide': 'arch',
  '/implement': 'dev',
  '/test': 'qa', '/review': 'qa', '/test-classify': 'qa',
  '/ship': 'ops', '/handoff': 'ops', '/retro': 'ops',
  '/research': 'res',
}

/**
 * Match a task string to the best-fit agent role via keyword scoring
 * @param {string} task
 * @returns {string|null} agentId or null
 */
export function routeTaskToAgent(task) {
  if (!task || typeof task !== 'string') return null

  // Check legacy command mapping first
  if (task.startsWith('/') && COMMAND_TO_AGENT[task]) {
    return COMMAND_TO_AGENT[task]
  }

  // Iterate FALLBACK_ORDER so tie-breaks use the same explicit priority as tier-3.
  // Object.entries() insertion order is spec-guaranteed but undocumented — use FALLBACK_ORDER
  // as the single documented source of role priority.
  let bestRole = null
  let bestScore = 0

  for (const role of FALLBACK_ORDER) {
    const patterns = ROLE_KEYWORDS[role]
    if (!patterns) continue
    let score = 0
    for (const pattern of patterns) {
      if (pattern.test(task)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestRole = role
    }
  }

  return bestRole
}

/**
 * Route an array of external agent-task entries to office character IDs
 * Avoids assigning two tasks to the same character
 * @param {Array<{role, task, status, label}>} agents
 * @returns {Array<{agentId, status, task, label}>}
 */
export function routeExternalAgents(agents) {
  if (!agents || agents.length === 0) return []

  const assigned = new Set()
  const results = []

  for (const entry of agents) {
    if (!entry || typeof entry !== 'object') continue
    let agentId = null
    // Recognize both bare ('dev') and composite ('feat-x~dev') role ids.
    const hasExplicitRole = isExplicitRoleId(entry.role)

    // Tier 1: explicit role
    if (hasExplicitRole && !assigned.has(entry.role)) {
      agentId = entry.role
    }

    // Tier 2: keyword match — only when no explicit valid role was specified;
    // an explicit role that happens to be taken should fall to tier 3, not reroute
    // the entry to a different character based on its task keywords.
    if (!agentId && !hasExplicitRole) {
      const matched = routeTaskToAgent(entry.task)
      if (matched && !assigned.has(matched)) {
        agentId = matched
      }
    }

    // Tier 3: first available from fallback order
    if (!agentId) {
      agentId = FALLBACK_ORDER.find(id => !assigned.has(id)) || null
    }

    if (agentId) {
      assigned.add(agentId)
      results.push({
        agentId,
        status: VALID_STATUSES.includes(entry.status) ? entry.status : 'working',
        task: entry.task || null,
        label: entry.label || null,
        hint: entry.hint || null,
        session: entry.session || null,
        reasonCode: entry.reasonCode || null,  // AVO-110: carry the validated blocked-reason through routing
      })
    }
  }

  return results
}

/**
 * For activeCount-only messages: stably select N agents as working
 * @param {number} count
 * @returns {string[]} array of agentIds
 */
export function distributeFallbackCount(count) {
  const num = Number(count)
  const n = Math.min(Math.max(0, Number.isFinite(num) ? Math.floor(num) : 0), FALLBACK_ORDER.length)
  return FALLBACK_ORDER.slice(0, n)
}
