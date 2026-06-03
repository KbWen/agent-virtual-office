import { describe, it, expect } from 'vitest'
import { shouldUseRoster, MIN_SCENE_WIDTH, MIN_SCENE_HEIGHT } from '../src/components/PixelOffice.jsx'
import NarrowRoster from '../src/components/NarrowRoster.jsx'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

// Contract: the office SCENE is the default for any reasonably-shaped window — it stays readable
// via a scale floor (held near 100%, scroll to pan) instead of shrinking to a tiny strip. The
// roster widget is a SPECIAL fallback, only for genuinely cramped frames (thin column / short
// strip). No scene crop ever.
describe('shouldUseRoster — widget is a special fallback, scene is the default', () => {
  it('big / comfortable windows use the scene', () => {
    expect(shouldUseRoster(1280, 800)).toBe(false)
    expect(shouldUseRoster(1000, 700)).toBe(false)
  })

  it('a MODERATE small / short landscape window keeps the (scale-floored) scene, NOT the widget', () => {
    // 840×500 is the case the user saw shrunk; it must now stay the scene (floored to ~100%).
    expect(shouldUseRoster(840, 500)).toBe(false)
    expect(shouldUseRoster(700, 520)).toBe(false)
    expect(shouldUseRoster(960, 540)).toBe(false)
  })

  it('a THIN docked column (narrower than the office can show) falls back to the widget', () => {
    expect(shouldUseRoster(380, 950)).toBe(true)
    expect(shouldUseRoster(MIN_SCENE_WIDTH - 1, 900)).toBe(true)
    expect(shouldUseRoster(MIN_SCENE_WIDTH, 900)).toBe(false) // at the floor → scene
  })

  it('a SHORT strip (too little height to show the room) falls back to the widget', () => {
    expect(shouldUseRoster(1200, 240)).toBe(true)
    expect(shouldUseRoster(1200, MIN_SCENE_HEIGHT - 1)).toBe(true)
    expect(shouldUseRoster(1200, MIN_SCENE_HEIGHT)).toBe(false) // at the floor → scene
  })

  it('defensive: non-finite / zero sizes stay on the scene (never a blank widget)', () => {
    expect(shouldUseRoster(NaN, 500)).toBe(false)
    expect(shouldUseRoster(800, 0)).toBe(false)
    expect(shouldUseRoster(undefined, undefined)).toBe(false)
  })

  it('the widget and the shared sprite are exported and importable', () => {
    expect(typeof NarrowRoster).toBe('function')
    expect(typeof CharacterPixelSprite).toBe('object') // React.memo wraps to an object
  })
})
