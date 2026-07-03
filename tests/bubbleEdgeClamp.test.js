import { describe, it, expect } from 'vitest'
import { computeEdgeShift } from '../src/systems/speechBubbleModel.mjs'

// #47 — speech bubbles for far-left/right desk agents clipped at the office svg edge (the viewBox is
// clipped). computeEdgeShift returns the local-unit horizontal shift that keeps the box inside
// [edgePad, sceneW − edgePad] while the tail stays on the agent. Helper asserts the resulting box
// scene-span lands within bounds (box scene edges = absX + (±boxW/2 + shift)·scale).
const SCENE_W = 800
const PAD = 4
function sceneSpan({ boxW, absX, scale = 1, shift }) {
  return {
    left: absX + (-boxW / 2 + shift) * scale,
    right: absX + (boxW / 2 + shift) * scale,
  }
}

describe('computeEdgeShift (#47 bubble edge clamp)', () => {
  it('a centered agent (room on both sides) gets no shift', () => {
    expect(computeEdgeShift({ boxW: 100, absX: 400, scale: 1, sceneW: SCENE_W, edgePad: PAD })).toBe(0)
  })

  it('a far-LEFT agent is pushed RIGHT enough to clear the left edge', () => {
    const boxW = 100, absX = 30, scale = 1
    const shift = computeEdgeShift({ boxW, absX, scale, sceneW: SCENE_W, edgePad: PAD })
    expect(shift).toBeGreaterThan(0)
    const { left } = sceneSpan({ boxW, absX, scale, shift })
    expect(left).toBeGreaterThanOrEqual(PAD - 0.001) // box no longer clips the left edge
  })

  it('a far-RIGHT agent is pushed LEFT enough to clear the right edge', () => {
    const boxW = 100, absX = 780, scale = 1
    const shift = computeEdgeShift({ boxW, absX, scale, sceneW: SCENE_W, edgePad: PAD })
    expect(shift).toBeLessThan(0)
    const { right } = sceneSpan({ boxW, absX, scale, shift })
    expect(right).toBeLessThanOrEqual(SCENE_W - PAD + 0.001)
  })

  it('accounts for labelScale (a shrunk office magnifies the bubble, so it needs a bigger shift)', () => {
    const boxW = 120
    const shiftAt1 = computeEdgeShift({ boxW, absX: 40, scale: 1, sceneW: SCENE_W, edgePad: PAD })
    const shiftAt2 = computeEdgeShift({ boxW, absX: 40, scale: 2, sceneW: SCENE_W, edgePad: PAD })
    // magnified bubble (scale 2) needs a strictly bigger local shift than at scale 1
    expect(shiftAt2).toBeGreaterThan(shiftAt1)
    // both clear the edge
    expect(sceneSpan({ boxW, absX: 40, scale: 1, shift: shiftAt1 }).left).toBeGreaterThanOrEqual(PAD - 0.001)
    expect(sceneSpan({ boxW, absX: 40, scale: 2, shift: shiftAt2 }).left).toBeGreaterThanOrEqual(PAD - 0.001)
  })

  it('an agent whose unshifted box is exactly edge-flush gets no shift (boundary)', () => {
    // left-flush: absX where left edge == PAD → absX = PAD + boxW/2 = 54 for boxW=100
    expect(computeEdgeShift({ boxW: 100, absX: 54, scale: 1, sceneW: SCENE_W, edgePad: PAD })).toBe(0)
    // right-flush: absX = sceneW - PAD - boxW/2 = 746
    expect(computeEdgeShift({ boxW: 100, absX: 746, scale: 1, sceneW: SCENE_W, edgePad: PAD })).toBe(0)
  })

  it('clamps to the PANEL crop bounds, not 0..800 (#47 panel mode — sceneMinX≠0)', () => {
    // Panel viewBox `80 110 440 440` → visible x [80, 520]. An agent at scene x=100 (right at the
    // crop's left edge) must be pushed right so the box stays inside the crop, not the 0..800 scene.
    const boxW = 100, absX = 100, scale = 1, sceneMinX = 80, sceneW = 440
    const shift = computeEdgeShift({ boxW, absX, scale, sceneMinX, sceneW, edgePad: PAD })
    expect(shift).toBeGreaterThan(0)
    const { left, right } = sceneSpan({ boxW, absX, scale, shift })
    expect(left).toBeGreaterThanOrEqual(sceneMinX + PAD - 0.001)   // inside the crop's left edge
    expect(right).toBeLessThanOrEqual(sceneMinX + sceneW - PAD + 0.001) // inside the crop's right edge
    // sanity: a 0..800 clamp would have left it unshifted (100 - 50 = 50 > 4), proving the bug
    expect(computeEdgeShift({ boxW, absX, scale, sceneW: 800, edgePad: PAD })).toBe(0)
  })

  it('returns 0 (no shift) when no scene context is supplied — back-compat', () => {
    expect(computeEdgeShift({ boxW: 100, absX: null })).toBe(0)
    expect(computeEdgeShift({ boxW: 100, absX: 400, scale: 0 })).toBe(0)
    expect(computeEdgeShift({ boxW: 100, absX: NaN, scale: 1 })).toBe(0)
  })

  it('best-effort keeps the RIGHT edge in when the box is wider than the whole scene', () => {
    const boxW = 1000, absX = 400, scale = 1 // box wider than 800-wide scene
    const shift = computeEdgeShift({ boxW, absX, scale, sceneW: SCENE_W, edgePad: PAD })
    const { right } = sceneSpan({ boxW, absX, scale, shift })
    expect(right).toBeLessThanOrEqual(SCENE_W - PAD + 0.001)
  })
})
