// AVO-210: the office must stay usable when browser storage throws (SecurityError — blocked
// cookies / third-party iframe). Covers the helper, i18n init + switching, the store defaults and
// the ControlPanel onboarding gate. vitest runs in node, so `window` is stubbed per scenario.
import { afterEach, describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { safeGet, safeSet, safeRemove } from './safeStorage.js'

const denied = () => new DOMException('denied', 'SecurityError')

// Each mode: where the SecurityError comes from.
const MODES = {
  'property getter throws': () => ({
    get localStorage() { throw denied() },
  }),
  'getItem/setItem/removeItem throw': () => ({
    localStorage: {
      getItem() { throw denied() },
      setItem() { throw denied() },
      removeItem() { throw denied() },
    },
  }),
}

function stubWindow(mode, search = '') {
  // defineProperties (not spread) so the throwing getter is installed, not evaluated.
  const win = { location: { search }, addEventListener() {}, removeEventListener() {} }
  vi.stubGlobal('navigator', { language: 'en-US' })
  Object.defineProperties(win, Object.getOwnPropertyDescriptors(MODES[mode]()))
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { documentElement: { lang: '' }, getElementById: () => null })
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({})))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('safeStorage helper', () => {
  it('works normally when storage is healthy', () => {
    const store = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
      },
    })
    expect(safeGet('a', 'dflt')).toBe('dflt')
    expect(safeSet('a', '1')).toBe(true)
    expect(safeGet('a')).toBe('1')
    expect(safeRemove('a')).toBe(true)
    expect(safeGet('a')).toBe(null)
  })

  it('has no window (SSR/node): falls back without throwing', () => {
    expect(safeGet('a', 'x')).toBe('x')
    expect(safeSet('a', '1')).toBe(false)
    expect(safeRemove('a')).toBe(false)
  })

  for (const mode of Object.keys(MODES)) {
    it(`falls back / fails silently when ${mode}`, () => {
      stubWindow(mode)
      expect(safeGet('a', 'dflt')).toBe('dflt')
      expect(safeGet('a')).toBe(null)
      expect(() => safeSet('a', '1')).not.toThrow()
      expect(safeSet('a', '1')).toBe(false)
      expect(() => safeRemove('a')).not.toThrow()
    })
  }
})

describe.each(Object.keys(MODES))('office with throwing storage (%s)', (mode) => {
  it('i18n initialises with a default language and switching does not throw', async () => {
    stubWindow(mode)
    const i18n = await import('../i18n.js')
    expect(i18n.locale()).toBe('en')
    expect(typeof i18n.t('behaviorLabels.typing')).toBe('string')
    expect(() => i18n.setLocale('zh-TW')).not.toThrow()
    expect(i18n.locale()).toBe('zh-TW')
    expect(() => i18n.setLocale('en')).not.toThrow()
  })

  it('i18n honours ?lang= even when storage throws', async () => {
    stubWindow(mode, '?lang=zh-TW')
    const i18n = await import('../i18n.js')
    expect(i18n.locale()).toBe('zh-TW')
  })

  it('store module loads with its preference defaults', async () => {
    stubWindow(mode)
    const { useOfficeStore } = await import('../systems/store.js')
    const s = useOfficeStore.getState()
    expect(s.isPaused).toBe(false)
    expect(s.weatherEffects).toBe(true)
    expect(() => s.togglePause()).not.toThrow()
  })

  it('ControlPanel renders with the onboarding card open and the dismiss path is safe', async () => {
    stubWindow(mode)
    const { default: ControlPanel } = await import('../components/ControlPanel.jsx')
    let html
    expect(() => { html = renderToString(React.createElement(ControlPanel, { mode: 'full' })) }).not.toThrow()
    expect(html.length).toBeGreaterThan(0)
    // Nothing could be read => not onboarded yet. Dismissing writes 'office-onboarded' through
    // safeSet, which must not throw.
    expect(() => safeSet('office-onboarded', '1')).not.toThrow()
  })
})
