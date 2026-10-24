import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ effects: [], pause: vi.fn(), listeners: {} }))
vi.mock('react', async original => ({ ...await original(), useEffect: fn => env.effects.push(fn) }))
vi.mock('../src/components/PixelOffice', () => ({ default: () => null }))
vi.mock('../src/components/ControlPanel', () => ({ default: () => null }))
vi.mock('../src/components/ActivityFeed', () => ({ default: () => null }))
vi.mock('../src/systems/platformDetect', () => ({ detectPlatform: () => 'browser', getPlatformConfig: () => ({}) }))
vi.mock('../src/systems/store', () => ({ useOfficeStore: { getState: () => ({ togglePause: env.pause }) } }))
import App from '../src/App.jsx'

afterEach(() => vi.unstubAllGlobals())
it('global pause ignores consumed and native interactive keys but retains background Space', () => {
  vi.stubGlobal('window', {
    location: { search: '' },
    addEventListener: (name, handler) => { env.listeners[name] = handler },
    removeEventListener: vi.fn(),
  })
  renderToStaticMarkup(<App />)
  const cleanups = env.effects.map(fn => fn())
  const event = { key: ' ', target: { tagName: 'BUTTON' }, preventDefault: vi.fn() }
  env.listeners.keydown({ ...event, defaultPrevented: true })
  expect(env.pause).not.toHaveBeenCalled()
  env.listeners.keydown({ ...event, defaultPrevented: false })
  expect(env.pause).not.toHaveBeenCalled()
  expect(event.preventDefault).not.toHaveBeenCalled()
  env.listeners.keydown({ ...event, target: { tagName: 'BODY' }, defaultPrevented: false })
  expect(env.pause).toHaveBeenCalledOnce()
  cleanups.forEach(fn => fn?.())
})
