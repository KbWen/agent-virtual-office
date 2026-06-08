import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { derivePetState, petIsMobile, resolvePetMode, petReadabilityScale, petMotionGrammar, nextPetType, PET_TYPES, PET_MODES } from '../src/systems/petState.js'
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

describe('resolvePetMode (#39 v2 — transient overlays never break honesty)', () => {
  it('returns the base mode when no transient is active', () => {
    expect(resolvePetMode({ base: PET_MODES.WANDER })).toBe(PET_MODES.WANDER)
    expect(resolvePetMode({ base: PET_MODES.NAP })).toBe(PET_MODES.NAP)
    expect(resolvePetMode({ base: PET_MODES.HIDE })).toBe(PET_MODES.HIDE)
  })

  it('alert overlays any base (it only fires on a new-blocker edge → base is already hide)', () => {
    expect(resolvePetMode({ base: PET_MODES.HIDE, alert: true })).toBe(PET_MODES.ALERT)
    // alert wins over a simultaneous celebrate
    expect(resolvePetMode({ base: PET_MODES.HIDE, alert: true, celebrate: true })).toBe(PET_MODES.ALERT)
  })

  it('celebrate shows only when NOT hiding — never makes the pet happy during a real blocker', () => {
    expect(resolvePetMode({ base: PET_MODES.WANDER, celebrate: true })).toBe(PET_MODES.CELEBRATE)
    expect(resolvePetMode({ base: PET_MODES.HIDE, celebrate: true })).toBe(PET_MODES.HIDE)
    expect(resolvePetMode({ base: PET_MODES.NAP, celebrate: true })).toBe(PET_MODES.CELEBRATE)
  })
})

describe('petReadabilityScale (#39 v2 — legible when docked small, never fakes size)', () => {
  it('is 1 at or above native (sceneScale >= 1) — unchanged', () => {
    expect(petReadabilityScale(1)).toBe(1)
    expect(petReadabilityScale(1.5)).toBe(1)
  })
  it('partial-counter-scales as the office shrinks, capped at 1.6', () => {
    expect(petReadabilityScale(0.64)).toBeCloseTo(1.25, 5)   // 1/sqrt(0.64)=1.25
    expect(petReadabilityScale(0.25)).toBe(1.6)              // 1/sqrt(0.25)=2 → capped 1.6
    expect(petReadabilityScale(0.4)).toBeGreaterThan(1)
    expect(petReadabilityScale(0.4)).toBeLessThanOrEqual(1.6)
  })
  it('guards invalid sceneScale → 1', () => {
    expect(petReadabilityScale(0)).toBe(1)
    expect(petReadabilityScale(-1)).toBe(1)
    expect(petReadabilityScale(NaN)).toBe(1)
  })
})

describe('pet types (#39 — cosmetic skins, behavior-identical)', () => {
  it('PET_TYPES is a capped set of 3', () => {
    expect(PET_TYPES).toEqual(['cat', 'vacuum', 'dog'])
  })
  it('nextPetType cycles cat → vacuum → dog → cat (unknown → cat)', () => {
    expect(nextPetType('cat')).toBe('vacuum')
    expect(nextPetType('vacuum')).toBe('dog')
    expect(nextPetType('dog')).toBe('cat')
    expect(nextPetType('bogus')).toBe('cat')
  })
  it('petMotionGrammar gives each type a distinct feel; unknown → cat grammar', () => {
    expect(petMotionGrammar('vacuum').bob).toBe(false)       // a Roomba does not bob
    expect(petMotionGrammar('vacuum').easing).toBe('linear') // machines move linearly
    expect(petMotionGrammar('dog').bobAmp).toBeGreaterThan(petMotionGrammar('cat').bobAmp)
    expect(petMotionGrammar('bogus')).toEqual(petMotionGrammar('cat'))
  })
  it('type changes FEEL only — mode logic is type-independent (honesty unaffected)', () => {
    // derivePetState/resolvePetMode take no `type` argument, so a real blocker → hide for ALL skins
    expect(derivePetState({ mood: 'smooth', blockedCount: 1 })).toBe(PET_MODES.HIDE)
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

  it('cyclePetType cycles + persists the skin (#39 types)', () => {
    localStorage.removeItem('office-pet-type')
    useOfficeStore.setState({ petType: 'cat' })
    useOfficeStore.getState().cyclePetType()
    expect(useOfficeStore.getState().petType).toBe('vacuum')
    expect(localStorage.getItem('office-pet-type')).toBe('vacuum')
    useOfficeStore.getState().cyclePetType()
    expect(useOfficeStore.getState().petType).toBe('dog')
    useOfficeStore.getState().cyclePetType()
    expect(useOfficeStore.getState().petType).toBe('cat')
    expect(localStorage.getItem('office-pet-type')).toBe('cat')
  })
})
