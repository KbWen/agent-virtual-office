import { describe, expect, it } from 'vitest'
import { healthDotState } from '../src/systems/integrationStatusModel.js'
import * as nodeSafeIntegrationStatusModel from '../src/systems/integrationStatusModel.mjs'

describe('integrationStatusModel healthDotState', () => {
  const ok = { state: 'online' }

  it('uses severity precedence: offline > degraded > fallback > live > idle', () => {
    expect(healthDotState({ statusSource: 'external', integrationHealth: { state: 'offline' } }).level).toBe('offline')
    expect(healthDotState({ statusSource: 'external', integrationHealth: { state: 'degraded' } }).level).toBe('degraded')
    expect(healthDotState({ statusSource: 'fallback', integrationHealth: ok }).level).toBe('fallback')
    expect(healthDotState({ statusSource: 'external', integrationHealth: ok }).level).toBe('live')
    expect(healthDotState({ statusSource: 'local', integrationHealth: ok }).level).toBe('idle')
  })

  it('returns a renderer-agnostic label/tone model', () => {
    expect(healthDotState({ integrationHealth: { state: 'offline' } })).toMatchObject({
      level: 'offline',
      trouble: true,
      tone: 'red',
      pulse: false,
      labelKey: 'status.apiOffline',
      labelVal: null,
    })
    expect(healthDotState({ statusSource: 'fallback', externalCount: 3 })).toMatchObject({
      level: 'fallback',
      trouble: true,
      tone: 'amber',
      pulse: true,
      labelKey: 'ui.fallbackAgents',
      labelVal: 3,
    })
  })

  it('keeps the node-safe mjs entry equivalent to the app entry', () => {
    const input = { statusSource: 'external', integrationHealth: { state: 'degraded' }, externalCount: 2 }
    expect(nodeSafeIntegrationStatusModel.healthDotState(input)).toEqual(healthDotState(input))
  })
})
