/**
 * Agent Router — maps arbitrary task/skill/workflow names to office characters
 * Three-tier routing: explicit role → keyword match → round-robin fallback
 */

const ROLE_KEYWORDS = {
  pm:   [/plan/i, /spec/i, /bootstrap/i, /manage/i, /schedule/i, /roadmap/i, /sprint/i, /standup/i, /priorit/i, /backlog/i],
  arch: [/architect/i, /design/i, /brainstorm/i, /decide/i, /diagram/i, /pattern/i, /rfc/i, /structur/i, /schema/i],
  dev:  [/implement/i, /code/i, /develop/i, /build/i, /feature/i, /refactor/i, /fix/i, /write/i, /program/i, /commit/i, /merge/i],
  qa:   [/test/i, /review/i, /lint/i, /check/i, /verify/i, /validate/i, /quality/i, /bug/i, /assert/i, /coverage/i],
  ops:  [/deploy/i, /ship/i, /release/i, /ci/i, /cd/i, /infra/i, /monitor/i, /handoff/i, /docker/i, /publish/i],
  res:  [/research/i, /search/i, /explore/i, /learn/i, /analyze/i, /investigate/i, /read/i, /study/i, /survey/i],
  gate: [/gate/i, /guard/i, /security/i, /auth/i, /permission/i, /approve/i, /compliance/i, /audit/i, /policy/i],
}

// Stable fallback order for activeCount distribution
const FALLBACK_ORDER = ['dev', 'qa', 'pm', 'ops', 'arch', 'res', 'gate']

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
  if (!task) return null

  // Check legacy command mapping first
  if (task.startsWith('/') && COMMAND_TO_AGENT[task]) {
    return COMMAND_TO_AGENT[task]
  }

  let bestRole = null
  let bestScore = 0

  for (const [role, patterns] of Object.entries(ROLE_KEYWORDS)) {
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
    let agentId = null

    // Tier 1: explicit role
    if (entry.role && !assigned.has(entry.role)) {
      agentId = entry.role
    }

    // Tier 2: keyword match
    if (!agentId) {
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
        status: entry.status || 'working',
        task: entry.task || null,
        label: entry.label || null,
        hint: entry.hint || null,
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
  const n = Math.min(Math.max(0, count), FALLBACK_ORDER.length)
  return FALLBACK_ORDER.slice(0, n)
}
