export const WORKFLOW_HANDOFF_VERSION = 'workflow-handoff-v1'

export const WORKFLOW_HANDOFFS = Object.freeze({
  'spec-intake->spec': Object.freeze({ from: 'pm', to: 'arch' }),
  'spec->plan': Object.freeze({ from: 'arch', to: 'pm' }),
  'plan->implement': Object.freeze({ from: 'arch', to: 'dev' }),
  'implement->test': Object.freeze({ from: 'dev', to: 'qa' }),
  'implement->review': Object.freeze({ from: 'dev', to: 'gate' }),
  'test->review': Object.freeze({ from: 'qa', to: 'gate' }),
  'review->ship': Object.freeze({ from: 'gate', to: 'ops' }),
})

export function normalizeWorkflowPhase(workflow) {
  if (typeof workflow !== 'string' || workflow.length === 0) return null
  const normalized = workflow.trim().replace(/^\/+/, '').toLowerCase()
  return normalized || null
}

export function workflowTransitionKey(previousWorkflow, nextWorkflow) {
  const fromPhase = normalizeWorkflowPhase(previousWorkflow)
  const toPhase = normalizeWorkflowPhase(nextWorkflow)
  if (!fromPhase || !toPhase) return null
  if (fromPhase === toPhase) return null
  return `${fromPhase}->${toPhase}`
}

export function workflowHandoffForTransition(previousWorkflow, nextWorkflow) {
  const key = workflowTransitionKey(previousWorkflow, nextWorkflow)
  if (!key) return null
  const handoff = WORKFLOW_HANDOFFS[key]
  if (!handoff) return null
  const [fromPhase, toPhase] = key.split('->')
  return {
    key,
    fromPhase,
    toPhase,
    from: handoff.from,
    to: handoff.to,
    subtle: true,
  }
}

export function workflowHandoffRenderable(handoff, agents = {}) {
  if (!handoff) return false
  return Boolean(agents[handoff.from] && agents[handoff.to])
}

export function buildWorkflowHandoffViewModel({
  previousWorkflow = null,
  nextWorkflow = null,
  agents = {},
} = {}) {
  const handoff = workflowHandoffForTransition(previousWorkflow, nextWorkflow)
  const renderable = workflowHandoffRenderable(handoff, agents)
  return {
    version: WORKFLOW_HANDOFF_VERSION,
    previousWorkflow,
    nextWorkflow,
    key: handoff?.key ?? null,
    handoff,
    renderable,
    action: renderable
      ? { from: handoff.from, to: handoff.to, options: { subtle: handoff.subtle } }
      : null,
  }
}
