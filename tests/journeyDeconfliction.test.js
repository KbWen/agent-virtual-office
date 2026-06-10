/**
 * AVO-156 standing-overlap deconfliction (owner 2026-06-10, 3rd overlap report — forensic
 * capture: 12 stationary-stack events in 12 min, 10 of them at the LITERAL door anchor
 * (240,386), one tracked agent frozen there across 8 minutes).
 *
 * Pins the five fixes' testable seams:
 *  - F2 door-anchor jitter: cross-zone paths no longer funnel through one exact pixel
 *  - F3 journey publication: a walker's landing spot is visible to other pickers
 *  - F4 elliptical spacing: vertical 35px "separations" (full visual stacks) are forbidden
 *  (F1 isWalking lifecycle + F5 arrival nudge live in the component rAF loop — verified by
 *   the live 12-min A/B recorder, scripts/overlap-recorder.mjs, in the PR evidence.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  calculatePath, getTargetForBehavior, visuallyOverlapping, avoidOverlap,
  isOnFloor, isOnObstacle, DOOR_SIDES, SPRITE_CLEAR_RX, SPRITE_CLEAR_RY,
} from '../src/systems/movementSystem.js'
import { useOfficeStore } from '../src/systems/store.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const realRandom = Math.random
beforeAll(() => { Math.random = mulberry32(0xa5156) })
afterAll(() => { Math.random = realRandom })

// ── F4: elliptical visual-overlap predicate ────────────────────────────────────────────
describe('visuallyOverlapping — anisotropic sprite footprint', () => {
  it('a 35px VERTICAL gap still overlaps (the old circular blind spot)', () => {
    expect(visuallyOverlapping({ x: 100, y: 100 }, { x: 100, y: 135 })).toBe(true)
  })
  it('a 35px HORIZONTAL gap does NOT overlap (並肩 is fine)', () => {
    expect(visuallyOverlapping({ x: 100, y: 100 }, { x: 135, y: 100 })).toBe(false)
  })
  it(`clears at ry=${SPRITE_CLEAR_RY} vertically and rx=${SPRITE_CLEAR_RX} horizontally`, () => {
    expect(visuallyOverlapping({ x: 0, y: 0 }, { x: 0, y: SPRITE_CLEAR_RY })).toBe(false)
    expect(visuallyOverlapping({ x: 0, y: 0 }, { x: SPRITE_CLEAR_RX, y: 0 })).toBe(false)
    expect(visuallyOverlapping({ x: 0, y: 0 }, { x: SPRITE_CLEAR_RX - 1, y: 0 })).toBe(true)
  })
})

describe('avoidOverlap — resolves vertical stacks out of the ellipse', () => {
  it('a seed directly ABOVE an occupied spot resolves outside everyone\'s ellipse', () => {
    for (let i = 0; i < 200; i++) {
      const occupied = [{ x: 300, y: 300 }, { x: 300, y: 340 }]
      const out = avoidOverlap({ x: 300, y: 305 }, occupied)
      for (const o of occupied) {
        expect(visuallyOverlapping(out, o), `(${out.x},${out.y}) overlaps (${o.x},${o.y})`).toBe(false)
      }
    }
  })
  it('an exact 0px stack seed resolves cleanly', () => {
    for (let i = 0; i < 200; i++) {
      const occupied = [{ x: 240, y: 386 }]
      const out = avoidOverlap({ x: 240, y: 386 }, occupied)
      expect(visuallyOverlapping(out, occupied[0])).toBe(false)
    }
  })

  it('TWO-PUSHER horizontal band (coffee machine + water cooler) never oscillates into an overlap', () => {
    // Fresh-review HIGH (2026-06-10): a "set x relative to the pusher" resolution bounced
    // between two standers on the same rank (80,475)+(130,475) and returned a still-
    // overlapping spot 12.4% of the time. The cumulative radial-elliptical push + ring
    // fallback must score 0 here — this is an everyday lounge configuration.
    const occupied = [{ x: 80, y: 475 }, { x: 130, y: 475 }]
    let bad = 0
    for (let i = 0; i < 2000; i++) {
      const seed = { x: 130 + (Math.random() - 0.5) * 48, y: 475 + (Math.random() - 0.5) * 48 }
      const out = avoidOverlap(seed, occupied)
      if (occupied.some(o => visuallyOverlapping(out, o))) bad++
    }
    expect(bad).toBe(0)
  })

  it('dense 3-cluster still resolves (ring-search fallback)', () => {
    const occupied = [{ x: 300, y: 300 }, { x: 340, y: 300 }, { x: 320, y: 340 }]
    let bad = 0
    for (let i = 0; i < 1000; i++) {
      const out = avoidOverlap({ x: 320, y: 310 }, occupied)
      if (occupied.some(o => visuallyOverlapping(out, o))) bad++
    }
    expect(bad).toBe(0)
  })
})

// ── F2: door-anchor jitter ─────────────────────────────────────────────────────────────
describe('door crossings are jittered per transit (no single shared pixel)', () => {
  it('mainOffice→lounge crossings spread across the door opening and stay walkable', () => {
    const anchor = DOOR_SIDES.mainToLounge.mainOffice // raw (240,386)
    const seenX = new Set()
    for (let i = 0; i < 100; i++) {
      const path = calculatePath({ x: 400, y: 220 }, { x: 180, y: 490 })
      // The crossing pair is the consecutive points straddling the lounge wall band.
      const crossing = path.filter(p => p.y >= 380 && p.y <= 438 && Math.abs(p.x - anchor.x) <= 12)
      expect(crossing.length, 'path must cross through the lounge door band').toBeGreaterThanOrEqual(1)
      for (const p of crossing) {
        expect(isOnFloor(p.x, p.y), `(${p.x},${p.y}) on floor`).toBe(true)
        expect(isOnObstacle(p.x, p.y)).toBe(false)
        expect(Math.abs(p.x - anchor.x)).toBeLessThanOrEqual(10.5)
        seenX.add(Math.round(p.x * 2) / 2)
      }
    }
    // Per-transit jitter must actually vary the crossing point — the forensic capture
    // showed EVERY transit on the literal anchor pixel.
    expect(seenX.size).toBeGreaterThan(5)
  })

  it('both sides of one crossing share the same lateral offset (segment stays in the doorway)', () => {
    for (let i = 0; i < 100; i++) {
      const path = calculatePath({ x: 300, y: 250 }, { x: 180, y: 490 })
      const south = path.find(p => p.y > 420 && p.y <= 438 && Math.abs(p.x - 240) <= 12)
      const north = path.find(p => p.y >= 380 && p.y < 400 && Math.abs(p.x - 240) <= 12)
      if (north && south) expect(Math.abs(north.x - south.x)).toBeLessThanOrEqual(0.001)
    }
  })
})

// ── F3: journey publication + picker visibility ────────────────────────────────────────
describe('journeyTarget — landing spots are visible to other destination pickers', () => {
  it('getTargetForBehavior cannot claim a spot inside a walker\'s journey-end ellipse', () => {
    // Walker 'a' is mid-route: its CURRENT LEG (targetPosition) is a corridor node far from
    // its journey end. Pre-fix, 'b' saw only the corridor node and claimed the landing spot.
    const journeyEnd = { x: 180, y: 490 } // the lounge 'nap' waypoint
    const agents = {
      a: { position: { x: 300, y: 250 }, targetPosition: { x: 240, y: 386 }, journeyTarget: journeyEnd },
      b: { position: { x: 500, y: 300 } },
    }
    for (let i = 0; i < 150; i++) {
      const dest = getTargetForBehavior('b', 'nap', agents)
      expect(dest).toBeTruthy()
      expect(visuallyOverlapping(dest, journeyEnd), `(${dest.x},${dest.y}) stacks a's landing spot`).toBe(false)
    }
  })

  it('store: setAgentJourney publishes; setAgentArrived clears (no stale claims)', () => {
    const s = useOfficeStore.getState()
    s.initAgents?.()
    const id = Object.keys(useOfficeStore.getState().agents)[0]
    const dest = { x: 180, y: 490 }
    useOfficeStore.getState().setAgentJourney(id, dest)
    expect(useOfficeStore.getState().agents[id].journeyTarget).toEqual(dest)
    useOfficeStore.getState().setAgentTarget(id, { x: 240, y: 386 })
    expect(useOfficeStore.getState().agents[id].journeyTarget).toEqual(dest) // legs don't clear it
    useOfficeStore.getState().setAgentArrived(id)
    expect(useOfficeStore.getState().agents[id].journeyTarget).toBeNull()
    // explicit abort clear
    useOfficeStore.getState().setAgentJourney(id, dest)
    useOfficeStore.getState().setAgentJourney(id, null)
    expect(useOfficeStore.getState().agents[id].journeyTarget).toBeNull()
  })
})
