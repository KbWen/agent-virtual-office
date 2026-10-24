// spec_ref: docs/specs/cozy-interactions.md C1/C5/C6/C7 (scene amendment).
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const env = vi.hoisted(() => ({ calls: 0, settings: false }))
vi.mock('react', async original => {
  const real = await original()
  return { ...real, useState: initial => {
    const pair = real.useState(initial)
    return env.settings && env.calls++ === 1 ? [true, pair[1]] : pair
  } }
})
import ScenePostcard from '../src/components/ScenePostcard.jsx'
import { captureSceneCardInput } from '../src/systems/sceneCozy.js'
import ControlPanel from '../src/components/ControlPanel.jsx'
import PixelOffice from '../src/components/PixelOffice.jsx'

beforeEach(() => { env.calls = 0; env.settings = false })
describe('postcard belongs in the scene', () => {
  it('keeps the card on the existing notice board with keyboard/pointer affordance', () => {
    const html = renderToStaticMarkup(<svg><ScenePostcard onOpen={() => {}} sceneScale={0.48} /></svg>)
    expect(html).toContain('data-scene-cozy="postcard"')
    expect(html).toContain('translate(256, 73)')
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('data-scene-cozy-hint')
    expect(html).not.toContain('<dialog')
  })
  it('captures actual totals, date, mood and locale once without changing the source', () => {
    const state = { mood: 'smooth', dailyDoneLedger: { counts: { dev: 3, qa: 2 } }, dailyBlockedLedger: { counts: { dev: 1 } } }
    const before = structuredClone(state)
    const input = captureSceneCardInput(state, 'zh-TW', '2026-10-23')
    expect(input).toEqual({ dayKey: '2026-10-23', doneTotal: 5, blockedTotal: 1, mood: 'smooth', weather: 'clear', locale: 'zh-TW' })
    state.dailyDoneLedger.counts.dev = 99
    expect(input.doneTotal).toBe(5)
    state.dailyDoneLedger.counts.dev = 3
    expect(state).toEqual(before)
  })
  it('removes both hidden action entries from the real Settings render', () => {
    env.settings = true
    const html = renderToStaticMarkup(<ControlPanel />)
    expect(html).toContain('Small interactions')
    expect(html).not.toContain('A small toy')
    expect(html).not.toContain('office postcard')
  })
  it('renders both scene props in the actual full scene with the default preference off', () => {
    const html = renderToStaticMarkup(<PixelOffice />)
    expect(html).toContain('data-scene-cozy="star"')
    expect(html).toContain('data-scene-cozy="postcard"')
    expect(html).not.toContain('data-cozy-toy')
  })
  it('keeps the compact panel free of the full-scene props', () => {
    const html = renderToStaticMarkup(<PixelOffice mode="panel" />)
    expect(html).not.toContain('data-scene-cozy="star"')
    expect(html).not.toContain('data-scene-cozy="postcard"')
  })
})
