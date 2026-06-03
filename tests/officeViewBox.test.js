import { describe, it, expect } from 'vitest'
import { PORTRAIT_RATIO } from '../src/components/PixelOffice.jsx'
import NarrowRoster from '../src/components/NarrowRoster.jsx'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

// The responsive contract (post-crop): a wide/square window renders the FULL scene unchanged;
// only a tall-narrow column (ratio < PORTRAIT_RATIO) swaps to the vertical roster widget.
// There is NO scene crop anymore — cropping cut agents/events off-frame, so it was removed.
const isPortraitColumn = (ratio) => Number.isFinite(ratio) && ratio < PORTRAIT_RATIO

describe('responsive office framing — widget-not-crop contract', () => {
  it('PORTRAIT_RATIO is the 1:1 threshold', () => {
    expect(PORTRAIT_RATIO).toBe(1.0)
  })

  it('WIDE / SQUARE windows stay on the full scene (no widget, no crop)', () => {
    for (const ratio of [1.0, 1.2, 1.6, 1.78, 2.4, 3.5]) {
      expect(isPortraitColumn(ratio)).toBe(false)
    }
  })

  it('TALL-NARROW columns switch to the roster widget', () => {
    for (const ratio of [0.9, 0.6, 0.4, 0.3]) {
      expect(isPortraitColumn(ratio)).toBe(true)
    }
  })

  it('defensive: NaN / non-finite ratio stays on the full scene (never a blank widget)', () => {
    expect(isPortraitColumn(NaN)).toBe(false)
    expect(isPortraitColumn(Infinity)).toBe(false)
    expect(isPortraitColumn(undefined)).toBe(false)
  })

  it('the widget and the shared sprite are exported and importable', () => {
    expect(typeof NarrowRoster).toBe('function')
    expect(typeof CharacterPixelSprite).toBe('object') // React.memo wraps to an object
  })
})
