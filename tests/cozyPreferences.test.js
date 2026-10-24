import { describe, expect, it, vi } from 'vitest'
import { createCozyPreferences } from '../src/systems/cozyPreferences.js'

describe('optional cozy preference', () => {
  it('defaults off and persists only an explicit choice, without touching other keys', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    const prefs = createCozyPreferences(storage)
    const listener = vi.fn()
    const unsubscribe = prefs.subscribe(listener)
    expect(prefs.getSnapshot()).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
    prefs.setEnabled(true)
    expect(prefs.getSnapshot()).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith('avo.cozyInteractions', '1')
    prefs.setEnabled(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    prefs.setEnabled(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenLastCalledWith('avo.cozyInteractions', '0')
  })
  it('restores only a valid enabled preference', () => {
    for (const value of [null, 'true', '0', '', 'unexpected']) {
      expect(createCozyPreferences({ getItem: () => value }).getSnapshot()).toBe(false)
    }
    expect(createCozyPreferences({ getItem: () => '1' }).getSnapshot()).toBe(true)
  })
  it('keeps working in memory when browser storage is denied', () => {
    const warn = vi.fn()
    const prefs = createCozyPreferences({
      getItem() { throw new Error('denied') },
      setItem() { throw new Error('denied') },
    }, warn)
    expect(prefs.getSnapshot()).toBe(false)
    prefs.setEnabled(true)
    expect(prefs.getSnapshot()).toBe(true)
    prefs.setEnabled(false)
    expect(prefs.getSnapshot()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
