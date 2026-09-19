import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// 2026-09-19 review, REV-01 / REV-02 — overlays that must stay on screen (the inspector card, the
// speech bubble) clamp against the LIVE viewBox (store.sceneBounds), not literal 800×560 numbers.
// Panel mode crops the scene to a sub-window whose top is far below y=0, so a literal clamp put the
// inspector's header and close button above the crop. Spec: docs/specs/review-2026-09-19-remediation.md

// The three crops PixelOffice.updateViewBox can produce (margin M=20 already applied) + the full office.
const FULL = { minX: 0, minY: 0, w: 800, h: 560 }
const PANEL_CROPS = {
  tall: { minX: 80, minY: 110, w: 440, h: 440 },   // ratio < 1
  mid: { minX: 40, minY: 120, w: 580, h: 380 },    // ratio < 1.6
  wide: { minX: 40, minY: 135, w: 580, h: 300 },   // ratio >= 1.6
}

// A controllable store for the render test. AgentInspector reads everything through selectors, and
// under react-dom/server a real zustand selector returns the INITIAL snapshot, so a setState'd
// selection would never reach the render. The fake applies each selector to `fakeState`.
let fakeState = null
vi.mock('../src/systems/store', async (importOriginal) => {
  const real = await importOriginal()
  const useOfficeStore = (selector) => selector(fakeState)
  useOfficeStore.getState = () => fakeState
  useOfficeStore.setState = () => {}
  useOfficeStore.subscribe = () => () => {}
  return { ...real, useOfficeStore, __realStore: real.useOfficeStore }
})

const { placeInspector } = await import('../src/components/agentInspectorModel.js')
const { shouldFlipBubbleBelow } = await import('../src/components/BehaviorBubble.jsx')
const storeModule = await import('../src/systems/store')
const { default: AgentInspector } = await import('../src/components/AgentInspector.jsx')

// Verbatim from AgentInspector.jsx before this change (1ed0e8f) — the default-office reference.
function legacyPlacement(anchor, W, H, s) {
  const Ws = W * s, Hs = H * s
  let px = anchor.x - Ws / 2
  let py = anchor.y - Hs - 56 * s
  if (px < 10) px = 10
  if (px + Ws > 790) px = 790 - Ws
  if (py < 10) py = 10
  if (py + Hs > 550) py = 550 - Hs
  return { px, py, s }
}

const W = 200
// Card heights the inspector can take: bare, +details, +task +details +3 activities, +workflow row.
const HEIGHTS = [78, 108, 154, 170, 184]
const SCALES = [1, 1.6, 2.4, 3]
const ANCHORS = []
for (let x = -100; x <= 900; x += 50) for (let y = -100; y <= 700; y += 50) ANCHORS.push({ x, y })

describe('placeInspector — the card never leaves the visible viewBox (REV-01)', () => {
  for (const [name, bounds] of Object.entries({ full: FULL, ...PANEL_CROPS })) {
    it(`${name} ${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}: every anchor, height and scale stays inside (pad 10)`, () => {
      let checked = 0
      for (const anchor of ANCHORS) for (const H of HEIGHTS) for (const scale of SCALES) {
        const { px, py, s } = placeInspector({ anchor, W, H, scale, bounds })
        const where = `anchor ${anchor.x},${anchor.y} H=${H} scale=${scale}`
        expect(s, where).toBeGreaterThan(0)
        expect(s, where).toBeLessThanOrEqual(scale)
        expect(px, where).toBeGreaterThanOrEqual(bounds.minX + 10 - 1e-9)
        expect(py, where).toBeGreaterThanOrEqual(bounds.minY + 10 - 1e-9)
        expect(px + W * s, where).toBeLessThanOrEqual(bounds.minX + bounds.w - 10 + 1e-9)
        expect(py + H * s, where).toBeLessThanOrEqual(bounds.minY + bounds.h - 10 + 1e-9)
        checked++
      }
      expect(checked).toBe(ANCHORS.length * HEIGHTS.length * SCALES.length)
    })
  }

  it('the pre-change code DID put the card above the wide panel crop (the defect, reproduced)', () => {
    // A desk agent (pm home y=264) at the panel's un-measured sceneScale 1 → s = 1.6.
    const { py } = legacyPlacement({ x: 140, y: 264 }, W, 154, 1.6)
    expect(py).toBeLessThan(PANEL_CROPS.wide.minY) // header + close button off-screen
  })

  it('full office: identical to the pre-change placement whenever the card fits (AC-3)', () => {
    let compared = 0
    for (const anchor of ANCHORS) for (const H of HEIGHTS) for (const scale of SCALES) {
      if (W * scale > 780 || H * scale > 540) continue // did not fit before either
      expect(placeInspector({ anchor, W, H, scale, bounds: FULL })).toEqual(legacyPlacement(anchor, W, H, scale))
      compared++
    }
    expect(compared).toBeGreaterThan(1000)
  })

  it('shrinks the counter-scale ONLY when the card would not fit (visibility beats text size)', () => {
    // Fits: scale passes through untouched.
    expect(placeInspector({ anchor: { x: 400, y: 300 }, W, H: 154, scale: 1.6, bounds: PANEL_CROPS.wide }).s).toBe(1.6)
    // 184 × 1.6 = 294.4 > 300 − 20 → shrinks to exactly the available height.
    expect(placeInspector({ anchor: { x: 400, y: 300 }, W, H: 184, scale: 1.6, bounds: PANEL_CROPS.wide }).s).toBeCloseTo(280 / 184, 10)
    // Full office at the ×3 ceiling with the tallest card: 552 > 540 used to clip ~2 units.
    expect(placeInspector({ anchor: { x: 400, y: 300 }, W, H: 184, scale: 3, bounds: FULL }).s).toBeCloseTo(540 / 184, 10)
  })
})

// Verbatim flip rule from AgentCharacter.jsx before this change (1ed0e8f).
const legacyFlip = (posY, labelScale) => posY - 68 - 34 * labelScale < 6

describe('shouldFlipBubbleBelow — the bubble flips against the VISIBLE top (REV-02)', () => {
  const wide = PANEL_CROPS.wide

  it('top-aisle agent in the wide panel crop: flips (the pre-change rule drew the bubble above the crop)', () => {
    // y=180 is a real idle spot (movementSystem top aisle); the old bubble box spans y 78..104.
    expect(legacyFlip(180, 1)).toBe(false)
    expect(shouldFlipBubbleBelow({ posY: 180, labelScale: 1, sceneMinY: wide.minY })).toBe(true)
    // North doorway, main-office side.
    expect(shouldFlipBubbleBelow({ posY: 176, labelScale: 1, sceneMinY: wide.minY })).toBe(true)
  })

  it('desk agents keep their bubble above the head in every panel crop (desks were never clipped)', () => {
    for (const bounds of Object.values(PANEL_CROPS)) {
      for (const y of [244, 264, 274, 304, 364, 384]) {
        expect(shouldFlipBubbleBelow({ posY: y, labelScale: 1, sceneMinY: bounds.minY }), `y=${y} minY=${bounds.minY}`).toBe(false)
      }
    }
  })

  it('orphan guard: an agent ABOVE the crop does not pull its bubble into view (AC-6)', () => {
    // Hallway / entrance agents (y < 135) are outside the wide crop; flipping would show a bubble
    // under a speaker nobody can see.
    for (const y of [80, 110, 125, 134]) {
      expect(shouldFlipBubbleBelow({ posY: y, labelScale: 1, sceneMinY: wide.minY }), `y=${y}`).toBe(false)
    }
    // The boundary itself counts as visible.
    expect(shouldFlipBubbleBelow({ posY: wide.minY, labelScale: 1, sceneMinY: wide.minY })).toBe(true)
  })

  it('full office (minY 0): identical to the pre-change rule for every anchor and label scale (AC-7)', () => {
    for (const labelScale of [1, 1.2, 1.35, 1.5]) {
      for (let y = 0; y <= 560; y += 1) {
        expect(shouldFlipBubbleBelow({ posY: y, labelScale, sceneMinY: 0 }), `y=${y} ls=${labelScale}`).toBe(legacyFlip(y, labelScale))
      }
    }
  })

  it('defaults: missing scene bounds behave like the full office', () => {
    expect(shouldFlipBubbleBelow({ posY: 80 })).toBe(legacyFlip(80, 1))
    expect(shouldFlipBubbleBelow({ posY: 300 })).toBe(false)
  })
})

function baseState(overrides = {}) {
  const real = storeModule.__realStore.getState()
  return {
    ...real,
    selectedAgent: 'pm',
    agents: { ...real.agents, pm: { ...real.agents.pm, position: { x: 140, y: 264 }, isMoving: false, status: 'working' } },
    externalStatus: {},
    activityLog: [],
    sceneScale: 1,
    ...overrides,
  }
}

function renderedCard(html) {
  const m = html.match(/translate\(([-\d.e]+), ([-\d.e]+)\) scale\(([-\d.e]+)\)/)
  const h = html.match(/<rect x="0" y="0" width="200" height="([\d.]+)"/)
  expect(m, 'inspector card transform').toBeTruthy()
  expect(h, 'inspector card background').toBeTruthy()
  return { px: Number(m[1]), py: Number(m[2]), s: Number(m[3]), H: Number(h[1]) }
}

describe('AgentInspector render — reads the live sceneBounds (REV-01)', () => {
  beforeEach(() => { fakeState = baseState() })

  for (const [name, bounds] of Object.entries(PANEL_CROPS)) {
    it(`panel ${name}: the rendered card sits inside the crop, header included`, () => {
      fakeState = baseState({ sceneBounds: bounds })
      const { px, py, s, H } = renderedCard(renderToStaticMarkup(<AgentInspector />))
      expect(py).toBeGreaterThanOrEqual(bounds.minY + 10)
      expect(py + H * s).toBeLessThanOrEqual(bounds.minY + bounds.h - 10 + 1e-9)
      expect(px).toBeGreaterThanOrEqual(bounds.minX + 10)
      expect(px + 200 * s).toBeLessThanOrEqual(bounds.minX + bounds.w - 10 + 1e-9)
    })
  }

  it('the click-to-close backdrop still covers the whole authored scene in a panel crop (AC-4)', () => {
    // Review suggestion REJECTED: sizing the backdrop to sceneBounds would SHRINK the close target —
    // with preserveAspectRatio="xMidYMid meet" the visible area can be larger than the viewBox.
    fakeState = baseState({ sceneBounds: PANEL_CROPS.wide })
    const html = renderToStaticMarkup(<AgentInspector />)
    expect(html).toContain('<rect x="0" y="0" width="800" height="560" fill="transparent"></rect>')
  })
})
