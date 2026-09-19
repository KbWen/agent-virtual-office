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
// PixelOffice's useState initial value, live until the first container measure replaces it.
const INITIAL_CROP = { minX: 60, minY: 155, w: 540, h: 260 }
const ALL_CROPS = { ...PANEL_CROPS, initial: INITIAL_CROP }

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
const { shouldFlipBubbleBelow, computeEdgeShift } = await import('../src/components/BehaviorBubble.jsx')
const { MEETING_CHAIRS } = await import('../src/systems/movementSystem.js')
const storeModule = await import('../src/systems/store')
const { default: AgentInspector } = await import('../src/components/AgentInspector.jsx')
const { default: AgentCharacter } = await import('../src/components/AgentCharacter.jsx')

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
  for (const [name, bounds] of Object.entries({ full: FULL, ...ALL_CROPS })) {
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

  it('degenerate bounds never mirror the card, and missing bounds fall back to the full office (review L3)', () => {
    // Narrower than 2×pad: no card can fit, but the scale must stay positive (a negative scale flips
    // the card inside out). Unreachable from PixelOffice's crops — this pins the floor, not a layout.
    const tiny = placeInspector({ anchor: { x: 400, y: 300 }, W, H: 154, scale: 1.6, bounds: { minX: 0, minY: 0, w: 15, h: 15 } })
    expect(tiny.s).toBeGreaterThan(0)
    expect(Number.isFinite(tiny.px) && Number.isFinite(tiny.py)).toBe(true)
    const noBounds = placeInspector({ anchor: { x: 140, y: 264 }, W, H: 154, scale: 1.6 })
    expect(noBounds).toEqual(placeInspector({ anchor: { x: 140, y: 264 }, W, H: 154, scale: 1.6, bounds: FULL }))
  })
})

// Verbatim flip rule from AgentCharacter.jsx before this change (1ed0e8f).
const legacyFlip = (posY, labelScale) => posY - 68 - 34 * labelScale < 6
// The shipped rule for a given crop (`b` = sceneBounds).
const flip = (posX, posY, b, labelScale = 1) =>
  shouldFlipBubbleBelow({ posX, posY, labelScale, sceneMinX: b.minX, sceneMinY: b.minY, sceneW: b.w })

describe('shouldFlipBubbleBelow — the bubble flips against the VISIBLE top (REV-02)', () => {
  const wide = PANEL_CROPS.wide

  it('top-aisle agent in the wide panel crop: flips (the pre-change rule drew the bubble above the crop)', () => {
    // y=180 is a real idle spot (movementSystem top aisle); the old bubble box spans y 78..104.
    expect(legacyFlip(180, 1)).toBe(false)
    expect(flip(300, 180, wide)).toBe(true)
    // North doorway, main-office side.
    expect(flip(115, 176, wide)).toBe(true)
  })

  it('desk agents keep their bubble above the head in every measured panel crop (desks were never clipped)', () => {
    for (const bounds of Object.values(PANEL_CROPS)) {
      for (const [x, y] of [[140, 264], [260, 264], [340, 364], [460, 364], [400, 244], [520, 244], [140, 384]]) {
        if (x < bounds.minX || x > bounds.minX + bounds.w) continue
        expect(flip(x, y, bounds), `(${x},${y}) crop ${bounds.minX} ${bounds.minY}`).toBe(false)
      }
    }
  })

  it('orphan guard: an agent ABOVE the crop does not pull its bubble into view (AC-6)', () => {
    // Hallway / entrance agents (y < 135) are outside the wide crop; flipping would show a bubble
    // under a speaker nobody can see.
    for (const y of [80, 110, 125, 134]) {
      expect(flip(300, y, wide), `y=${y}`).toBe(false)
    }
    // The boundary itself counts as visible.
    expect(flip(300, wide.minY, wide)).toBe(true)
  })

  it('full office (minY 0): identical to the pre-change rule for every anchor and label scale (AC-7)', () => {
    for (const labelScale of [1, 1.2, 1.35, 1.5]) {
      for (let y = 0; y <= 560; y += 1) {
        for (const x of [0, 100, 400, 700, 800]) {
          expect(flip(x, y, FULL, labelScale), `(${x},${y}) ls=${labelScale}`).toBe(legacyFlip(y, labelScale))
        }
      }
    }
  })

  it('defaults: missing scene bounds behave like the full office', () => {
    expect(shouldFlipBubbleBelow({ posX: 100, posY: 80 })).toBe(legacyFlip(80, 1))
    expect(shouldFlipBubbleBelow({ posX: 100, posY: 300 })).toBe(false)
  })
})

// Review round 1, H1: the first cut guarded only y. Meeting-room chairs (x 645–765) lie RIGHT of every
// panel crop; the group-meeting set-piece gives them bubbles; the flip moved those bubbles into the
// crop's y-range and the horizontal edge clamp dragged them sideways into view — speech with no
// visible speaker. Neither move may happen for a speaker whose anchor is outside the crop.
// Verbatim edge clamp before the fix (1ed0e8f), to reproduce the defect.
function legacyEdgeShift({ boxW, absX, scale = 1, sceneMinX = 0, sceneW = 800, edgePad = 4 }) {
  if (absX == null || !Number.isFinite(absX) || !Number.isFinite(scale) || scale <= 0) return 0
  const half = boxW / 2
  const leftBound = (sceneMinX + edgePad - absX) / scale + half
  const rightBound = (sceneMinX + sceneW - edgePad - absX) / scale - half
  return Math.min(Math.max(0, leftBound), rightBound)
}
// Scene-space box of a bubble (BehaviorBubble geometry: 26 tall, 8 gap, anchored at -68 or +6).
function bubbleBox({ x, y, boxW, flipped, shift }) {
  const top = flipped ? y + 6 + 8 : y - 68 - 26 - 8
  return { left: x - boxW / 2 + shift, right: x + boxW / 2 + shift, top, bottom: top + 26 }
}
const intersects = (box, b) => box.right > b.minX && box.left < b.minX + b.w && box.bottom > b.minY && box.top < b.minY + b.h

describe('orphan guard on BOTH axes — off-crop speakers keep speech off-screen (review H1)', () => {
  const BOX_W = 150

  for (const [name, b] of Object.entries(ALL_CROPS)) {
    it(`${name} crop: no meeting-chair bubble is flipped or dragged in`, () => {
      for (const chair of MEETING_CHAIRS) {
        expect(chair.x > b.minX + b.w, `chair ${chair.x} is right of the ${name} crop`).toBe(true) // the geometry at issue
        expect(flip(chair.x, chair.y, b), `flip (${chair.x},${chair.y})`).toBe(false)
        expect(computeEdgeShift({ boxW: BOX_W, absX: chair.x, sceneMinX: b.minX, sceneW: b.w }), `shift ${chair.x}`).toBe(0)
      }
    })
  }

  it('the first cut DID put a chair bubble fully inside the tall crop (the defect, reproduced)', () => {
    const b = PANEL_CROPS.tall, chair = { x: 700, y: 120 }
    const yOnlyFlip = chair.y - 68 - 34 < b.minY + 6 && chair.y >= b.minY
    const shift = legacyEdgeShift({ boxW: BOX_W, absX: chair.x, sceneMinX: b.minX, sceneW: b.w })
    expect(yOnlyFlip).toBe(true)
    expect(intersects(bubbleBox({ ...chair, boxW: BOX_W, flipped: yOnlyFlip, shift }), b)).toBe(true)
    // Shipped rule: no flip, no drag — the bubble stays over its (off-screen) speaker.
    const shipped = bubbleBox({ ...chair, boxW: BOX_W, flipped: flip(chair.x, chair.y, b), shift: computeEdgeShift({ boxW: BOX_W, absX: chair.x, sceneMinX: b.minX, sceneW: b.w }) })
    expect(intersects(shipped, b)).toBe(false)
  })

  it('a speaker INSIDE the crop near its edge is still clamped fully on screen (#47 unchanged)', () => {
    const b = PANEL_CROPS.wide // x 40..620
    const shift = computeEdgeShift({ boxW: BOX_W, absX: 600, sceneMinX: b.minX, sceneW: b.w })
    expect(shift).toBeLessThan(0)
    expect(600 + BOX_W / 2 + shift).toBeLessThanOrEqual(b.minX + b.w - 4 + 1e-9)
    // …and identical to the pre-fix clamp for every in-crop anchor.
    for (let x = b.minX; x <= b.minX + b.w; x += 5) {
      expect(computeEdgeShift({ boxW: BOX_W, absX: x, sceneMinX: b.minX, sceneW: b.w }))
        .toBe(legacyEdgeShift({ boxW: BOX_W, absX: x, sceneMinX: b.minX, sceneW: b.w }))
    }
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

// Review round 1, M1: prove the WIRING, not just the helper — AgentCharacter must pass its live
// sceneBounds into the flip. A mutation to `sceneMinY: 0` at the call site kept every suite green.
describe('AgentCharacter render — the bubble flip reads the live sceneBounds (REV-02 wiring)', () => {
  const speaker = (x, y, bounds) => {
    const base = baseState()
    return {
      ...base,
      selectedAgent: null,
      sceneBounds: bounds,
      sceneScale: 1,
      agents: { ...base.agents, qa: { ...base.agents.qa, position: { x, y }, targetPosition: { x, y }, isMoving: false, status: 'working', bubble: 'Checking the test run' } },
    }
  }
  // The bubble's wrapper: translate(0, 6) when flipped below, translate(0, -68) above.
  const bubbleOffset = (html) => {
    const m = html.match(/<g transform="translate\(0, (-?\d+)\) scale\(1\)"[^>]*><g class="speech-bubble"/)
    expect(m, 'bubble wrapper rendered').toBeTruthy()
    return Number(m[1])
  }
  const render = () => renderToStaticMarkup(<svg><AgentCharacter agent={{ id: 'qa', color: '#BA7517' }} /></svg>)

  it('top-aisle speaker in the wide panel crop renders its bubble below', () => {
    fakeState = speaker(300, 180, PANEL_CROPS.wide)
    expect(bubbleOffset(render())).toBe(6)
  })

  it('the same speaker in the full office keeps the bubble above (unchanged)', () => {
    fakeState = speaker(300, 180, FULL)
    expect(bubbleOffset(render())).toBe(-68)
  })

  it('a meeting-chair speaker right of the crop does not get its bubble flipped in', () => {
    fakeState = speaker(700, 120, PANEL_CROPS.tall)
    expect(bubbleOffset(render())).toBe(-68)
  })
})
