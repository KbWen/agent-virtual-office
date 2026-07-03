import { describe, expect, it } from 'vitest'
import {
  CONTEXT_BUBBLE_KIND,
  baseRoleForAgent,
  buildContextBubblePlan,
  contextBubbleCandidateKeys,
  extractContext,
  renderContextTemplate,
  skillBubbleFamily,
  skillBubbleKey,
  toolToAction,
} from '../src/systems/contextBubbleModel.mjs'

describe('contextBubbleModel public semantic API', () => {
  it('extracts context without importing i18n or rng', () => {
    expect(extractContext('1️⃣ first task')).toBe('first task')
    expect(extractContext('editing App.jsx')).toBe('App.jsx')
    expect(extractContext('plain text')).toBe('plain text')
    expect(extractContext(null)).toBeNull()
  })

  it('maps composite session ids to base roles', () => {
    expect(baseRoleForAgent('feat-x~dev')).toBe('dev')
    expect(baseRoleForAgent('qa')).toBe('qa')
    expect(baseRoleForAgent(null)).toBeNull()
  })

  it('returns ordered error and done template keys with extracted ctx', () => {
    expect(buildContextBubblePlan('feat-x~dev', {
      status: 'blocked',
      label: 'editing App.jsx',
    })).toMatchObject({
      kind: CONTEXT_BUBBLE_KIND.ERROR,
      baseRole: 'dev',
      ctx: 'App.jsx',
      keys: ['contextBubbles.dev-error', 'contextBubbles.any-error'],
    })

    expect(buildContextBubblePlan('qa', {
      status: 'done',
      label: 'searching flaky test',
    })).toMatchObject({
      kind: CONTEXT_BUBBLE_KIND.DONE,
      baseRole: 'qa',
      ctx: 'flaky test',
      keys: ['contextBubbles.qa-done', 'contextBubbles.any-done'],
    })
  })

  it('returns skill bubble keys only for working-phase skill updates', () => {
    expect(skillBubbleFamily('security-review')).toBe('review')
    expect(skillBubbleKey('some-custom-agent')).toBe('skillBubbles.generic')
    expect(buildContextBubblePlan('qa', {
      status: 'working',
      skill: 'review',
    })).toMatchObject({
      kind: CONTEXT_BUBBLE_KIND.SKILL,
      keys: ['skillBubbles.review'],
    })
    expect(buildContextBubblePlan('qa', {
      status: 'done',
      skill: 'review',
    })?.kind).toBe(CONTEXT_BUBBLE_KIND.DONE)
  })

  it('returns action keys with a working fallback for portable renderers', () => {
    expect(toolToAction('NotebookEdit')).toBe('edit')
    expect(buildContextBubblePlan('dev', {
      status: 'working',
      task: 'Edit',
      label: 'editing src/App.jsx',
    })).toMatchObject({
      kind: CONTEXT_BUBBLE_KIND.ACTION,
      action: 'edit',
      ctx: 'src/App.jsx',
      keys: ['contextBubbles.dev-edit'],
      fallbackKeys: ['contextBubbles.dev-working'],
    })
    expect(contextBubbleCandidateKeys('dev', { status: 'working', task: 'TodoWrite' })).toEqual([
      'contextBubbles.dev-generic',
      'contextBubbles.dev-working',
    ])
  })

  it('inserts ctx literally when rendering templates with dollar sequences', () => {
    expect(renderContextTemplate('editing {ctx}', 'price$&total.md')).toBe('editing price$&total.md')
    expect(renderContextTemplate('idle {ctx}', null)).toBe('idle')
    expect(renderContextTemplate(null, 'x')).toBeNull()
  })
})
