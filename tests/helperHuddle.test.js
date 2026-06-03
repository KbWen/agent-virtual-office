import { describe, it, expect, beforeEach } from 'vitest'
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
})
