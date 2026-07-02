import React from 'react'
import { describe, expect, it, vi } from 'vitest'

async function renderControlPanelWithMockStore(overrides = {}) {
  vi.resetModules()

  const statusColors = {
    idle: '#888',
    working: '#EF9F27',
    done: '#5CB88A',
    blocked: '#E24B4A',
    planning: '#8B7FD6',
    'awaiting-approval': '#1E9FD4',
  }

  const mockState = {
    agents: {
      dev: {
        id: 'dev',
        status: 'idle',
        behavior: 'reading-screen',
        color: '#1D9E75',
      },
    },
    isPaused: false,
    togglePause: () => {},
    rosterMode: false,
    toggleRosterMode: () => {},
    weatherEffects: false,
    toggleWeatherEffects: () => {},
    lightingEnabled: false,
    toggleLighting: () => {},
    soundscapeEnabled: false,
    toggleSoundscape: () => {},
    officePet: false,
    toggleOfficePet: () => {},
    petType: 'cat',
    setPetType: () => {},
    theme: 'classic',
    setTheme: () => {},
    mood: 'normal',
    watchdogRestarts: 0,
    triggerWorkflow: () => {},
    activeEvent: null,
    hour: 9,
    minute: 5,
    externalStatus: {
      dev: { status: 'done', task: 'Edit' },
    },
    statusSource: 'external',
    tokens: {},
    integrationHealth: { state: 'online' },
    reducedMotion: true,
    dailyDoneLedger: { counts: {} },
    dailyBlockedLedger: { counts: {} },
    ...overrides,
  }

  const storeHook = (selector) => selector(mockState)
  storeHook.setState = () => {}
  storeHook.getState = () => mockState

  vi.doMock('../src/systems/store', () => ({
    STATUS_COLORS: statusColors,
    useOfficeStore: storeHook,
  }))
  vi.doMock('../src/systems/store.js', () => ({
    STATUS_COLORS: statusColors,
    useOfficeStore: storeHook,
  }))
  vi.doMock('../src/i18n', () => ({
    behaviorLabel: (behavior) => behavior,
    charName: (id) => ({ dev: 'Developer' }[id] || id),
    t: (_key, fallback) => fallback,
    setLocale: () => {},
    availableLocales: () => ['en', 'zh-TW'],
    useLocale: () => 'en',
    eventName: (id) => id,
  }))
  vi.doMock('../src/i18n.js', () => ({
    behaviorLabel: (behavior) => behavior,
    charName: (id) => ({ dev: 'Developer' }[id] || id),
    t: (_key, fallback) => fallback,
    setLocale: () => {},
    availableLocales: () => ['en', 'zh-TW'],
    useLocale: () => 'en',
    eventName: (id) => id,
  }))

  const { renderToStaticMarkup } = await import('react-dom/server')
  const { default: ControlPanel } = await import('../src/components/ControlPanel.jsx')
  return { html: renderToStaticMarkup(<ControlPanel mode="full" />), statusColors }
}

describe('ControlPanel — presence rail render contract', () => {
  it('renders the normalized external status for the rail dot and screen-reader text', async () => {
    const { html, statusColors } = await renderControlPanelWithMockStore()

    expect(html).toContain(`background-color:${statusColors.done}`)
    expect(html).toContain('<span class="sr-only">done</span>')
    expect(html).not.toContain('<span class="sr-only">idle</span>')
  })
})
