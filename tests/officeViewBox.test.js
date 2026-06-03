import { describe, it, expect } from 'vitest'
import { computeOfficeViewBox, FULL_OFFICE_VIEWBOX, PORTRAIT_RATIO } from '../src/components/PixelOffice.jsx'

const parse = (vb) => vb.split(' ').map(Number) // [x, y, w, h]

describe('computeOfficeViewBox — adaptive office framing (responsive narrow-window)', () => {
  it('WIDE / SQUARE windows are BYTE-IDENTICAL to the legacy full room (no regression)', () => {
    for (const ratio of [PORTRAIT_RATIO, 1.0, 1.2, 1.6, 1.78, 2.4, 3.5]) {
      expect(computeOfficeViewBox(ratio)).toBe('0 0 800 560')
      expect(computeOfficeViewBox(ratio)).toBe(FULL_OFFICE_VIEWBOX)
    }
  })

  it('defensive: NaN / non-finite ratio falls back to the full room', () => {
    expect(computeOfficeViewBox(NaN)).toBe(FULL_OFFICE_VIEWBOX)
    expect(computeOfficeViewBox(Infinity)).toBe(FULL_OFFICE_VIEWBOX)
    expect(computeOfficeViewBox(undefined)).toBe(FULL_OFFICE_VIEWBOX)
  })

  it('PORTRAIT (tall-narrow) windows get a zoomed crop, not the full 800-wide room', () => {
    for (const ratio of [0.9, 0.6, 0.4, 0.3]) {
      const vb = computeOfficeViewBox(ratio)
      expect(vb).not.toBe(FULL_OFFICE_VIEWBOX)
      const [, , w] = parse(vb)
      expect(w).toBeLessThan(800)          // zoomed in vs the full room
      expect(w).toBeLessThanOrEqual(420)   // genuinely tighter (the docked-column win)
    }
  })

  it('the portrait crop NEVER leaves the room bounds (no dark void / 破版)', () => {
    const [x, y, w, h] = parse(computeOfficeViewBox(0.5))
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(800)
    expect(y + h).toBeLessThanOrEqual(560)
  })

  it('the portrait crop is taller-than-wide (fills a tall column better than a wide crop)', () => {
    const [, , w, h] = parse(computeOfficeViewBox(0.5))
    expect(h).toBeGreaterThan(w)
  })
})
