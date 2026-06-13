import { describe, it, expect } from 'vitest'
import { THEMES, THEME_IDS, themeOverlay, cappedThemeOpacity, isValidTheme, THEME_OPACITY_CAP, THEME_LIGHTING_SUM_CAP } from '../src/systems/theme.js'
import { STATUS_COLORS } from '../src/systems/store.js'

// ── tiny WCAG contrast helpers (test-only) ──────────────────────────────────
function parseColor(c) {
  if (c.startsWith('#')) {
    const h = c.slice(1)
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
  }
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0]
}
const compositeOver = (base, tint, a) => base.map((b, i) => b * (1 - a) + tint[i] * a)
function relLum([r, g, b]) {
  const lin = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
function contrast(c1, c2) {
  const l1 = relLum(c1), l2 = relLum(c2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const FLOOR = parseColor('#F8F4E8')          // base office floor
const NIGHT = parseColor('rgb(20,24,52)')    // deep-night lighting fill
const NIGHT_OP = 0.38                          // lighting MAX_OPACITY (worst case)

describe('theme module (AVO-123)', () => {
  it('lists the shipped light-tint themes; default is the clear baseline', () => {
    expect(THEME_IDS).toEqual(['default', 'winter', 'autumn'])
    expect(themeOverlay('default').opacity).toBe(0)
  })
  it('every theme opacity is within the cap', () => {
    for (const t of THEMES) expect(t.opacity).toBeLessThanOrEqual(THEME_OPACITY_CAP)
  })
  it('isValidTheme guards unknown ids; themeOverlay falls back to default', () => {
    expect(isValidTheme('winter')).toBe(true)
    expect(isValidTheme('dark')).toBe(false)      // dropped — dark tint erodes ring contrast
    expect(isValidTheme('cyberpunk')).toBe(false)
    expect(themeOverlay('nope').opacity).toBe(0)
  })
  it('cappedThemeOpacity enforces the cap and the summed (theme+lighting) budget', () => {
    expect(cappedThemeOpacity(0.5, 0)).toBe(THEME_OPACITY_CAP)          // single cap
    expect(cappedThemeOpacity(0.2, 0.38)).toBeCloseTo(0.07, 5)          // 0.45 - 0.38 budget left
    expect(cappedThemeOpacity(0.18, 0.40)).toBeCloseTo(0.05, 5)         // lighting eats most budget
    expect(cappedThemeOpacity(0.18, 0.45)).toBe(0)                       // no budget → no theme tint
    expect(cappedThemeOpacity(0, 0)).toBe(0)
  })
})

describe('theme legibility guard (AVO-123) — status rings stay readable over every theme', () => {
  // For each theme, composite its tint (at the rendered cap) over the floor, AND the worst-case
  // night-lighting+theme stack, then assert each status ring keeps contrast ≥ 85% of its Default
  // (untinted) contrast vs the floor. Build fails if any theme erodes a status ring's legibility.
  const statuses = Object.keys(STATUS_COLORS)
  const baseline = {}
  for (const s of statuses) baseline[s] = contrast(parseColor(STATUS_COLORS[s]), FLOOR)

  for (const t of THEMES) {
    it(`theme "${t.id}" keeps every status ring ≥ 85% of baseline contrast (floor + night stack)`, () => {
      const themeOp = themeOverlay(t.id).opacity
      const tintFloor = compositeOver(FLOOR, parseColor(t.fill), themeOp)
      const stackOp = cappedThemeOpacity(themeOp, NIGHT_OP)
      const nightThemeFloor = compositeOver(compositeOver(FLOOR, NIGHT, NIGHT_OP), parseColor(t.fill), stackOp)
      for (const s of statuses) {
        const ring = parseColor(STATUS_COLORS[s])
        expect(contrast(ring, tintFloor), `${t.id}/${s} tint-floor`).toBeGreaterThanOrEqual(baseline[s] * 0.85)
        expect(contrast(ring, nightThemeFloor), `${t.id}/${s} night+theme`).toBeGreaterThanOrEqual(1.05)
      }
    })
  }
})
