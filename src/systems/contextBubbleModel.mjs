export const CONTEXT_BUBBLE_KIND = Object.freeze({
  ERROR: 'error',
  DONE: 'done',
  SKILL: 'skill',
  ACTION: 'action',
  WORKING: 'working',
  CROSS_REACTION: 'cross-reaction',
  GOSSIP: 'gossip',
})

export const SKILL_BUBBLE_FAMILIES = Object.freeze([
  { pattern: /plan/i, family: 'plan' },
  { pattern: /spec|bootstrap/i, family: 'spec' },
  { pattern: /review/i, family: 'review' },
  { pattern: /test/i, family: 'test' },
  { pattern: /implement|code/i, family: 'implement' },
  { pattern: /fix|debug/i, family: 'fix' },
  { pattern: /ship|deploy/i, family: 'ship' },
  { pattern: /research|explore/i, family: 'research' },
  { pattern: /architect|design/i, family: 'architect' },
  { pattern: /security|audit/i, family: 'security' },
])

export function extractContext(label) {
  if (!label) return null
  const stripped = String(label)
    .replace(/^(?:[\p{Extended_Pictographic}\u200d\ufe0f]|[0-9#*]\ufe0f?\u20e3|\s)+/u, '')
    .replace(/^(改|寫|讀|找|搜|跑|派)\s*/u, '')
    .replace(/^(editing|writing|reading|searching|running)\s*/i, '')
    .trim()
  return stripped || null
}

export function baseRoleForAgent(agentId) {
  if (typeof agentId !== 'string' || agentId.length === 0) return null
  return agentId.includes('~') ? agentId.split('~').pop() : agentId
}

export function toolToAction(task) {
  if (!task) return null
  switch (task) {
    case 'Edit': return 'edit'
    case 'Write': return 'write'
    case 'Read': return 'read'
    case 'Bash': return 'bash'
    case 'Grep':
    case 'Glob': return 'search'
    case 'Agent': return 'delegate'
    case 'WebFetch':
    case 'WebSearch': return 'web'
    case 'NotebookEdit': return 'edit'
    default: return 'generic'
  }
}

export function skillBubbleFamily(skill) {
  if (!skill || typeof skill !== 'string') return null
  for (const { pattern, family } of SKILL_BUBBLE_FAMILIES) {
    if (pattern.test(skill)) return family
  }
  return 'generic'
}

export function skillBubbleKey(skill) {
  const family = skillBubbleFamily(skill)
  return family ? `skillBubbles.${family}` : null
}

export function renderContextTemplate(template, ctx) {
  if (typeof template !== 'string') return null
  return ctx
    ? template.replace(/\{ctx\}/g, () => ctx)
    : template.replace(/\s*\{ctx\}\s*/g, '')
}

export function buildContextBubblePlan(agentId, update) {
  if (!update || typeof agentId !== 'string') return null

  const baseRole = baseRoleForAgent(agentId)
  if (!baseRole) return null

  const { status, task, label, hint, skill } = update
  const ctx = extractContext(label)
  const action = toolToAction(task)

  if (hint === 'error' || status === 'blocked') {
    return {
      kind: CONTEXT_BUBBLE_KIND.ERROR,
      baseRole,
      ctx,
      keys: [`contextBubbles.${baseRole}-error`, 'contextBubbles.any-error'],
    }
  }

  if (status === 'done') {
    return {
      kind: CONTEXT_BUBBLE_KIND.DONE,
      baseRole,
      ctx,
      keys: [`contextBubbles.${baseRole}-done`, 'contextBubbles.any-done'],
    }
  }

  if (skill && status !== 'blocked' && status !== 'done') {
    const key = skillBubbleKey(skill)
    if (key) {
      return {
        kind: CONTEXT_BUBBLE_KIND.SKILL,
        baseRole,
        ctx: skillBubbleFamily(skill) === 'generic' ? skill : null,
        skill,
        keys: [key],
      }
    }
  }

  if (action) {
    return {
      kind: CONTEXT_BUBBLE_KIND.ACTION,
      baseRole,
      action,
      ctx,
      keys: [`contextBubbles.${baseRole}-${action}`],
      fallbackKeys: [`contextBubbles.${baseRole}-working`],
    }
  }

  return {
    kind: CONTEXT_BUBBLE_KIND.WORKING,
    baseRole,
    ctx,
    keys: [`contextBubbles.${baseRole}-working`],
  }
}

export function contextBubbleCandidateKeys(agentId, update) {
  const plan = buildContextBubblePlan(agentId, update)
  if (!plan) return []
  return [...plan.keys, ...(plan.fallbackKeys || [])]
}
