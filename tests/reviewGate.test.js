import { describe, it, expect } from 'vitest'
import { gateWaiting, gatePhaseGlyph, GATE_SHEET_CAP } from '../src/systems/reviewGate.js'

describe('gateWaiting (AVO-107)', () => {
  it('counts ONLY awaiting-approval agents (never blocked/working/done)', () => {
    const agents = {
      dev: { status: 'working' },
      qa:  { status: 'awaiting-approval' },
      ops: { status: 'blocked' },     // blocked alone is NOT waiting-on-human
      arch:{ status: 'awaiting-approval' },
      res: { status: 'done' },
    }
    const r = gateWaiting(agents, null)
    expect(r.count).toBe(2)
    expect(r.names.sort()).toEqual(['arch', 'qa'])
  })
  it('returns empty (caller renders nothing) when nobody waits', () => {
    expect(gateWaiting({ dev: { status: 'working' } }, '/review')).toEqual({ count: 0, names: [], phaseGlyph: 'review' })
    expect(gateWaiting({}, null)).toEqual({ count: 0, names: [], phaseGlyph: null })
    expect(gateWaiting(null, null).count).toBe(0)
  })
  it('exposes a single global phase glyph from activeWorkflow, null otherwise', () => {
    expect(gateWaiting({ qa: { status: 'awaiting-approval' } }, '/review').phaseGlyph).toBe('review')
    expect(gateWaiting({ qa: { status: 'awaiting-approval' } }, '/ship').phaseGlyph).toBe('ship')
    expect(gateWaiting({ qa: { status: 'awaiting-approval' } }, '/implement').phaseGlyph).toBeNull()
    expect(gateWaiting({ qa: { status: 'awaiting-approval' } }, null).phaseGlyph).toBeNull()
  })
})

describe('gatePhaseGlyph (AVO-107)', () => {
  it('maps review/ship phrasings, null for everything else', () => {
    expect(gatePhaseGlyph('/review')).toBe('review')
    expect(gatePhaseGlyph('Code Review')).toBe('review')
    expect(gatePhaseGlyph('/ship')).toBe('ship')
    expect(gatePhaseGlyph('deploy')).toBe('ship')
    expect(gatePhaseGlyph('/plan')).toBeNull()
    expect(gatePhaseGlyph(null)).toBeNull()
    expect(gatePhaseGlyph(undefined)).toBeNull()
  })
})

describe('GATE_SHEET_CAP', () => {
  it('caps visual sheets so N waiters never become N markers', () => {
    expect(GATE_SHEET_CAP).toBe(3)
  })
})
