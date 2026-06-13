import { describe, it, expect } from 'vitest'
import { juiceForEvent, shouldShakeDesk, JUICED_EVENT_IDS } from '../src/systems/eventJuice.js'

describe('juiceForEvent (AVO-136)', () => {
  it('returns a confetti descriptor for deploy-success', () => {
    const j = juiceForEvent('deploy-success')
    expect(j).toMatchObject({ kind: 'confetti', eventId: 'deploy-success' })
    expect(j.count).toBeGreaterThan(0)
    expect(j.durationMs).toBeGreaterThan(0)
  })
  it('returns a sparkle descriptor for eureka', () => {
    expect(juiceForEvent('eureka')).toMatchObject({ kind: 'sparkle', eventId: 'eureka' })
  })
  it('returns null under reduced-motion (motion fully disabled)', () => {
    expect(juiceForEvent('deploy-success', { reducedMotion: true })).toBeNull()
    expect(juiceForEvent('eureka', { reducedMotion: true })).toBeNull()
  })
  it('returns null for non-juiced / unknown / missing events (rare-only, no idle loop)', () => {
    expect(juiceForEvent('standup')).toBeNull()
    expect(juiceForEvent('tea-break')).toBeNull()
    expect(juiceForEvent(undefined)).toBeNull()
    expect(juiceForEvent(null)).toBeNull()
  })
  it('JUICED_EVENT_IDS lists exactly the juiced events', () => {
    expect([...JUICED_EVENT_IDS].sort()).toEqual(['deploy-success', 'eureka'])
  })
})

describe('shouldShakeDesk (AVO-136)', () => {
  it('shakes only on desk-slam behavior and only when not reduced-motion', () => {
    expect(shouldShakeDesk('desk-slam', false)).toBe(true)
    expect(shouldShakeDesk('desk-slam', true)).toBe(false)   // reduced-motion → posture/expression remain, no jitter
    expect(shouldShakeDesk('typing', false)).toBe(false)
    expect(shouldShakeDesk(undefined, false)).toBe(false)
  })
})
