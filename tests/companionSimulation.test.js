import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { getNextBehavior } from '../src/systems/behaviorEngine.js'
import { resolveHelperLayout, HELPER_MAX_VISIBLE } from '../src/systems/movementSystem.js'
import { triggerInteractiveEvent } from '../src/systems/officeLife.js'
import { moodToWeather } from '../src/components/TopDownFurniture.jsx'
import { normalizeStatusMessage } from '../src/inference/inferStatus.js'

// ─────────────────────────────────────────────────────────────────────────────
// "Comfortable all-day companion" lifecycle simulation. Drives the office through a
// realistic Claude session — idle → prompt → multi-task → subagent fan-out (helper huddle
// + supervising) → heavy fan-out → blocked → done → ambient event → mood weather → idle —
// asserting the integration stays correct and CALM (no stuck/contradictory state) at each
// beat. A permanent regression net for the whole feature set, headless-safe (no rendering).
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const setStatus = (id, status, behavior) =>
  useOfficeStore.setState((s) => ({ agents: { ...s.agents, [id]: { ...s.agents[id], status, ...(behavior ? { behavior } : {}) } } }))

describe('companion lifecycle simulation', () => {
  beforeEach(() => {
    // calm resting state
    useOfficeStore.setState((s) => {
      const agents = {}
      for (const id of Object.keys(s.agents)) agents[id] = { ...s.agents[id], status: 'idle', inGroupEvent: false, bubble: null }
      return { agents, helpers: [], activeEvent: null, isPaused: false }
    })
  })

  it('PHASE 0 — idle resting state is calm (no work, no helpers, no event)', () => {
    const s = useOfficeStore.getState()
    expect(s.helpers).toEqual([])
    expect(s.activeEvent).toBeNull()
    for (const id of ROLES) expect(s.agents[id].status).toBe('idle')
    // idle agents have NO helpers → the huddle resolver yields nothing (a calm desk)
    for (const id of ROLES) expect(resolveHelperLayout(id, 0).sprites).toEqual([])
  })

  it('PHASE 1 — a user prompt wakes the PM (planning), nothing else stirs', () => {
    setStatus('pm', 'working', 'gantt-chart')
    const s = useOfficeStore.getState()
    expect(s.agents.pm.status).toBe('working')
    // the rest stay calm
    expect(ROLES.filter((id) => s.agents[id].status !== 'idle')).toEqual(['pm'])
  })

  it('PHASE 2 — multi-task lights several distinct roles at once, each with a real behavior', () => {
    setStatus('dev', 'working'); setStatus('qa', 'working'); setStatus('designer', 'working'); setStatus('ops', 'working')
    const active = ROLES.filter((id) => useOfficeStore.getState().agents[id].status === 'working')
    expect(active.sort()).toEqual(['designer', 'dev', 'ops', 'qa'])
    // each working role gets a well-formed, finite-duration behavior (never a broken chain)
    for (const id of active) {
      const b = getNextBehavior(id, 'working', 10, 'normal')
      expect(b.behaviorId).toBeTruthy()
      expect(Number.isFinite(b.duration) && b.duration > 0).toBe(true)
    }
  })

  it('PHASE 3 — dev dispatches 3 subagents: a capped desk huddle, dev becomes the supervising lead', () => {
    setStatus('dev', 'working')
    useOfficeStore.getState().setHelpers([
      { id: 'dev#1', parentRole: 'dev', label: 'Explore' },
      { id: 'dev#2', parentRole: 'dev', label: 'Explore' },
      { id: 'dev#3', parentRole: 'dev', label: 'general-purpose' },
    ])
    const helpers = useOfficeStore.getState().helpers
    expect(helpers.length).toBe(3)
    // hasActiveHelper (the supervising selector) is true for dev, false for others
    expect(helpers.some((h) => h.parentRole === 'dev')).toBe(true)
    expect(helpers.some((h) => h.parentRole === 'qa')).toBe(false)
    const layout = resolveHelperLayout('dev', 3)
    expect(layout.sprites.length).toBe(3)
    expect(layout.overflow).toBe(0)
    expect(layout.heavy).toBe(false)
  })

  it('PHASE 4 — heavy fan-out (12 subagents) stays cozy: 3 figures + "+9", heavy cue, never 12 bodies', () => {
    useOfficeStore.getState().setHelpers(
      Array.from({ length: 12 }, (_, i) => ({ id: `dev#${i}`, parentRole: 'dev' }))
    )
    const layout = resolveHelperLayout('dev', 12)
    expect(layout.sprites.length).toBe(HELPER_MAX_VISIBLE) // 3, never 12
    expect(layout.overflow).toBe(9)
    expect(layout.heavy).toBe(true)
  })

  it('PHASE 5 — a blocked role reads as STUCK from posture (frustration cluster), not wandering off', () => {
    setStatus('qa', 'blocked')
    let frustrated = 0
    for (let i = 0; i < 300; i++) if (getNextBehavior('qa', 'blocked', 10, 'normal').category === 'frustrated') frustrated++
    expect(frustrated / 300).toBeGreaterThan(0.4)
  })

  it('PHASE 6 — done is transient: a done role exists momentarily, then the office returns calm', () => {
    setStatus('dev', 'done')
    expect(useOfficeStore.getState().agents.dev.status).toBe('done')
    // wind down: clear helpers (subagents finished) + status back to idle
    useOfficeStore.getState().clearHelpers()
    setStatus('dev', 'idle')
    expect(useOfficeStore.getState().helpers).toEqual([])
    expect(useOfficeStore.getState().agents.dev.status).toBe('idle')
  })

  it('PHASE 7 — an ambient office event gathers the team without leaving anyone stuck', () => {
    const fired = triggerInteractiveEvent(useOfficeStore, 'standup')
    expect(fired).toBe(true)
    const s = useOfficeStore.getState()
    expect(s.activeEvent?.id).toBe('standup')
    const inEvent = ROLES.filter((id) => s.agents[id].inGroupEvent)
    expect(inEvent.length).toBeGreaterThanOrEqual(2)
    // cleanup releases everyone (no permanent inGroupEvent lock)
    for (const id of inEvent) { s.clearAgentGroupEvent(id); s.clearBubble(id) }
    s.clearActiveEvent()
    expect(ROLES.every((id) => !useOfficeStore.getState().agents[id].inGroupEvent)).toBe(true)
  })

  it('PHASE 8 — mood drives the weather (calm ambient signal), every mood maps to a valid sky', () => {
    for (const mood of ['normal', 'rushing', 'frustrated', 'stuck']) {
      const w = moodToWeather(mood)
      expect(typeof w).toBe('string')
      expect(w.length).toBeGreaterThan(0)
    }
    expect(moodToWeather('frustrated')).not.toBe(moodToWeather('normal'))
  })

  it('PHASE 9 — TTL self-heal: a missed SubagentStop expires via prune, the desk never accumulates', () => {
    const now = 1_000_000
    useOfficeStore.getState().setHelpers([{ id: 'res#x', parentRole: 'res' }], now)
    useOfficeStore.getState().pruneHelpers(now + 59_000)
    expect(useOfficeStore.getState().helpers.length).toBe(1) // not yet
    useOfficeStore.getState().pruneHelpers(now + 61_000)
    expect(useOfficeStore.getState().helpers.length).toBe(0) // self-healed
  })

  it('INGESTION CONTRACT — a realistic /api/status payload normalizes cleanly (helpers + tokens + mood)', () => {
    const msg = normalizeStatusMessage({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working', label: 'coding' }],
      helpers: [{ id: 'dev#1', parentRole: 'dev', label: 'Explore' }, { id: 'bad', parentRole: 'notarole' }],
      tokens: { ctx: 120000, out: 800, model: 'claude-opus-4-8' },
      mood: 'rushing',
    })
    // malformed helper (bad parentRole) is dropped; the valid one survives
    expect(msg.helpers.length).toBe(1)
    expect(msg.helpers[0].parentRole).toBe('dev')
    expect(msg.tokens.ctx).toBe(120000)
    expect(msg.mood).toBe('rushing')
  })
})
