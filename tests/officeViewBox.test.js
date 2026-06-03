import { describe, it, expect } from 'vitest'
import { shouldUseRoster, SCENE_W, SCENE_H } from '../src/components/PixelOffice.jsx'
import NarrowRoster from '../src/components/NarrowRoster.jsx'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

// FIT-OR-ROSTER contract (expert-panel consensus): the fixed 800×560 room is shown ONLY when it
// fits whole at full scale — container >= SCENE_W AND >= SCENE_H. Anything smaller shows the roster
// (the room can't be shrunk/cropped/scrolled, all rejected). One binary, consistent rule.
describe('shouldUseRoster — fit-or-roster gate', () => {
  it('shows the scene only when the room fits whole at 100% (container >= 800x560)', () => {
    expect(shouldUseRoster(SCENE_W, SCENE_H)).toBe(false)       // exactly fits → scene
    expect(shouldUseRoster(1280, 800)).toBe(false)
    expect(shouldUseRoster(1000, 700)).toBe(false)
    expect(shouldUseRoster(SCENE_W + 1, SCENE_H + 1)).toBe(false)
  })

  it('shows the roster the moment the room cannot fit at full scale (no shrink/crop/scroll)', () => {
    expect(shouldUseRoster(SCENE_W - 1, 900)).toBe(true)        // 1px too narrow → roster
    expect(shouldUseRoster(1280, SCENE_H - 1)).toBe(true)       // 1px too short → roster
    expect(shouldUseRoster(840, 500)).toBe(true)                // the "tiny scene" case → roster
    expect(shouldUseRoster(380, 950)).toBe(true)                // thin column → roster
    expect(shouldUseRoster(700, 600)).toBe(true)                // moderate-but-narrow → roster
  })

  it('is a width-OR-height gate, not an aspect ratio', () => {
    expect(shouldUseRoster(1600, 500)).toBe(true)   // wide but short → roster
    expect(shouldUseRoster(600, 1200)).toBe(true)   // tall but narrow → roster
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
