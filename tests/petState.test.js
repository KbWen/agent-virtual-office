import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { derivePetState, petIsMobile, PET_MODES } from '../src/systems/petState.js'
// Static import (hoisted above the window shim below) so the store + i18n initialize while `window`
// is still undefined — matching the repo's node test env. The shim then provides localStorage so the
// toggle's persistence path runs. (Same approach as weatherEffectsToggle.test.js.)
import { useOfficeStore } from '../src/systems/store.js'

const hadWindow = 'window' in globalThis
const mem = {}
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v) },
  removeItem: (k) => { delete mem[k] },
}
globalThis.window = globalThis.window || { location: { search: '' } }
afterAll(() => { delete globalThis.localStorage; if (!hadWindow) delete globalThis.window })

describe('derivePetState (#39 — honest barometer)', () => {
  it('maps the mood enum to pet modes', () => {
    expect(derivePetState({ mood: 'idle' })).toBe(PET_MODES.NAP)
    expect(derivePetState({ mood: 'smooth' })).toBe(PET_MODES.EXCITED)
    expect(derivePetState({ mood: 'rushing' })).toBe(PET_MODES.EXCITED)
    expect(derivePetState({ mood: 'intense' })).toBe(PET_MODES.EXCITED)
    expect(derivePetState({ mood: 'stuck' })).toBe(PET_MODES.HIDE)
    expect(derivePetState({ mood: 'frustrated' })).toBe(PET_MODES.HIDE)
    expect(derivePetState({ mood: 'normal' })).toBe(PET_MODES.WANDER)
  })

  it('AC-1/AC-2 honesty guarantee: a real blocker forces HIDE regardless of mood', () => {
    expect(derivePetState({ mood: 'smooth', blockedCount: 1 })).toBe(PET_MODES.HIDE)
    expect(derivePetState({ mood: 'idle', blockedCount: 3 })).toBe(PET_MODES.HIDE)
    expect(derivePetState({ mood: 'normal', blockedCount: 1 })).toBe(PET_MODES.HIDE)
    // the pet NEVER shows excited/nap while any agent is blocked
    expect(derivePetState({ mood: 'rushing', blockedCount: 2 })).not.toBe(PET_MODES.EXCITED)
  })

  it('unknown / missing mood falls back to WANDER (never a happy state)', () => {
    expect(derivePetState({ mood: 'bogus' })).toBe(PET_MODES.WANDER)
    expect(derivePetState({})).toBe(PET_MODES.WANDER)
    expect(derivePetState()).toBe(PET_MODES.WANDER)
  })

  it('petIsMobile: only wander/excited roam; nap/hide hold position', () => {
    expect(petIsMobile(PET_MODES.WANDER)).toBe(true)
    expect(petIsMobile(PET_MODES.EXCITED)).toBe(true)
    expect(petIsMobile(PET_MODES.NAP)).toBe(false)
    expect(petIsMobile(PET_MODES.HIDE)).toBe(false)
  })
})

describe('store — officePet toggle (#39)', () => {
  beforeEach(() => {
    localStorage.removeItem('office-pet')
    useOfficeStore.setState({ officePet: true })
  })

  it('defaults to ON', () => {
    expect(useOfficeStore.getState().officePet).toBe(true)
  })

  it('toggleOfficePet flips and persists (off → "off", on → "on")', () => {
    useOfficeStore.getState().toggleOfficePet()
    expect(useOfficeStore.getState().officePet).toBe(false)
    expect(localStorage.getItem('office-pet')).toBe('off')
    useOfficeStore.getState().toggleOfficePet()
    expect(useOfficeStore.getState().officePet).toBe(true)
    expect(localStorage.getItem('office-pet')).toBe('on')
  })
})
