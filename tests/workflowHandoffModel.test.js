import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_HANDOFFS,
  WORKFLOW_HANDOFF_VERSION,
  buildWorkflowHandoffViewModel,
  normalizeWorkflowPhase,
  workflowHandoffForTransition,
  workflowHandoffRenderable,
  workflowTransitionKey,
} from '../src/systems/workflowHandoffModel.mjs'
import { WORKFLOW_HANDOFFS as LEGACY_WORKFLOW_HANDOFFS } from '../src/inference/workflowHandoff.js'

describe('workflowHandoffModel', () => {
  it('normalizes workflow phases without coupling to the app store', () => {
    expect(normalizeWorkflowPhase('/SHIP')).toBe('ship')
    expect(normalizeWorkflowPhase('  /Review  ')).toBe('review')
    expect(normalizeWorkflowPhase('')).toBeNull()
    expect(normalizeWorkflowPhase(null)).toBeNull()
  })

  it('maps explicit phase transitions to calm handoff actions', () => {
    expect(workflowTransitionKey('/plan', '/implement')).toBe('plan->implement')
    expect(workflowHandoffForTransition('/plan', '/implement')).toEqual({
      key: 'plan->implement',
      fromPhase: 'plan',
      toPhase: 'implement',
      from: 'arch',
      to: 'dev',
      subtle: true,
    })
  })

  it('does not fabricate boot, repeat, clear, or unmapped handoffs', () => {
    expect(workflowHandoffForTransition(null, '/plan')).toBeNull()
    expect(workflowHandoffForTransition('/plan', null)).toBeNull()
    expect(workflowHandoffForTransition('/plan', '/plan')).toBeNull()
    expect(workflowHandoffForTransition('/audit', '/retro')).toBeNull()
  })

  it('separates semantic transition decisions from renderability', () => {
    const handoff = workflowHandoffForTransition('/review', '/ship')

    expect(workflowHandoffRenderable(handoff, { gate: {}, ops: {} })).toBe(true)
    expect(workflowHandoffRenderable(handoff, { gate: {} })).toBe(false)
  })

  it('builds a renderer-facing view-model for alternate presentations', () => {
    expect(buildWorkflowHandoffViewModel({
      previousWorkflow: '/review',
      nextWorkflow: '/ship',
      agents: { gate: {}, ops: {} },
    })).toEqual({
      version: WORKFLOW_HANDOFF_VERSION,
      previousWorkflow: '/review',
      nextWorkflow: '/ship',
      key: 'review->ship',
      handoff: {
        key: 'review->ship',
        fromPhase: 'review',
        toPhase: 'ship',
        from: 'gate',
        to: 'ops',
        subtle: true,
      },
      renderable: true,
      action: { from: 'gate', to: 'ops', options: { subtle: true } },
    })
  })

  it('keeps the public transition table frozen', () => {
    expect(Object.isFrozen(WORKFLOW_HANDOFFS)).toBe(true)
    expect(Object.isFrozen(WORKFLOW_HANDOFFS['plan->implement'])).toBe(true)
  })

  it('matches the app hot-path handoff table', () => {
    expect(WORKFLOW_HANDOFFS).toEqual(LEGACY_WORKFLOW_HANDOFFS)
  })
})
