import { describe, it, expect } from 'vitest'
import { getLightingOverlay } from './lighting'

const RGB = /^rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)$/

function parseRgb(fill) {
  const m = fill.match(RGB)
  expect(m, `fill should be rgb(): ${fill}`).toBeTruthy()
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

describe('getLightingOverlay — time-of-day color grade', () => {
  it('returns an SVG-ready rgb() fill and a 0..1 opacity for every hour', () => {
    for (let h = 0; h < 24; h++) {
      const { fill, opacity } = getLightingOverlay(h)
      const [r, g, b] = parseRgb(fill)
      for (const c of [r, g, b]) expect(c).toBeGreaterThanOrEqual(0), expect(c).toBeLessThanOrEqual(255)
      expect(opacity).toBeGreaterThanOrEqual(0)
      expect(opacity).toBeLessThanOrEqual(1)
    }
  })

  it('is fully clear (no tint) through the working midday 9–16', () => {
    for (let h = 9; h <= 16; h++) {
      expect(getLightingOverlay(h).opacity).toBe(0)
    }
  })

  it('is deep night at the day boundaries (0, 23)', () => {
    expect(getLightingOverlay(0).opacity).toBeCloseTo(0.45, 3)
    expect(getLightingOverlay(23).opacity).toBeCloseTo(0.45, 3)
    // and dark — low channel sum
    const [r, g, b] = parseRgb(getLightingOverlay(0).fill)
    expect(r + g + b).toBeLessThan(60)
  })

  it('transitions smoothly — no adjacent-hour opacity jump exceeds 0.16', () => {
    let prev = getLightingOverlay(0).opacity
    let maxJump = 0
    for (let h = 1; h <= 23; h++) {
      const op = getLightingOverlay(h).opacity
      maxJump = Math.max(maxJump, Math.abs(op - prev))
      prev = op
    }
    // wrap 23 -> 0 too
    maxJump = Math.max(maxJump, Math.abs(getLightingOverlay(0).opacity - prev))
    expect(maxJump).toBeLessThanOrEqual(0.16)
  })

  it('evening dusk is dimmer than midday and dawn is warm (red >= blue at hour 7)', () => {
    expect(getLightingOverlay(20).opacity).toBeGreaterThan(getLightingOverlay(13).opacity)
    const [r, , b] = parseRgb(getLightingOverlay(7).fill)
    expect(r).toBeGreaterThanOrEqual(b) // dawn tint skews warm
  })

  it('falls back to deep night for non-finite input and wraps out-of-range hours', () => {
    expect(getLightingOverlay(undefined).opacity).toBeCloseTo(0.45, 3)
    expect(getLightingOverlay(NaN).opacity).toBeCloseTo(0.45, 3)
    // 24 wraps to 0
    expect(getLightingOverlay(24)).toEqual(getLightingOverlay(0))
  })
})
