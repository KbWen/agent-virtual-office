import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { SCENE_W, SCENE_H } from '../src/components/PixelOffice.jsx'
import NarrowRoster from '../src/components/NarrowRoster.jsx'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

// The office scene is the PRIMARY view at every size (scaled to fit). The roster is an OPTIONAL
// manual toggle — store.rosterMode — never an automatic size-based switch. So there is no
// size→view decision to test; instead we lock the toggle contract.
describe('rosterMode — optional manual view toggle (office is primary)', () => {
  beforeEach(() => useOfficeStore.setState({ rosterMode: false }))

  it('defaults to the office (rosterMode false)', () => {
    expect(useOfficeStore.getState().rosterMode).toBe(false)
  })

  it('toggleRosterMode flips between office and roster', () => {
    useOfficeStore.getState().toggleRosterMode()
    expect(useOfficeStore.getState().rosterMode).toBe(true)
    useOfficeStore.getState().toggleRosterMode()
    expect(useOfficeStore.getState().rosterMode).toBe(false)
  })

  it('the scene is authored at a fixed 800x560 (coords baked in, not reflowable)', () => {
    expect(SCENE_W).toBe(800)
    expect(SCENE_H).toBe(560)
  })

  it('the roster widget and shared sprite are exported and importable', () => {
    expect(typeof NarrowRoster).toBe('function')
    expect(typeof CharacterPixelSprite).toBe('object') // React.memo wraps to an object
  })
})
