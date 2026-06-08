import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// #45 — user toggle to disable heavy weather animations (rain/cloud/lightning) that spike CPU on
// low-end devices. Default ON; persisted via the dedicated 'office-weather' localStorage key (same
// lightweight pattern as isPaused/rosterMode). PixelOffice ORs !weatherEffects into the WallWindow
// reducedMotion prop, so OFF renders weather as static decoration.
//
// These tests run in the node env (the repo ships no jsdom/happy-dom — .jsx tests render via
// react-dom/server). The store's persistence path is guarded by `typeof window !== 'undefined'`,
// so we install a minimal window + localStorage shim to exercise it the way the browser would.
const hadWindow = 'window' in globalThis
const mem = {}
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v) },
  removeItem: (k) => { delete mem[k] },
}
globalThis.window = globalThis.window || {}

afterAll(() => {
  delete globalThis.localStorage
  if (!hadWindow) delete globalThis.window
})

describe('store — weatherEffects toggle (#45)', () => {
  beforeEach(() => {
    localStorage.removeItem('office-weather')
    useOfficeStore.setState({ weatherEffects: true })
  })

  it('defaults to ON', () => {
    expect(useOfficeStore.getState().weatherEffects).toBe(true)
  })

  it('toggleWeatherEffects flips the flag', () => {
    useOfficeStore.getState().toggleWeatherEffects()
    expect(useOfficeStore.getState().weatherEffects).toBe(false)
    useOfficeStore.getState().toggleWeatherEffects()
    expect(useOfficeStore.getState().weatherEffects).toBe(true)
  })

  it('persists the choice to localStorage (off → "off", on → "on")', () => {
    useOfficeStore.getState().toggleWeatherEffects() // → off
    expect(localStorage.getItem('office-weather')).toBe('off')
    useOfficeStore.getState().toggleWeatherEffects() // → on
    expect(localStorage.getItem('office-weather')).toBe('on')
  })
})
