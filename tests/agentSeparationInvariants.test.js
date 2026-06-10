import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { MEETING_CHAIRS } from '../src/systems/movementSystem.js'

// Deterministic RNG (mulberry32) for the deconfliction tests below. The store's `avoidOverlap`
// fan-out picks its push DIRECTION with `Math.random()` (movementSystem.js), so with the degenerate
// all-on-one-cell input the separation occasionally fell a hair under MIN_SEP on an unlucky live
// random sequence → a flaky CI failure (~15.6/14.5 < 20). Seeding `Math.random` makes the fan-out
// reproducible (same idiom as tests/movementPathingFuzz.test.js). It still genuinely verifies the
// deconfliction SEPARATES the agents — just on a fixed, repeatable sequence.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The coverage gap the owner caught: every prior movement test checks agent-vs-MAP (on-floor,
// off-furniture). NONE checked agent-vs-AGENT. Agents piled on one cell during gather events and the
// upper sprite (SVG paints opaque, in y-order) fully hid the others ("4 piled, one disappeared").
// These lock the separation guarantee now enforced by the store's group-event deconfliction.

const MIN_SEP = 20 // ~1 sprite width in the 800x560 viewBox; below this, sprites occlude each other
const minPairwise = (pts) => {
  let m = Infinity
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))
  return m
}
const STANDUP_SPOTS = [
  { x: 500, y: 350 }, { x: 525, y: 348 }, { x: 550, y: 350 }, { x: 578, y: 354 },
  { x: 445, y: 382 }, { x: 490, y: 384 }, { x: 535, y: 382 }, { x: 578, y: 380 },
]

describe('gather spot tables are pairwise separated', () => {
  it('standup whiteboardSpots are ≥ MIN_SEP apart', () => {
    expect(minPairwise(STANDUP_SPOTS)).toBeGreaterThanOrEqual(MIN_SEP)
  })
  it('MEETING_CHAIRS are ≥ MIN_SEP apart', () => {
    expect(minPairwise(MEETING_CHAIRS)).toBeGreaterThanOrEqual(MIN_SEP)
  })
  it('tea-break coffeeSpots are ≥ MIN_SEP apart', () => {
    expect(minPairwise([{ x: 80, y: 475 }, { x: 110, y: 485 }, { x: 140, y: 470 }])).toBeGreaterThanOrEqual(MIN_SEP)
  })
})

describe('store deconflicts gather targets so agents never stack (pile-up / disappear fix)', () => {
  let _origRandom
  beforeEach(() => {
    _origRandom = Math.random
    const rng = mulberry32(0x5eed1234)
    Math.random = rng
  })
  afterEach(() => {
    Math.random = _origRandom
    const s = useOfficeStore.getState()
    Object.keys(s.agents).forEach((id) => s.clearAgentGroupEvent(id))
  })

  it('8 standup participants resolve to mutually separated targets', () => {
    const ids = Object.keys(useOfficeStore.getState().agents).slice(0, 8)
    useOfficeStore.getState().setMultipleAgentGroupEvents(
      ids.map((id, i) => ({ id, behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: STANDUP_SPOTS[i] }))
    )
    const resolved = ids.map((id) => useOfficeStore.getState().agents[id].groupTarget)
    expect(resolved.every(Boolean)).toBe(true)
    expect(minPairwise(resolved)).toBeGreaterThanOrEqual(MIN_SEP)
  })

  it('participants ALL assigned the SAME cell do NOT pile (the exact bug) — they fan out', () => {
    const ids = Object.keys(useOfficeStore.getState().agents).slice(0, 6)
    useOfficeStore.getState().setMultipleAgentGroupEvents(
      ids.map((id) => ({ id, behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: { x: 400, y: 300 } }))
    )
    const resolved = ids.map((id) => useOfficeStore.getState().agents[id].groupTarget)
    expect(minPairwise(resolved)).toBeGreaterThanOrEqual(MIN_SEP)
  })
})

// Nightly soak catch 2026-06-10 (CI run 27287064996): an event participant stood 23px from
// a NON-participant at dev's chair for the whole event. The chokepoints' occupied set held
// only IN-GROUP agents — bystanders were invisible. These pin the closed holes.
describe('event targets respect BYSTANDERS (non-participants) — the 23px soak catch', () => {
  let _origRandom
  beforeEach(() => {
    _origRandom = Math.random
    Math.random = mulberry32(0xb1ca1c4)
  })
  afterEach(() => {
    Math.random = _origRandom
    const s = useOfficeStore.getState()
    Object.keys(s.agents).forEach((id) => s.clearAgentGroupEvent(id))
  })
  const ellipseClear = (p, q) => {
    const nx = (p.x - q.x) / 32, ny = (p.y - q.y) / 44
    return nx * nx + ny * ny >= 0.94 // small float tolerance
  }

  it('setAgentGroupEvent: a target ON a working bystander is pushed out of their ellipse', () => {
    const s = useOfficeStore.getState()
    const ids = Object.keys(s.agents)
    const bystander = ids[0], actor = ids[1]
    const bystanderPos = { x: 340, y: 364 } // dev's chair — the observed catch
    useOfficeStore.setState((st) => ({
      agents: { ...st.agents, [bystander]: { ...st.agents[bystander], position: bystanderPos, targetPosition: bystanderPos, isMoving: false, inGroupEvent: false } },
    }))
    for (let i = 0; i < 50; i++) {
      useOfficeStore.getState().setAgentGroupEvent(actor, {
        behavior: 'pass-document', expression: 'normal', bubble: null,
        groupTarget: { x: bystanderPos.x + 10, y: bystanderPos.y - 8 }, // jitter(spillerPos,30)-class
      })
      const gt = useOfficeStore.getState().agents[actor].groupTarget
      expect(gt).toBeTruthy()
      expect(ellipseClear(gt, bystanderPos), `(${gt.x},${gt.y}) inside bystander ellipse`).toBe(true)
      useOfficeStore.getState().clearAgentGroupEvent(actor)
    }
  })

  it('setMultipleAgentGroupEvents: a batch gather beside a bystander clears their ellipse too', () => {
    const s = useOfficeStore.getState()
    const ids = Object.keys(s.agents)
    const bystander = ids[0]
    const batch = ids.slice(1, 5)
    const bystanderPos = { x: 320, y: 180 }
    useOfficeStore.setState((st) => ({
      agents: { ...st.agents, [bystander]: { ...st.agents[bystander], position: bystanderPos, targetPosition: bystanderPos, isMoving: false, inGroupEvent: false } },
    }))
    useOfficeStore.getState().setMultipleAgentGroupEvents(
      batch.map((id, i) => ({ id, behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: { x: 315 + i * 5, y: 178 } }))
    )
    for (const id of batch) {
      const gt = useOfficeStore.getState().agents[id].groupTarget
      expect(gt).toBeTruthy()
      expect(ellipseClear(gt, bystanderPos), `${id} gt (${gt.x},${gt.y}) inside bystander ellipse`).toBe(true)
    }
  })

  it('react-in-place participant frozen mid-overlap gets a SIDE-STEP target instead of null', () => {
    const s = useOfficeStore.getState()
    const ids = Object.keys(s.agents)
    const stander = ids[0], reactor = ids[1]
    const spot = { x: 300, y: 250 }
    useOfficeStore.setState((st) => ({
      agents: {
        ...st.agents,
        [stander]: { ...st.agents[stander], position: spot, targetPosition: spot, isMoving: false, inGroupEvent: false },
        [reactor]: { ...st.agents[reactor], position: { x: spot.x + 6, y: spot.y + 10 }, targetPosition: { x: spot.x + 6, y: spot.y + 10 }, isMoving: false, inGroupEvent: false },
      },
    }))
    useOfficeStore.getState().setAgentGroupEvent(reactor, {
      behavior: 'scratch-head', expression: 'confused', bubble: null, groupTarget: null,
    })
    const gt = useOfficeStore.getState().agents[reactor].groupTarget
    expect(gt, 'overlapped react-in-place participant must receive a side-step target').toBeTruthy()
    expect(ellipseClear(gt, spot)).toBe(true)
  })

  it('react-in-place participant with CLEAR surroundings stays put (groupTarget stays null)', () => {
    const s = useOfficeStore.getState()
    const ids = Object.keys(s.agents)
    const reactor = ids[2]
    useOfficeStore.setState((st) => ({
      agents: { ...st.agents, [reactor]: { ...st.agents[reactor], position: { x: 100, y: 500 }, targetPosition: { x: 100, y: 500 }, isMoving: false, inGroupEvent: false } },
    }))
    useOfficeStore.getState().setAgentGroupEvent(reactor, {
      behavior: 'scratch-head', expression: 'confused', bubble: null, groupTarget: null,
    })
    expect(useOfficeStore.getState().agents[reactor].groupTarget).toBeNull()
  })
})
