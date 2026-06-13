import { describe, it, expect } from 'vitest'
import { rainTargetGain, meanIntervalForPulse, initSoundscapeEnabled, MASTER_CAP } from './ambientSound'

// vitest has no AudioContext, so these cover the PURE gate/honesty logic only.
// The audio lifecycle (silence@0, clatter-rises, suspend-on-off, no-autoplay-warning)
// is verified separately via headless Playwright per docs/specs/ambient-soundscape.md.

describe('rainTargetGain — honesty double-gate', () => {
  it('is silent unless weatherEffects is ON', () => {
    expect(rainTargetGain('frustrated', false, false)).toBe(0)
    expect(rainTargetGain('stuck', false, false)).toBe(0)
  })

  it('is silent under prefers-reduced-motion even when it would rain', () => {
    expect(rainTargetGain('frustrated', true, true)).toBe(0)
    expect(rainTargetGain('stuck', true, true)).toBe(0)
  })

  it('plays for frustrated (rain) and louder for stuck (storm) when both gates are open', () => {
    const rain = rainTargetGain('frustrated', true, false)
    const storm = rainTargetGain('stuck', true, false)
    expect(rain).toBeGreaterThan(0)
    expect(storm).toBeGreaterThan(rain)
    expect(storm).toBeLessThanOrEqual(MASTER_CAP) // never exceeds the master ceiling
  })

  it('is silent for every non-rainy mood even with gates open', () => {
    for (const m of ['normal', 'smooth', 'intense', 'idle', 'rushing']) {
      expect(rainTargetGain(m, true, false)).toBe(0)
    }
  })
})

describe('meanIntervalForPulse — keyboard bed (honest silence at zero)', () => {
  it('returns Infinity at/below zero pulse (no taps scheduled — true silence)', () => {
    expect(meanIntervalForPulse(0)).toBe(Infinity)
    expect(meanIntervalForPulse(-0.5)).toBe(Infinity)
    expect(meanIntervalForPulse(undefined)).toBe(Infinity)
  })

  it('gets faster (shorter interval) as the real pulse rises', () => {
    expect(meanIntervalForPulse(1)).toBeLessThan(meanIntervalForPulse(0.5))
    expect(meanIntervalForPulse(0.5)).toBeLessThan(meanIntervalForPulse(0.1))
  })

  it('clamps pulse > 1 to the fastest finite interval (no machine-gun overshoot)', () => {
    expect(meanIntervalForPulse(5)).toBe(meanIntervalForPulse(1))
    expect(Number.isFinite(meanIntervalForPulse(1))).toBe(true)
  })
})

describe('initSoundscapeEnabled — default OFF, reduced-motion force-off', () => {
  const mkWin = (stored, reduced = false) => ({
    localStorage: { getItem: () => stored },
    matchMedia: (q) => ({ matches: reduced && q.includes('reduced-motion') }),
  })

  it('defaults OFF when there is no stored preference', () => {
    expect(initSoundscapeEnabled(mkWin(null))).toBe(false)
  })

  it('reads a stored on/off preference', () => {
    expect(initSoundscapeEnabled(mkWin('on'))).toBe(true)
    expect(initSoundscapeEnabled(mkWin('off'))).toBe(false)
  })

  it('forces OFF under prefers-reduced-motion even if stored ON', () => {
    expect(initSoundscapeEnabled(mkWin('on', true))).toBe(false)
  })

  it('is OFF when there is no window (SSR-safe)', () => {
    expect(initSoundscapeEnabled(undefined)).toBe(false)
  })
})
