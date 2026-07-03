import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  EVENT_JUICE,
  JUICED_EVENT_IDS,
  buildEventJuiceViewModel,
  juiceForEvent,
  shouldShakeDesk,
} from '../src/systems/eventJuiceModel.mjs'
import {
  JUICED_EVENT_IDS as LEGACY_JUICED_EVENT_IDS,
  juiceForEvent as legacyJuiceForEvent,
  shouldShakeDesk as legacyShouldShakeDesk,
} from '../src/systems/eventJuice.js'

describe('eventJuiceModel public API', () => {
  it('matches legacy juice descriptors and reduced-motion gating', () => {
    expect([...JUICED_EVENT_IDS].sort()).toEqual([...LEGACY_JUICED_EVENT_IDS].sort())
    expect(juiceForEvent('deploy-success')).toMatchObject(legacyJuiceForEvent('deploy-success'))
    expect(juiceForEvent('eureka')).toMatchObject(legacyJuiceForEvent('eureka'))
    expect(juiceForEvent('deploy-success', { reducedMotion: true })).toBeNull()
    expect(juiceForEvent('standup')).toBeNull()
  })

  it('keeps desk shake parity with legacy gate', () => {
    expect(shouldShakeDesk('desk-slam', false)).toBe(legacyShouldShakeDesk('desk-slam', false))
    expect(shouldShakeDesk('desk-slam', true)).toBe(false)
    expect(shouldShakeDesk('typing', false)).toBe(false)
  })

  it('returns a cosmetic-only renderer view-model', () => {
    const model = buildEventJuiceViewModel('deploy-success')

    expect(model).toMatchObject({
      visible: true,
      eventId: 'deploy-success',
      pointerEvents: 'none',
      ariaHidden: true,
      semanticState: false,
      juice: {
        kind: 'confetti',
        count: 14,
        durationMs: 1200,
        animationName: 'office-confetti',
        delayStepMs: 40,
        anchor: { x: 360, y: 130 },
        semanticState: false,
      },
    })
    expect(model.particles).toHaveLength(14)
    expect(model.particles[1]).toMatchObject({ key: 'deploy-success-1', delayMs: 40 })
  })

  it('returns a stable hidden model for reduced motion and unknown events', () => {
    expect(buildEventJuiceViewModel('eureka', { reducedMotion: true })).toEqual({
      visible: false,
      eventId: 'eureka',
      juice: null,
      particles: [],
      semanticState: false,
    })
    expect(buildEventJuiceViewModel('standup').visible).toBe(false)
  })

  it('keeps public overlay tokens in parity with PixelOffice hardcoded renderer values', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(path.join(here, '../src/components/PixelOffice.jsx'), 'utf8')
    const deploy = EVENT_JUICE['deploy-success']
    const eureka = EVENT_JUICE.eureka

    for (const juice of Object.values(EVENT_JUICE)) {
      expect(source).toContain(juice.animationName)
      expect(source).toContain(`juice.durationMs`)
      expect(source).toContain(`i * ${juice.delayStepMs}`)
      expect(source).toContain(`juice.count`)
    }
    expect(source).toContain(`const cx = ${deploy.anchor.x}, cy = ${deploy.anchor.y}`)
    expect(source).toContain(`const bx = ${eureka.anchor.x}, by = ${eureka.anchor.y}`)
    expect(source).toContain(`bx + ${eureka.offset.x} + Math.cos(ang) * ${eureka.radius.x}`)
    expect(source).toContain(`by + ${eureka.offset.y} + Math.sin(ang) * ${eureka.radius.y}`)
  })
})
