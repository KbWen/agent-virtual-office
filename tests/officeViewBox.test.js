import { describe, it, expect } from 'vitest'
import { shouldUseRoster, SCENE_W, SCENE_H, MIN_READABLE_SCALE } from '../src/components/PixelOffice.jsx'
import NarrowRoster from '../src/components/NarrowRoster.jsx'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

// Responsive contract (widget-not-crop): the full 800×560 scene renders ONLY when the container
// can show it near-100%. A thin column OR a small-ish landscape window — anything that would shrink
// the room below MIN_READABLE_SCALE — switches to the dense roster widget. No scene crop ever.
describe('shouldUseRoster — scale-based scene/widget switch', () => {
  it('big / comfortable windows keep the full scene', () => {
    expect(shouldUseRoster(1280, 800)).toBe(false) // scale 1.43
    expect(shouldUseRoster(1000, 700)).toBe(false) // scale 1.25
    expect(shouldUseRoster(SCENE_W, SCENE_H)).toBe(false) // exactly 100%
  })

  it('a MODERATE small landscape window (the "still tiny original" case) uses the widget', () => {
    // 840×500 → scale 0.893 < 0.95 — this is the size the user saw as a shrunk, half-empty room.
    expect(shouldUseRoster(840, 500)).toBe(true)
    expect(shouldUseRoster(700, 500)).toBe(true)
  })

  it('a TALL-NARROW docked column uses the widget', () => {
    expect(shouldUseRoster(380, 950)).toBe(true)
    expect(shouldUseRoster(300, 800)).toBe(true)
  })

  it('the threshold is the meet-scale crossing MIN_READABLE_SCALE', () => {
    const justBelow = MIN_READABLE_SCALE - 0.02
    const justAbove = MIN_READABLE_SCALE + 0.02
    expect(shouldUseRoster(SCENE_W * justBelow, SCENE_H * justBelow)).toBe(true)
    expect(shouldUseRoster(SCENE_W * justAbove, SCENE_H * justAbove)).toBe(false)
  })

  it('defensive: non-finite / zero sizes never blank out (stay on the scene)', () => {
    expect(shouldUseRoster(NaN, 500)).toBe(false)
    expect(shouldUseRoster(800, 0)).toBe(false)
    expect(shouldUseRoster(undefined, undefined)).toBe(false)
  })

  it('the widget and the shared sprite are exported and importable', () => {
    expect(typeof NarrowRoster).toBe('function')
    expect(typeof CharacterPixelSprite).toBe('object') // React.memo wraps to an object
  })
})
