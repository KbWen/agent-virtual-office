import { describe, it, expect } from 'vitest'
import { computeSceneScale, SCENE_W, SCENE_H } from '../src/components/PixelOffice.jsx'
import { computeLabelScale, LABEL_SCALE_MAX } from '../src/components/AgentCharacter.jsx'

// POINT 2: when the office is docked small it renders below its native 800×560 (preserveAspectRatio
// "meet"), shrinking every in-scene label. computeSceneScale reports that shrink; computeLabelScale
// turns it into the counter-scale the label group applies so glance-text holds a constant on-screen
// size. These two pure fns carry the whole readability contract — assert their behaviour, not the formula.

describe('computeSceneScale — office meet-scale = min(width-fit, height-fit)', () => {
  it('returns 1 when the box matches the native scene exactly (no shrink)', () => {
    expect(computeSceneScale(SCENE_W, SCENE_H)).toBe(1)
  })

  it('returns the uniform ratio when the box is a clean fraction of native', () => {
    expect(computeSceneScale(SCENE_W / 2, SCENE_H / 2)).toBe(0.5) // 400×280 → 0.5
  })

  it('can exceed 1 when the office is rendered larger than native', () => {
    expect(computeSceneScale(SCENE_W * 2, SCENE_H * 2)).toBe(2)
  })

  it('is bound by HEIGHT when the box is wide but short (meet, not slice)', () => {
    // 800 wide → 1.0 fit, but 280 tall → 0.5 fit; meet takes the smaller so nothing clips
    expect(computeSceneScale(800, 280)).toBe(0.5)
  })

  it('is bound by WIDTH when the box is tall but narrow', () => {
    expect(computeSceneScale(400, 560)).toBe(0.5)
  })

  it('returns 1 (safe no-op) for a pre-layout / degenerate box', () => {
    expect(computeSceneScale(0, 0)).toBe(1)
    expect(computeSceneScale(800, 0)).toBe(1)
    expect(computeSceneScale(-10, 560)).toBe(1)
    expect(computeSceneScale(NaN, NaN)).toBe(1)
  })
})

describe('computeLabelScale — counter-scale that holds on-screen text size', () => {
  it('does NOT counter-scale at native size (factor 1)', () => {
    expect(computeLabelScale(1)).toBe(1)
  })

  it('does NOT counter-scale when the office is bigger than native (labels ride it up)', () => {
    expect(computeLabelScale(1.5)).toBe(1)
    expect(computeLabelScale(2)).toBe(1)
  })

  it('inverts the shrink so net on-screen size stays constant (scene 0.8 → 1.25)', () => {
    expect(computeLabelScale(0.8)).toBeCloseTo(1.25, 5)
    // net on-screen text size = sceneScale * labelScale → ~1.0 (constant)
    expect(0.8 * computeLabelScale(0.8)).toBeCloseTo(1, 5)
  })

  it('caps at LABEL_SCALE_MAX so a tiny office cannot blow labels up into each other', () => {
    expect(computeLabelScale(0.5)).toBe(LABEL_SCALE_MAX) // 1/0.5 = 2 → clamped down to the cap
    expect(computeLabelScale(0.1)).toBe(LABEL_SCALE_MAX) // would be 10× → clamped
  })

  it('reaches full size (net 1.0) exactly at the cap threshold scene = 1/MAX (overlap guard)', () => {
    // Below this scene the cap holds labels under full size so adjacent active agents do not
    // collide; at/above it the office is spread enough that net-1.0 labels clear. See the
    // LABEL_SCALE_MAX rationale comment in AgentCharacter.jsx.
    const sceneAtCap = 1 / LABEL_SCALE_MAX
    expect(computeLabelScale(sceneAtCap)).toBeCloseTo(LABEL_SCALE_MAX, 5)
    expect(sceneAtCap * computeLabelScale(sceneAtCap)).toBeCloseTo(1, 5) // net = full size here
    // Just below the threshold the cap binds → net stays UNDER full size (no overlap blowup).
    const below = sceneAtCap * 0.9
    expect(below * computeLabelScale(below)).toBeLessThan(1)
  })

  it('honours a custom cap argument', () => {
    expect(computeLabelScale(0.25, 3)).toBe(3) // 1/0.25 = 4 → clamped to 3
    expect(computeLabelScale(0.5, 3)).toBe(2)  // 1/0.5  = 2 < 3 → uncapped
  })

  it('returns 1 (safe no-op) for a degenerate scale', () => {
    expect(computeLabelScale(0)).toBe(1)
    expect(computeLabelScale(-1)).toBe(1)
    expect(computeLabelScale(NaN)).toBe(1)
  })

  it('LABEL_SCALE_MAX is a sane readability ceiling (1 < cap ≤ 3)', () => {
    expect(LABEL_SCALE_MAX).toBeGreaterThan(1)
    expect(LABEL_SCALE_MAX).toBeLessThanOrEqual(3)
  })
})
