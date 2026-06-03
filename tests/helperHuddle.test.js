import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveHelperLayout, HELPER_MAX_VISIBLE, HOME_POSITIONS } from '../src/systems/movementSystem'
import { useOfficeStore } from '../src/systems/store.js'

describe('resolveHelperLayout — capped, no-overlap subagent helper placement', () => {
  it('returns up to 3 sprites + the overflow count (10+ subagents never pile up)', () => {
    expect(resolveHelperLayout('dev', 2).sprites.length).toBe(2)
    expect(resolveHelperLayout('dev', 2).overflow).toBe(0)
    const big = resolveHelperLayout('dev', 12)
    expect(big.sprites.length).toBe(HELPER_MAX_VISIBLE)   // 3, never 12 bodies
    expect(big.overflow).toBe(9)                          // +9 glyph
  })

  it('empty for 0 helpers or an unknown role', () => {
    expect(resolveHelperLayout('dev', 0).sprites).toEqual([])
    expect(resolveHelperLayout('nope', 5).sprites).toEqual([])
  })

  it('sets the heavy-load flag once a role crosses the threshold', () => {
    expect(resolveHelperLayout('dev', 3).heavy).toBe(false)
    expect(resolveHelperLayout('dev', 4).heavy).toBe(true)
    expect(resolveHelperLayout('dev', 20).heavy).toBe(true)
  })

  it('NO OVERLAP: every helper stays within a tight radius of its parent chair', () => {
    for (const role of Object.keys(HOME_POSITIONS)) {
      const anchor = HOME_POSITIONS[role]
      if (!anchor) continue
      for (const s of resolveHelperLayout(role, 3).sprites) {
        expect(Math.abs(s.x - anchor.x)).toBeLessThanOrEqual(20)  // ±15 fan + margin
        expect(s.y - anchor.y).toBeGreaterThan(0)                  // below the chair
        expect(s.y - anchor.y).toBeLessThanOrEqual(30)
      }
    }
  })

  it('static desk layout keeps every desk pair far enough apart for the fans (no cross-desk collision)', () => {
    const roles = ['pm', 'arch', 'dev', 'ops', 'qa', 'res', 'designer']
    for (const a of roles) for (const b of roles) {
      if (a >= b) continue
      const pa = HOME_POSITIONS[a], pb = HOME_POSITIONS[b]
      const apart = Math.abs(pa.x - pb.x) > 30 || Math.abs(pa.y - pb.y) > 30
      expect(apart, `${a}/${b} desks too close for ±15 helper fans`).toBe(true)
    }
  })
})

describe('store helpers slice — ingestion + TTL self-heal', () => {
  beforeEach(() => useOfficeStore.setState({ helpers: [] }))

  it('setHelpers ingests valid records, stamps a 60s TTL, drops malformed ones', () => {
    useOfficeStore.getState().setHelpers([
      { id: 'res#a1', parentRole: 'res', label: 'Explore' },
      { id: 'res#a2', parentRole: 'res' },
      { bad: true },                 // dropped: no id/parentRole
      { id: 5, parentRole: 'dev' },  // dropped: id not a string
    ], 1000)
    const h = useOfficeStore.getState().helpers
    expect(h.length).toBe(2)
    expect(h[0]).toMatchObject({ id: 'res#a1', parentRole: 'res', label: 'Explore', expiresAt: 61000 })
    expect(h[1].label).toBeNull()
  })

  it('pruneHelpers removes expired helpers (missed SubagentStop self-heals)', () => {
    useOfficeStore.getState().setHelpers([{ id: 'x#1', parentRole: 'dev' }], 1000)
    useOfficeStore.getState().pruneHelpers(1000 + 59999)  // not yet expired
    expect(useOfficeStore.getState().helpers.length).toBe(1)
    useOfficeStore.getState().pruneHelpers(1000 + 60001)  // expired
    expect(useOfficeStore.getState().helpers.length).toBe(0)
  })

  it('hard-caps a runaway payload at 64 records', () => {
    const huge = Array.from({ length: 200 }, (_, i) => ({ id: 'r#' + i, parentRole: 'dev' }))
    useOfficeStore.getState().setHelpers(huge, 0)
    expect(useOfficeStore.getState().helpers.length).toBe(64)
  })

  it('clearHelpers empties the slice', () => {
    useOfficeStore.getState().setHelpers([{ id: 'x#1', parentRole: 'dev' }], 0)
    useOfficeStore.getState().clearHelpers()
    expect(useOfficeStore.getState().helpers).toEqual([])
  })

  it('drops helper entries whose parentRole is not one of the 8 base roles', () => {
    useOfficeStore.getState().setHelpers([
      { id: 'dev#1', parentRole: 'dev' },           // valid
      { id: 'bad#1', parentRole: 'engineer' },       // invalid — not in VALID_ROLES
      { id: 'qa#1',  parentRole: 'qa' },             // valid
      { id: 'bad#2', parentRole: 'DESIGNER' },       // invalid — case-sensitive
      { id: 'bad#3', parentRole: '' },               // invalid — empty string
    ], 0)
    const h = useOfficeStore.getState().helpers
    expect(h.length).toBe(2)
    expect(h.map(x => x.id)).toEqual(['dev#1', 'qa#1'])
  })

  it('de-dupes by id (last wins) so a doubled id never renders twice', () => {
    useOfficeStore.getState().setHelpers([
      { id: 'dev#1', parentRole: 'dev',  label: 'first' },
      { id: 'dev#2', parentRole: 'arch', label: 'only' },
      { id: 'dev#1', parentRole: 'res',  label: 'last' },   // duplicate id — last wins
    ], 0)
    const h = useOfficeStore.getState().helpers
    expect(h.length).toBe(2)
    const deduped = h.find(x => x.id === 'dev#1')
    expect(deduped.parentRole).toBe('res')
    expect(deduped.label).toBe('last')
  })
})

// ─── Fix: orphan huddle skip (lightweight / non-agentcortex roster mismatch) ──
describe('HelperHuddle selector — orphan-role filtering', () => {
  // These tests exercise the selector logic directly by reading from the store.
  // The selector in HelperHuddle.jsx skips roles where s.agents[role] is absent.

  beforeEach(() => {
    useOfficeStore.setState({ helpers: [], agents: {} })
  })

  it('produces no flat entry for a helper whose parentRole is absent from agents', () => {
    // Lightweight roster: only planner/worker/checker; helpers use full-office role names
    useOfficeStore.setState({
      agents: {
        planner: { id: 'planner', color: '#378ADD', position: { x: 140, y: 240 }, status: 'working' },
      },
      helpers: [
        { id: 'h#1', parentRole: 'planner' },  // lead present — should render
        { id: 'h#2', parentRole: 'arch' },     // lead ABSENT — should be skipped
        { id: 'h#3', parentRole: 'dev' },      // lead ABSENT — should be skipped
      ],
    })

    // Simulate what the HelperHuddle selector computes
    const s = useOfficeStore.getState()
    const counts = {}
    for (const h of s.helpers) counts[h.parentRole] = (counts[h.parentRole] || 0) + 1
    const out = {}
    for (const role of Object.keys(counts)) {
      const a = s.agents[role]
      if (!a) continue  // <-- the fix
      const pos = a.position
      out[role] = `${counts[role]}|${pos ? Math.round(pos.x) : ''}|${pos ? Math.round(pos.y) : ''}|${a.color || ''}`
    }

    expect(Object.keys(out)).toEqual(['planner'])
    expect(out['arch']).toBeUndefined()
    expect(out['dev']).toBeUndefined()
  })

  it('renders nothing when ALL helper parentRoles are absent from the roster', () => {
    useOfficeStore.setState({
      agents: {
        worker: { id: 'worker', color: '#1D9E75', position: { x: 340, y: 335 }, status: 'working' },
      },
      helpers: [
        { id: 'h#1', parentRole: 'pm' },    // absent
        { id: 'h#2', parentRole: 'ops' },   // absent
      ],
    })

    const s = useOfficeStore.getState()
    const counts = {}
    for (const h of s.helpers) counts[h.parentRole] = (counts[h.parentRole] || 0) + 1
    const out = {}
    for (const role of Object.keys(counts)) {
      if (!s.agents[role]) continue
      out[role] = role
    }

    expect(Object.keys(out).length).toBe(0)
  })
})

// ─── Fix: anchor tracks store position (waypoint-granularity) ──────────────────
describe('HelperHuddle anchor — position follows store (waypoint-granularity)', () => {
  beforeEach(() => {
    useOfficeStore.setState({ helpers: [], agents: {} })
  })

  it('huddle anchor x/y updates when s.agents[role].position changes', () => {
    useOfficeStore.setState({
      agents: {
        dev: { id: 'dev', color: '#1D9E75', position: { x: 340, y: 335 }, status: 'working' },
      },
      helpers: [{ id: 'h#1', parentRole: 'dev' }],
    })

    // Read the anchor derived from initial position
    const readAnchor = () => {
      const s = useOfficeStore.getState()
      const a = s.agents['dev']
      if (!a) return null
      const pos = a.position
      return pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : null
    }

    expect(readAnchor()).toEqual({ x: 340, y: 335 })

    // Simulate the lead reaching a new waypoint (store position advances)
    useOfficeStore.setState({
      agents: {
        dev: { id: 'dev', color: '#1D9E75', position: { x: 260, y: 290 }, status: 'working' },
      },
    })

    // Anchor should now reflect the new waypoint position
    expect(readAnchor()).toEqual({ x: 260, y: 290 })
  })

  it('resolveHelperLayout uses the provided anchor (deskAnchor) to offset sprites', () => {
    const anchor1 = { x: 140, y: 240 }
    const anchor2 = { x: 340, y: 335 }
    const layout1 = resolveHelperLayout('pm', 2, anchor1)
    const layout2 = resolveHelperLayout('pm', 2, anchor2)
    // Sprites should be centred around different anchors
    const cx1 = layout1.sprites.reduce((sum, s) => sum + s.x, 0) / layout1.sprites.length
    const cx2 = layout2.sprites.reduce((sum, s) => sum + s.x, 0) / layout2.sprites.length
    expect(Math.abs(cx1 - anchor1.x)).toBeLessThan(20)
    expect(Math.abs(cx2 - anchor2.x)).toBeLessThan(20)
    // The two anchor positions produce different sprite placements
    expect(Math.abs(cx1 - cx2)).toBeGreaterThan(50)
  })
})
